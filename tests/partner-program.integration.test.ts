import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, mock, test } from "node:test";

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

let routeAuthUser: { id: string; email: string } | null = null;
let routeAdminUser: { id: string; email: string } | null = null;

mock.module("@/lib/authz", {
  namedExports: {
    requireAuth: async () => {
      if (!routeAuthUser) throw new Response("Unauthorized", { status: 401 });
      return routeAuthUser;
    },
    requireAdmin: async () => {
      if (!routeAdminUser) throw new Response("Unauthorized", { status: 401 });
      return routeAdminUser;
    },
  },
});

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
const partnerPayoutRoute = await import(
  new URL("../src/app/api/account/partner-payout-profile/route.ts", import.meta.url).href,
);
const partnerEnrollRoute = await import(
  new URL("../src/app/api/partner/enroll/route.ts", import.meta.url).href,
);
const adminPartnerRoute = await import(
  new URL("../src/app/api/admin/partners/[partnerProfileId]/route.ts", import.meta.url).href,
);
const partnerProfileLocks = await import(
  new URL("../src/lib/partner-profile-locks.ts", import.meta.url).href,
);
const partnerPayoutProfiles = await import(
  new URL("../src/lib/partner-payout-profiles.ts", import.meta.url).href,
);
const db = getDb() as PrismaClient;

after(async () => {
  await db.$disconnect();
});

function suffix() {
  return randomBytes(8).toString("hex");
}

