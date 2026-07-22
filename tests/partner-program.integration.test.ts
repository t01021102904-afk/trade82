import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, test } from "node:test";

import { PrismaClient } from "../src/generated/prisma/client.ts";

function assertDisposableDatabase() {
  const value = process.env.DATABASE_URL;
  assert.ok(
    value,
    "DATABASE_URL is required for the disposable integration suite.",
  );
  const url = new URL(value);
  assert.ok(
    ["127.0.0.1", "localhost"].includes(url.hostname),
    "The integration database must be localhost only.",
  );
  assert.match(
    url.pathname.slice(1),
    /^trade82_order_payout_test_/,
    "The integration database name is not disposable.",
  );
}

assertDisposableDatabase();
process.env.DATABASE_POOL_MAX = "4";
process.env.PARTNER_PROGRAM_MODE = "on";

const { getDb } = await import(
  new URL("../src/lib/db.ts", import.meta.url).href
);
const referrals = await import(
  new URL("../src/lib/partner-referrals.ts", import.meta.url).href
);
const referralAnalytics = await import(
  new URL("../src/lib/partner-referral-analytics.ts", import.meta.url).href
);
const referralConversions = await import(
  new URL("../src/lib/partner-referral-conversions.ts", import.meta.url).href
);
const db = getDb() as PrismaClient;

after(async () => {
  await db.$disconnect();
});

function suffix() {
  return randomBytes(8).toString("hex");
}

test("disposable PostgreSQL keeps raw referral secrets out of the database and enforces first attribution", async () => {
  const id = suffix();
  const partnerUser = await db.userProfile.create({
    data: {
      clerkUserId: `partner-${id}`,
      email: `partner-${id}@example.test`,
      displayName: "Partner",
      role: "user",
    },
  });
  const referred = await db.userProfile.create({
    data: {
      clerkUserId: `referred-${id}`,
      email: `referred-${id}@example.test`,
      displayName: "Referred",
      role: "buyer",
    },
  });
  const partner = await db.partnerProfile.create({
    data: {
      userId: partnerUser.id,
      referralCode: `T82-${id.toUpperCase()}`,
      status: "ACTIVE",
    },
  });
  const rawToken = referrals.createReferralClaimSecret();
  const claim = await db.referralClaimToken.create({
    data: {
      tokenHash: referrals.hashReferralClaimToken(rawToken),
      partnerProfileId: partner.id,
      expiresAt: new Date(Date.now() + 60_000),
    },
  });
  assert.notEqual(claim.tokenHash, rawToken);

  const result = (await db.$transaction((tx) =>
    referrals.consumeReferralClaimForNewUser(tx, {
      rawToken,
      referredUserId: referred.id,
    }),
  )) as { consumed: boolean };
  assert.equal(result.consumed, true);
  const [storedClaim, attribution] = await Promise.all([
    db.referralClaimToken.findUniqueOrThrow({ where: { id: claim.id } }),
    db.referralAttribution.findUniqueOrThrow({
      where: { referredUserId: referred.id },
    }),
  ]);
  assert.ok(storedClaim.consumedAt);
  assert.equal(storedClaim.consumedByUserId, referred.id);
  assert.equal(attribution.partnerProfileId, partner.id);
  await assert.rejects(() =>
    db.referralAttribution.create({
      data: {
        referredUserId: referred.id,
        partnerProfileId: partner.id,
        referralCode: partner.referralCode,
        status: "LOCKED",
        lockedAt: new Date(),
      },
    }),
  );
});

test("disposable PostgreSQL enforces one partner profile per user and rejects self-referral", async () => {
  const id = suffix();
  const user = await db.userProfile.create({
    data: {
      clerkUserId: `partner-self-${id}`,
      email: `partner-self-${id}@example.test`,
      displayName: "Partner",
      role: "user",
    },
  });
  const partner = await db.partnerProfile.create({
    data: {
      userId: user.id,
      referralCode: `T82-${id.toUpperCase()}`,
      status: "ACTIVE",
    },
  });

  await assert.rejects(() =>
    db.partnerProfile.create({
      data: {
        userId: user.id,
        referralCode: `T82-DUPLICATE-${id.toUpperCase()}`,
        status: "ACTIVE",
      },
    }),
  );

  const rawToken = referrals.createReferralClaimSecret();
  const claim = await db.referralClaimToken.create({
    data: {
      tokenHash: referrals.hashReferralClaimToken(rawToken),
      partnerProfileId: partner.id,
      expiresAt: new Date(Date.now() + 60_000),
    },
  });
  const result = (await db.$transaction((tx) =>
    referrals.consumeReferralClaimForNewUser(tx, {
      rawToken,
      referredUserId: user.id,
    }),
  )) as { consumed: boolean; reason?: string };

  assert.deepEqual(result, { consumed: false, reason: "invalid" });
  assert.equal(
    (await db.referralClaimToken.findUniqueOrThrow({ where: { id: claim.id } }))
      .consumedAt,
    null,
  );
  assert.equal(
    await db.referralAttribution.count({ where: { referredUserId: user.id } }),
    0,
  );
});

test("disposable PostgreSQL blocks claim references after partner deletion and keeps claim indexes available", async () => {
  const id = suffix();
  const user = await db.userProfile.create({
    data: {
      clerkUserId: `partner-reference-${id}`,
      email: `partner-reference-${id}@example.test`,
      displayName: "Partner",
      role: "user",
    },
  });
  const partner = await db.partnerProfile.create({
    data: {
      userId: user.id,
      referralCode: `T82-${id.toUpperCase()}`,
      status: "ACTIVE",
    },
  });
  await db.referralClaimToken.create({
    data: {
      tokenHash: referrals.hashReferralClaimToken(
        referrals.createReferralClaimSecret(),
      ),
      partnerProfileId: partner.id,
      expiresAt: new Date(Date.now() + 60_000),
    },
  });
  await assert.rejects(() =>
    db.partnerProfile.delete({ where: { id: partner.id } }),
  );
  const indexes = await db.$queryRaw<
    Array<{ indexname: string }>
  >`SELECT indexname FROM pg_indexes WHERE tablename = 'ReferralClaimToken'`;
  assert.ok(
    indexes.some((entry) =>
      entry.indexname.includes("partnerProfileId_expiresAt"),
    ),
  );
});

test("expired, suspended, and feature-off claims never create an attribution", async () => {
  const id = suffix();
  const partnerUser = await db.userProfile.create({
    data: {
      clerkUserId: `partner-invalid-${id}`,
      email: `partner-invalid-${id}@example.test`,
      displayName: "Partner",
      role: "user",
    },
  });
  const referred = await db.userProfile.create({
    data: {
      clerkUserId: `referred-invalid-${id}`,
      email: `referred-invalid-${id}@example.test`,
      displayName: "Referred",
      role: "buyer",
    },
  });
  const partner = await db.partnerProfile.create({
    data: {
      userId: partnerUser.id,
      referralCode: `T82-${id.toUpperCase()}`,
      status: "ACTIVE",
    },
  });

  const expiredToken = referrals.createReferralClaimSecret();
  await db.referralClaimToken.create({
    data: {
      tokenHash: referrals.hashReferralClaimToken(expiredToken),
      partnerProfileId: partner.id,
      expiresAt: new Date(Date.now() - 1),
    },
  });
  const expired = (await db.$transaction((tx) =>
    referrals.consumeReferralClaimForNewUser(tx, {
      rawToken: expiredToken,
      referredUserId: referred.id,
    }),
  )) as { consumed: boolean };
  assert.equal(expired.consumed, false);

  const suspendedToken = referrals.createReferralClaimSecret();
  await db.partnerProfile.update({
    where: { id: partner.id },
    data: { status: "SUSPENDED" },
  });
  await db.referralClaimToken.create({
    data: {
      tokenHash: referrals.hashReferralClaimToken(suspendedToken),
      partnerProfileId: partner.id,
      expiresAt: new Date(Date.now() + 60_000),
    },
  });
  const suspended = (await db.$transaction((tx) =>
    referrals.consumeReferralClaimForNewUser(tx, {
      rawToken: suspendedToken,
      referredUserId: referred.id,
    }),
  )) as { consumed: boolean };
  assert.equal(suspended.consumed, false);

  const offToken = referrals.createReferralClaimSecret();
  await db.partnerProfile.update({
    where: { id: partner.id },
    data: { status: "ACTIVE" },
  });
  await db.referralClaimToken.create({
    data: {
      tokenHash: referrals.hashReferralClaimToken(offToken),
      partnerProfileId: partner.id,
      expiresAt: new Date(Date.now() + 60_000),
    },
  });
  process.env.PARTNER_PROGRAM_MODE = "off";
  try {
    const disabled = (await db.$transaction((tx) =>
      referrals.consumeReferralClaimForNewUser(tx, {
        rawToken: offToken,
        referredUserId: referred.id,
      }),
    )) as { consumed: boolean };
    assert.equal(disabled.consumed, false);
  } finally {
    process.env.PARTNER_PROGRAM_MODE = "on";
  }
  assert.equal(
    await db.referralAttribution.count({
      where: { referredUserId: referred.id },
    }),
    0,
  );
});