function payoutRequest(body: Record<string, unknown>) {
  return new Request("https://trade82.test/api/account/partner-payout-profile", {
    method: "PUT",
    headers: {
      origin: "https://trade82.test",
      host: "trade82.test",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function koreanPayoutBody(bankDirectoryId: string, accountNumber = "123-456-7890") {
  return {
    country: "KR",
    bankDirectoryId,
    accountHolder: "Partner Owner",
    accountNumber,
    accountType: "LOCAL",
    payoutCurrency: "krw",
    supportedCurrencies: ["krw"],
    accountBelongsToPartner: true,
  };
}

function partnerAdminStatusRequest(action: string, reason = "Concurrency test") {
  return new Request("https://trade82.test/api/admin/partners/test/status", {
    method: "POST",
    headers: {
      origin: "https://trade82.test",
      host: "trade82.test",
      "content-type": "application/json",
    },
    body: JSON.stringify({ action, reason }),
  });
}

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });
  return { promise, resolve, reject };
}

async function createPartnerPayoutFixture(status: "ACTIVE" | "PENDING_REVIEW" | "SUSPENDED" | "REJECTED") {
  const id = suffix();
  const user = await db.userProfile.create({
    data: {
      clerkUserId: `partner-payout-route-${id}`,
      email: `partner-payout-route-${id}@example.test`,
      displayName: "Partner Payout Owner",
      role: "user",
    },
  });
  const bank = await db.bankDirectory.create({
    data: {
      countryCode: "KR",
      bankNameLocal: `테스트은행 ${id}`,
      bankNameEnglish: `Test Bank ${id}`,
      sourceType: "SEED",
      isActive: true,
    },
    select: { id: true },
  });
  const partner = await db.partnerProfile.create({
    data: {
      userId: user.id,
      referralCode: `T82-${id.toUpperCase()}`,
      status,
    },
  });
  const payout = await db.partnerPayoutProfile.create({
    data: {
      partnerProfileId: partner.id,
      bankDirectoryId: bank.id,
      country: "KR",
      bankName: "Existing Test Bank",
      accountHolder: "Existing Owner",
      accountNumberCiphertext: Buffer.alloc(32, 7),
      accountNumberIv: Buffer.alloc(12, 8),
      accountNumberAuthTag: Buffer.alloc(16, 9),
      accountNumberKeyVersion: "test-v1",
      accountNumberLast4: "0000",
      accountNumberMasked: "•••• 0000",
      accountType: "LOCAL",
      payoutCurrency: "krw",
      supportedCurrencies: ["krw"],
      accountBelongsToPartner: true,
      status: "VERIFIED",
      verifiedAt: new Date("2026-07-20T00:00:00.000Z"),
      verifiedByUserId: user.id,
    },
  });
  return { id, user, bank, partner, payout };
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

test("owner payout writes allow active and pending-review partners and reset verification safely", async () => {
  const previousPayoutKey = process.env.PAYOUT_DATA_ENCRYPTION_KEY;
  const previousPayoutKeyVersion = process.env.PAYOUT_DATA_ENCRYPTION_KEY_VERSION;
  process.env.PAYOUT_DATA_ENCRYPTION_KEY = Buffer.alloc(32, 19).toString("base64");
  process.env.PAYOUT_DATA_ENCRYPTION_KEY_VERSION = "route-test-v1";
  const active = await createPartnerPayoutFixture("ACTIVE");
  const pending = await createPartnerPayoutFixture("PENDING_REVIEW");

  try {
    for (const fixture of [active, pending]) {
      routeAuthUser = { id: fixture.user.id, email: fixture.user.email };
      const beforeAuditCount = await db.partnerPayoutProfileAuditEvent.count({
        where: { payoutProfileId: fixture.payout.id },
      });
      const response = await partnerPayoutRoute.PUT(
        payoutRequest(koreanPayoutBody(fixture.bank.id, "987-654-3210")),
      );
      assert.equal(response.status, 200);
      const payload = (await response.json()) as {
        profile: Record<string, unknown>;
      };
      assert.deepEqual(Object.keys(payload.profile).sort(), [
        "accountHolder",
        "accountNumberLast4",
        "accountNumberMasked",
        "bankName",
        "id",
        "payoutCurrency",
        "status",
        "updatedAt",
        "verifiedAt",
      ].sort());
      assert.equal(payload.profile.accountNumberLast4, "3210");
      assert.equal(payload.profile.status, "PENDING_VERIFICATION");
      assert.equal(payload.profile.verifiedAt, null);
      assert.equal("accountNumberCiphertext" in payload.profile, false);
      assert.equal("partnerProfileId" in payload.profile, false);
      assert.equal("bankDirectoryId" in payload.profile, false);

      const [partnerAfter, payoutAfter, auditCount] = await Promise.all([
        db.partnerProfile.findUniqueOrThrow({ where: { id: fixture.partner.id } }),
        db.partnerPayoutProfile.findUniqueOrThrow({ where: { id: fixture.payout.id } }),
        db.partnerPayoutProfileAuditEvent.count({
          where: { payoutProfileId: fixture.payout.id },
        }),
      ]);
      assert.equal(partnerAfter.status, fixture.partner.status);
      assert.equal(payoutAfter.status, "PENDING_VERIFICATION");
      assert.equal(payoutAfter.verifiedAt, null);
      assert.equal(payoutAfter.verifiedByUserId, null);
      assert.equal(auditCount, beforeAuditCount + 1);
    }
  } finally {
    routeAuthUser = null;
    if (previousPayoutKey === undefined) delete process.env.PAYOUT_DATA_ENCRYPTION_KEY;
    else process.env.PAYOUT_DATA_ENCRYPTION_KEY = previousPayoutKey;
    if (previousPayoutKeyVersion === undefined) delete process.env.PAYOUT_DATA_ENCRYPTION_KEY_VERSION;
    else process.env.PAYOUT_DATA_ENCRYPTION_KEY_VERSION = previousPayoutKeyVersion;
  }
});

test("owner payout writes reject suspended and rejected partners without side effects", async () => {
  const previousPayoutKey = process.env.PAYOUT_DATA_ENCRYPTION_KEY;
  const previousPayoutKeyVersion = process.env.PAYOUT_DATA_ENCRYPTION_KEY_VERSION;
  process.env.PAYOUT_DATA_ENCRYPTION_KEY = Buffer.alloc(32, 21).toString("base64");
  process.env.PAYOUT_DATA_ENCRYPTION_KEY_VERSION = "blocked-route-test-v1";
  const suspended = await createPartnerPayoutFixture("SUSPENDED");
  const rejected = await createPartnerPayoutFixture("REJECTED");

  try {
    for (const [fixture, expectedStatus] of [
      [suspended, 403],
      [rejected, 409],
    ] as const) {
      routeAuthUser = { id: fixture.user.id, email: fixture.user.email };
      const before = await db.partnerPayoutProfile.findUniqueOrThrow({
        where: { id: fixture.payout.id },
      });
      const beforeAuditCount = await db.partnerPayoutProfileAuditEvent.count({
        where: { payoutProfileId: fixture.payout.id },
      });
      const response = await partnerPayoutRoute.PUT(
        payoutRequest(koreanPayoutBody(fixture.bank.id, "111-222-3333")),
      );
      assert.equal(response.status, expectedStatus);
      assert.match((await response.json()).error, /payout|enrollment/i);

      const [partnerAfter, payoutAfter, auditCount, rejectedGet] = await Promise.all([
        db.partnerProfile.findUniqueOrThrow({ where: { id: fixture.partner.id } }),
        db.partnerPayoutProfile.findUniqueOrThrow({ where: { id: fixture.payout.id } }),
        db.partnerPayoutProfileAuditEvent.count({
          where: { payoutProfileId: fixture.payout.id },
        }),
        fixture.partner.status === "REJECTED" ? partnerPayoutRoute.GET() : Promise.resolve(null),
      ]);
      assert.equal(partnerAfter.status, fixture.partner.status);
      assert.deepEqual(payoutAfter, before);
      assert.equal(auditCount, beforeAuditCount);
      if (rejectedGet) {
        assert.equal(rejectedGet.status, 200);
        assert.deepEqual(await rejectedGet.json(), {
          profile: null,
          partnerStatus: "REJECTED",
        });
      }
    }
  } finally {
    routeAuthUser = null;
    if (previousPayoutKey === undefined) delete process.env.PAYOUT_DATA_ENCRYPTION_KEY;
    else process.env.PAYOUT_DATA_ENCRYPTION_KEY = previousPayoutKey;
    if (previousPayoutKeyVersion === undefined) delete process.env.PAYOUT_DATA_ENCRYPTION_KEY_VERSION;
    else process.env.PAYOUT_DATA_ENCRYPTION_KEY_VERSION = previousPayoutKeyVersion;
  }
});

test("rejected partner enrollment resubmission changes status and payout atomically", async () => {
  const previousPayoutKey = process.env.PAYOUT_DATA_ENCRYPTION_KEY;
  const previousPayoutKeyVersion = process.env.PAYOUT_DATA_ENCRYPTION_KEY_VERSION;
  process.env.PAYOUT_DATA_ENCRYPTION_KEY = Buffer.alloc(32, 23).toString("base64");
  process.env.PAYOUT_DATA_ENCRYPTION_KEY_VERSION = "resubmission-test-v1";
  const fixture = await createPartnerPayoutFixture("REJECTED");
  routeAuthUser = { id: fixture.user.id, email: fixture.user.email };

  const enrollmentBody = (bankDirectoryId: string, accountNumber: string) => ({
    fullName: "Resubmitted Partner",
    phone: "+1 (212) 555-0199",
    preferredLanguage: "en",
    country: "KR",
    bankDirectoryId,
    accountHolder: "Resubmitted Partner",
    accountNumber,
    accountType: "LOCAL",
    payoutCurrency: "krw",
    supportedCurrencies: ["krw"],
    accountBelongsToPartner: true,
    agreeToTerms: true,
    acknowledgePayoutTerms: true,
    acknowledgePrivacy: true,
  });

  try {
    const beforePayout = await db.partnerPayoutProfile.findUniqueOrThrow({
      where: { id: fixture.payout.id },
    });
    const failed = await partnerEnrollRoute.POST(
      new Request("https://trade82.test/api/partner/enroll", {
        method: "POST",
        headers: {
          origin: "https://trade82.test",
          host: "trade82.test",
          "content-type": "application/json",
        },
        body: JSON.stringify(enrollmentBody(`missing-${fixture.id}`, "555-666-7777")),
      }),
    );
    assert.equal(failed.status, 400);
    const [afterFailedPartner, afterFailedPayout] = await Promise.all([
      db.partnerProfile.findUniqueOrThrow({ where: { id: fixture.partner.id } }),
      db.partnerPayoutProfile.findUniqueOrThrow({ where: { id: fixture.payout.id } }),
    ]);
    assert.equal(afterFailedPartner.status, "REJECTED");
    assert.deepEqual(afterFailedPayout, beforePayout);

    const succeeded = await partnerEnrollRoute.POST(
      new Request("https://trade82.test/api/partner/enroll", {
        method: "POST",
        headers: {
          origin: "https://trade82.test",
          host: "trade82.test",
          "content-type": "application/json",
        },
        body: JSON.stringify(enrollmentBody(fixture.bank.id, "555-666-7777")),
      }),
    );
    assert.equal(succeeded.status, 200);
    const [afterPartner, afterPayout] = await Promise.all([
      db.partnerProfile.findUniqueOrThrow({ where: { id: fixture.partner.id } }),
      db.partnerPayoutProfile.findUniqueOrThrow({ where: { id: fixture.payout.id } }),
    ]);
    assert.equal(afterPartner.status, "PENDING_REVIEW");
    assert.equal(afterPayout.status, "PENDING_VERIFICATION");
    assert.equal(afterPayout.accountNumberLast4, "7777");
    assert.equal(afterPayout.verifiedAt, null);
    assert.equal(afterPayout.verifiedByUserId, null);
  } finally {
    routeAuthUser = null;
    if (previousPayoutKey === undefined) delete process.env.PAYOUT_DATA_ENCRYPTION_KEY;
    else process.env.PAYOUT_DATA_ENCRYPTION_KEY = previousPayoutKey;
    if (previousPayoutKeyVersion === undefined) delete process.env.PAYOUT_DATA_ENCRYPTION_KEY_VERSION;
    else process.env.PAYOUT_DATA_ENCRYPTION_KEY_VERSION = previousPayoutKeyVersion;
  }
});

test("owner payout write is rejected when administrator suspension commits before the locked write", async () => {
  const previousPayoutKey = process.env.PAYOUT_DATA_ENCRYPTION_KEY;
  const previousPayoutKeyVersion = process.env.PAYOUT_DATA_ENCRYPTION_KEY_VERSION;
  process.env.PAYOUT_DATA_ENCRYPTION_KEY = Buffer.alloc(32, 25).toString("base64");
  process.env.PAYOUT_DATA_ENCRYPTION_KEY_VERSION = "suspension-first-test-v1";
  const fixture = await createPartnerPayoutFixture("ACTIVE");
  routeAuthUser = { id: fixture.user.id, email: fixture.user.email };
  const lockAcquired = deferred();
  const releaseSuspension = deferred();

  const suspensionTx = db.$transaction(async (tx) => {
    await partnerProfileLocks.lockPartnerProfileById(tx, fixture.partner.id);
    await tx.partnerProfile.update({
      where: { id: fixture.partner.id },
      data: { status: "SUSPENDED" },
    });
    lockAcquired.resolve();
    await releaseSuspension.promise;
  }, { timeout: 15_000 });

  try {
    await lockAcquired.promise;
    const beforePayout = await db.partnerPayoutProfile.findUniqueOrThrow({
      where: { id: fixture.payout.id },
    });
    const beforeAuditCount = await db.partnerPayoutProfileAuditEvent.count({
      where: { payoutProfileId: fixture.payout.id },
    });
    const responsePromise = partnerPayoutRoute.PUT(
      payoutRequest(koreanPayoutBody(fixture.bank.id, "222-333-4444")),
    );
    releaseSuspension.resolve();
    await suspensionTx;

    const response = await responsePromise;
    assert.equal(response.status, 403);
    const [afterPayout, auditCount, partnerAfter] = await Promise.all([
      db.partnerPayoutProfile.findUniqueOrThrow({ where: { id: fixture.payout.id } }),
      db.partnerPayoutProfileAuditEvent.count({
        where: { payoutProfileId: fixture.payout.id },
      }),
      db.partnerProfile.findUniqueOrThrow({ where: { id: fixture.partner.id } }),
    ]);
    assert.deepEqual(afterPayout, beforePayout);
    assert.equal(auditCount, beforeAuditCount);
    assert.equal(partnerAfter.status, "SUSPENDED");
  } finally {
    releaseSuspension.resolve();
    routeAuthUser = null;
    if (previousPayoutKey === undefined) delete process.env.PAYOUT_DATA_ENCRYPTION_KEY;
    else process.env.PAYOUT_DATA_ENCRYPTION_KEY = previousPayoutKey;
    if (previousPayoutKeyVersion === undefined) delete process.env.PAYOUT_DATA_ENCRYPTION_KEY_VERSION;
    else process.env.PAYOUT_DATA_ENCRYPTION_KEY_VERSION = previousPayoutKeyVersion;
  }
});

test("owner payout update commits before later administrator suspension when it owns the partner lock first", async () => {
  const previousPayoutKey = process.env.PAYOUT_DATA_ENCRYPTION_KEY;
  const previousPayoutKeyVersion = process.env.PAYOUT_DATA_ENCRYPTION_KEY_VERSION;
  process.env.PAYOUT_DATA_ENCRYPTION_KEY = Buffer.alloc(32, 27).toString("base64");
  process.env.PAYOUT_DATA_ENCRYPTION_KEY_VERSION = "payout-first-test-v1";
  const fixture = await createPartnerPayoutFixture("ACTIVE");
  const admin = await db.userProfile.create({
    data: {
      clerkUserId: `partner-admin-${fixture.id}`,
      email: `partner-admin-${fixture.id}@example.test`,
      displayName: "Partner Admin",
      role: "admin",
    },
  });
  routeAdminUser = { id: admin.id, email: admin.email };
  const lockAcquired = deferred();
  const releasePayout = deferred();

  const payoutTx = db.$transaction(async (tx) => {
    const authorization = partnerProfileLocks.authorizePartnerPayoutWrite(
      await partnerProfileLocks.lockOwnedPartnerProfile(tx, fixture.user.id),
    );
    assert.equal(authorization.ok, true);
    lockAcquired.resolve();
    await releasePayout.promise;
    return partnerPayoutProfiles.savePartnerPayoutProfile({
      db: tx,
      partnerProfileId: fixture.partner.id,
      actorUserId: fixture.user.id,
      input: {
        bankDirectoryId: fixture.bank.id,
        accountHolder: "Partner Owner",
        accountNumber: "333-444-5555",
        accountBelongsToPartner: true,
      },
    });
  }, { timeout: 15_000 });

  try {
    await lockAcquired.promise;
    const adminResponsePromise = adminPartnerRoute.POST(
      partnerAdminStatusRequest("suspend"),
      { params: Promise.resolve({ partnerProfileId: fixture.partner.id }) },
    );
    releasePayout.resolve();
    const [profile, adminResponse] = await Promise.all([payoutTx, adminResponsePromise]);
    assert.equal(adminResponse.status, 200);
    assert.equal(profile.status, "PENDING_VERIFICATION");
    assert.equal(profile.accountNumberLast4, "5555");

    const [partnerAfter, payoutAfter] = await Promise.all([
      db.partnerProfile.findUniqueOrThrow({ where: { id: fixture.partner.id } }),
      db.partnerPayoutProfile.findUniqueOrThrow({ where: { id: fixture.payout.id } }),
    ]);
    assert.equal(partnerAfter.status, "SUSPENDED");
    assert.equal(payoutAfter.accountNumberLast4, "5555");
    assert.equal(payoutAfter.status, "PENDING_VERIFICATION");
  } finally {
    releasePayout.resolve();
    routeAdminUser = null;
    if (previousPayoutKey === undefined) delete process.env.PAYOUT_DATA_ENCRYPTION_KEY;
    else process.env.PAYOUT_DATA_ENCRYPTION_KEY = previousPayoutKey;
    if (previousPayoutKeyVersion === undefined) delete process.env.PAYOUT_DATA_ENCRYPTION_KEY_VERSION;
    else process.env.PAYOUT_DATA_ENCRYPTION_KEY_VERSION = previousPayoutKeyVersion;
  }
});

test("rejected enrollment resubmission evaluates status after a concurrent lifecycle lock commits", async () => {
  const previousPayoutKey = process.env.PAYOUT_DATA_ENCRYPTION_KEY;
  const previousPayoutKeyVersion = process.env.PAYOUT_DATA_ENCRYPTION_KEY_VERSION;
  process.env.PAYOUT_DATA_ENCRYPTION_KEY = Buffer.alloc(32, 29).toString("base64");
  process.env.PAYOUT_DATA_ENCRYPTION_KEY_VERSION = "enrollment-lock-test-v1";
  const fixture = await createPartnerPayoutFixture("REJECTED");
  routeAuthUser = { id: fixture.user.id, email: fixture.user.email };
  const lockAcquired = deferred();
  const releaseAdmin = deferred();

  const adminLifecycleTx = db.$transaction(async (tx) => {
    await partnerProfileLocks.lockPartnerProfileById(tx, fixture.partner.id);
    await tx.partnerProfile.update({
      where: { id: fixture.partner.id },
      data: { status: "PENDING_REVIEW" },
    });
    lockAcquired.resolve();
    await releaseAdmin.promise;
  }, { timeout: 15_000 });

  try {
    await lockAcquired.promise;
    const responsePromise = partnerEnrollRoute.POST(
      new Request("https://trade82.test/api/partner/enroll", {
        method: "POST",
        headers: {
          origin: "https://trade82.test",
          host: "trade82.test",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          fullName: "Serialized Partner",
          phone: "+1 (212) 555-0188",
          preferredLanguage: "en",
          country: "KR",
          bankDirectoryId: fixture.bank.id,
          accountHolder: "Serialized Partner",
          accountNumber: "444-555-6666",
          accountType: "LOCAL",
          payoutCurrency: "krw",
          supportedCurrencies: ["krw"],
          accountBelongsToPartner: true,
          agreeToTerms: true,
          acknowledgePayoutTerms: true,
          acknowledgePrivacy: true,
        }),
      }),
    );
    releaseAdmin.resolve();
    await adminLifecycleTx;
    const response = await responsePromise;
    assert.equal(response.status, 200);

    const [partnerAfter, payoutAfter] = await Promise.all([
      db.partnerProfile.findUniqueOrThrow({ where: { id: fixture.partner.id } }),
      db.partnerPayoutProfile.findUniqueOrThrow({ where: { id: fixture.payout.id } }),
    ]);
    assert.equal(partnerAfter.status, "PENDING_REVIEW");
    assert.equal(payoutAfter.accountNumberLast4, "6666");
    assert.equal(payoutAfter.status, "PENDING_VERIFICATION");
  } finally {
    releaseAdmin.resolve();
    routeAuthUser = null;
    if (previousPayoutKey === undefined) delete process.env.PAYOUT_DATA_ENCRYPTION_KEY;
    else process.env.PAYOUT_DATA_ENCRYPTION_KEY = previousPayoutKey;
    if (previousPayoutKeyVersion === undefined) delete process.env.PAYOUT_DATA_ENCRYPTION_KEY_VERSION;
    else process.env.PAYOUT_DATA_ENCRYPTION_KEY_VERSION = previousPayoutKeyVersion;
  }
});

test("partner payout authorization fails closed for future statuses and blocked writes do not leak sensitive data", async () => {
  const unsupported = partnerProfileLocks.authorizePartnerPayoutWrite({
    id: "partner-future-status",
    status: "ARCHIVED" as never,
  });
  assert.deepEqual(unsupported, {
    ok: false,
    status: 403,
    error: "Partner profile status is not eligible for payout updates.",
  });

  const fixture = await createPartnerPayoutFixture("SUSPENDED");
  routeAuthUser = { id: fixture.user.id, email: fixture.user.email };
  const logs: string[] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    logs.push(args.map(String).join(" "));
  };
  try {
    const response = await partnerPayoutRoute.PUT(
      payoutRequest(koreanPayoutBody(fixture.bank.id, "999-888-7777")),
    );
    assert.equal(response.status, 403);
    const text = await response.text();
    assert.equal(text.includes("999-888-7777"), false);
    assert.equal(text.includes("accountNumberCiphertext"), false);
    assert.equal(text.includes("accountNumberIv"), false);
    assert.equal(text.includes("accountNumberAuthTag"), false);
    assert.equal(logs.join("\n").includes("999-888-7777"), false);
  } finally {
    console.error = originalError;
    routeAuthUser = null;
  }
});