test("first attribution remains immutable and a claim can be consumed at most once under concurrency", async () => {
  const id = suffix();
  const partnerUser = await db.userProfile.create({
    data: {
      clerkUserId: `partner-concurrent-${id}`,
      email: `partner-concurrent-${id}@example.test`,
      displayName: "Partner",
      role: "user",
    },
  });
  const partner = await db.partnerProfile.create({
    data: {
      userId: partnerUser.id,
      referralCode: `T82-${id.toUpperCase()}`,
      status: "ACTIVE",
    },
  });
  const firstReferred = await db.userProfile.create({
    data: {
      clerkUserId: `first-${id}`,
      email: `first-${id}@example.test`,
      displayName: "First",
      role: "buyer",
    },
  });
  const secondReferred = await db.userProfile.create({
    data: {
      clerkUserId: `second-${id}`,
      email: `second-${id}@example.test`,
      displayName: "Second",
      role: "buyer",
    },
  });
  const token = referrals.createReferralClaimSecret();
  const claim = await db.referralClaimToken.create({
    data: {
      tokenHash: referrals.hashReferralClaimToken(token),
      partnerProfileId: partner.id,
      expiresAt: new Date(Date.now() + 60_000),
    },
  });

  const results = (await Promise.all([
    db.$transaction((tx) =>
      referrals.consumeReferralClaimForNewUser(tx, {
        rawToken: token,
        referredUserId: firstReferred.id,
      }),
    ),
    db.$transaction((tx) =>
      referrals.consumeReferralClaimForNewUser(tx, {
        rawToken: token,
        referredUserId: secondReferred.id,
      }),
    ),
  ])) as { consumed: boolean }[];
  assert.equal(results.filter((result) => result.consumed).length, 1);
  const stored = await db.referralClaimToken.findUniqueOrThrow({
    where: { id: claim.id },
  });
  assert.ok(stored.consumedAt);
  assert.ok(
    stored.consumedByUserId === firstReferred.id ||
      stored.consumedByUserId === secondReferred.id,
  );

  const laterToken = referrals.createReferralClaimSecret();
  await db.referralClaimToken.create({
    data: {
      tokenHash: referrals.hashReferralClaimToken(laterToken),
      partnerProfileId: partner.id,
      expiresAt: new Date(Date.now() + 60_000),
    },
  });
  const firstAttribution = await db.referralAttribution.findFirstOrThrow({
    where: { partnerProfileId: partner.id },
  });
  const repeat = (await db.$transaction((tx) =>
    referrals.consumeReferralClaimForNewUser(tx, {
      rawToken: laterToken,
      referredUserId: firstAttribution.referredUserId,
    }),
  )) as { consumed: boolean };
  assert.equal(repeat.consumed, false);
  assert.equal(
    (
      await db.referralAttribution.findUniqueOrThrow({
        where: { referredUserId: firstAttribution.referredUserId },
      })
    ).id,
    firstAttribution.id,
  );
});

test("invalid referral evidence never blocks a normal local user-profile creation", async () => {
  const id = suffix();
  const created = await db.$transaction(async (tx) => {
    const profile = await tx.userProfile.create({
      data: {
        clerkUserId: `invalid-claim-${id}`,
        email: `invalid-claim-${id}@example.test`,
        displayName: "Normal user",
        role: "user",
      },
    });
    const result = await referrals.consumeReferralClaimForNewUser(tx, {
      rawToken: "not-a-valid-referral-token",
      referredUserId: profile.id,
    });
    assert.equal(result.consumed, false);
    return profile;
  });
  assert.equal(
    (await db.userProfile.findUnique({ where: { id: created.id } }))?.email,
    `invalid-claim-${id}@example.test`,
  );
  assert.equal(
    await db.referralAttribution.count({
      where: { referredUserId: created.id },
    }),
    0,
  );
});

test("disposable PostgreSQL aggregates concurrent daily clicks by visitor", async () => {
  const id = suffix();
  const now = new Date("2026-07-21T15:30:00.000Z");
  const partnerUser = await db.userProfile.create({
    data: {
      clerkUserId: `analytics-partner-${id}`,
      email: `analytics-partner-${id}@example.test`,
      displayName: "Analytics Partner",
      role: "user",
    },
  });
  const partner = await db.partnerProfile.create({
    data: {
      userId: partnerUser.id,
      referralCode: `T82-${id.toUpperCase()}`,
      status: "ACTIVE",
    },
  });
  const visitorA = "A".repeat(43);
  const visitorB = "B".repeat(43);
  const requestFor = (visitor: string) =>
    new Request(`https://trade82.test/r/${partner.referralCode}`, {
      headers: { cookie: `trade82_referral_visitor=${visitor}` },
    });

  await Promise.all(
    Array.from({ length: 4 }, () =>
      referralAnalytics.recordReferralClick({
        db,
        request: requestFor(visitorA),
        referralCode: partner.referralCode,
        now,
      }),
    ),
  );
  await referralAnalytics.recordReferralClick({
    db,
    request: requestFor(visitorB),
    referralCode: partner.referralCode,
    now,
  });
  await referralAnalytics.recordReferralClick({
    db,
    request: requestFor(visitorA),
    referralCode: partner.referralCode,
    now: new Date("2026-07-22T01:00:00.000Z"),
  });

  const rows = await db.referralClickDailyVisitor.findMany({
    where: { partnerProfileId: partner.id },
    orderBy: { day: "asc" },
  });
  assert.equal(rows.length, 3);
  const clicksByDay = new Map<string, number[]>();
  for (const row of rows) {
    const day = row.day.toISOString().slice(0, 10);
    clicksByDay.set(day, [...(clicksByDay.get(day) ?? []), row.clickCount]);
  }
  assert.deepEqual(
    [...clicksByDay.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([day, counts]) => [
        day,
        counts.sort((left, right) => left - right),
      ]),
    [
      ["2026-07-21", [1, 4]],
      ["2026-07-22", [1]],
    ],
  );

  const analytics = await referralAnalytics.getPartnerReferralAnalytics({
    db,
    partnerProfileId: partner.id,
    range: "7d",
    now,
  });
  assert.equal(analytics.totals.totalClicks, 5);
  assert.equal(analytics.totals.uniqueVisitors, 2);
  assert.equal(analytics.trafficSeries.length, 7);
});

test("disposable PostgreSQL records seller and buyer conversions idempotently", async () => {
  const id = suffix();
  const partnerUser = await db.userProfile.create({
    data: {
      clerkUserId: `conversion-partner-${id}`,
      email: `conversion-partner-${id}@example.test`,
      displayName: "Conversion Partner",
      role: "user",
    },
  });
  const referredUser = await db.userProfile.create({
    data: {
      clerkUserId: `conversion-referred-${id}`,
      email: `conversion-referred-${id}@example.test`,
      displayName: "Referred User",
      role: "user",
    },
  });
  const partner = await db.partnerProfile.create({
    data: {
      userId: partnerUser.id,
      referralCode: `T82-${id.toUpperCase()}`,
      status: "ACTIVE",
    },
  });
  const attribution = await db.referralAttribution.create({
    data: {
      referredUserId: referredUser.id,
      partnerProfileId: partner.id,
      referralCode: partner.referralCode,
      status: "LOCKED",
      lockedAt: new Date("2026-07-20T12:00:00.000Z"),
    },
  });
  const seller = await db.company.create({
    data: {
      ownerUserId: referredUser.id,
      companyRole: "seller",
      legalName: `Analytics Seller ${id}`,
      country: "South Korea",
      businessAddress: "Seoul",
    },
  });
  const buyer = await db.company.create({
    data: {
      ownerUserId: referredUser.id,
      companyRole: "buyer",
      legalName: `Analytics Buyer ${id}`,
      country: "United States",
      businessAddress: "New York",
    },
  });

  await referralConversions.recordReferralConversionForCompany(db, {
    ownerUserId: referredUser.id,
    companyRole: "seller",
    companyCreatedAt: seller.createdAt,
  });
  await referralConversions.recordReferralConversionForCompany(db, {
    ownerUserId: referredUser.id,
    companyRole: "seller",
    companyCreatedAt: new Date("2026-07-21T12:00:00.000Z"),
  });
  await referralConversions.recordReferralConversionForCompany(db, {
    ownerUserId: referredUser.id,
    companyRole: "buyer",
    companyCreatedAt: buyer.createdAt,
  });

  const conversions = await db.referralConversion.findMany({
    where: { referralAttributionId: attribution.id },
    orderBy: { subjectType: "asc" },
  });
  assert.equal(conversions.length, 2);
  assert.deepEqual(
    conversions.map((conversion) => [
      conversion.subjectType,
      conversion.convertedAt,
    ]),
    [
      ["BUYER", buyer.createdAt],
      ["SELLER", seller.createdAt],
    ],
  );
});
