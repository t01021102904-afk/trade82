import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, test } from "node:test";

import { Prisma, PrismaClient } from "../src/generated/prisma/client.ts";

function assertDisposableDatabase() {
  const value = process.env.DATABASE_URL;
  assert.ok(value, "DATABASE_URL is required for the disposable integration suite.");
  const url = new URL(value);
  assert.ok(["127.0.0.1", "localhost", "::1"].includes(url.hostname));
  assert.match(url.pathname.slice(1), /^trade82_order_payout_test_[a-z0-9_-]+$/i);
  assert.doesNotMatch(url.hostname, /supabase|neon|aws|vercel|render|railway|fly/i);
}

assertDisposableDatabase();
process.env.DATABASE_POOL_MAX = "4";
process.env.PARTNER_PROGRAM_MODE = "on";

const { getDb } = await import(new URL("../src/lib/db.ts", import.meta.url).href);
const { getPartnerReferralAnalytics } = await import(
  new URL("../src/lib/partner-referral-analytics.ts", import.meta.url).href,
);
const db = getDb() as PrismaClient;

after(async () => {
  await db.$disconnect();
});

function suffix() {
  return randomBytes(8).toString("hex");
}

test("analytics UTC boundaries are stable across PostgreSQL session timezones", async () => {
  const id = suffix();
  const now = new Date("2026-07-22T00:00:00.000Z");
  const partnerUser = await db.userProfile.create({
    data: {
      clerkUserId: `analytics-timezone-partner-${id}`,
      email: `analytics-timezone-partner-${id}@example.test`,
      displayName: "Timezone Partner",
      role: "user",
    },
  });
  const partner = await db.partnerProfile.create({
    data: {
      userId: partnerUser.id,
      referralCode: `T82-TZ-${id.toUpperCase()}`,
      status: "ACTIVE",
    },
  });
  const referredUsers = await Promise.all(
    ["midnight", "late"].map((label) =>
      db.userProfile.create({
        data: {
          clerkUserId: `analytics-timezone-${label}-${id}`,
          email: `analytics-timezone-${label}-${id}@example.test`,
          displayName: `Timezone ${label}`,
          role: "buyer",
        },
      }),
    ),
  );
  const midnightUtc = new Date("2026-07-21T00:30:00.000Z");
  const lateUtc = new Date("2026-07-21T23:30:00.000Z");
  const attributions = await Promise.all(
    referredUsers.map((user, index) =>
      db.referralAttribution.create({
        data: {
          referredUserId: user.id,
          partnerProfileId: partner.id,
          referralCode: partner.referralCode,
          status: "LOCKED",
          lockedAt: index === 0 ? midnightUtc : lateUtc,
        },
      }),
    ),
  );
  await db.referralConversion.createMany({
    data: attributions.map((attribution, index) => ({
      partnerProfileId: partner.id,
      referralAttributionId: attribution.id,
      subjectType: index === 0 ? "SELLER" : "BUYER",
      convertedAt: index === 0 ? midnightUtc : lateUtc,
    })),
  });
  await db.referralClickDailyVisitor.createMany({
    data: [
      {
        partnerProfileId: partner.id,
        visitorHash: `previous-${id}`,
        day: new Date("2026-07-15T00:00:00.000Z"),
        clickCount: 10,
      },
      {
        partnerProfileId: partner.id,
        visitorHash: `start-${id}`,
        day: new Date("2026-07-16T00:00:00.000Z"),
        clickCount: 11,
      },
      {
        partnerProfileId: partner.id,
        visitorHash: `midnight-${id}`,
        day: new Date("2026-07-21T00:00:00.000Z"),
        clickCount: 2,
      },
      {
        partnerProfileId: partner.id,
        visitorHash: `end-${id}`,
        day: new Date("2026-07-22T00:00:00.000Z"),
        clickCount: 13,
      },
    ],
  });

  try {
    const results = await db.$transaction(async (tx) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT set_config('timezone', ${"America/Los_Angeles"}, true)`,
      );
      const losAngeles = {
        short: await getPartnerReferralAnalytics({
          db: tx as never,
          partnerProfileId: partner.id,
          range: "7d",
          now,
        }),
        all: await getPartnerReferralAnalytics({
          db: tx as never,
          partnerProfileId: partner.id,
          range: "all",
          now,
        }),
      };
      await tx.$executeRaw(
        Prisma.sql`SELECT set_config('timezone', ${"UTC"}, true)`,
      );
      const utc = {
        short: await getPartnerReferralAnalytics({
          db: tx as never,
          partnerProfileId: partner.id,
          range: "7d",
          now,
        }),
        all: await getPartnerReferralAnalytics({
          db: tx as never,
          partnerProfileId: partner.id,
          range: "all",
          now,
        }),
      };
      return { losAngeles, utc };
    });

    assert.deepEqual(results.losAngeles, results.utc);
    assert.equal(results.utc.short.totals.totalClicks, 26);
    assert.equal(results.utc.short.totals.uniqueVisitors, 3);
    assert.equal(results.utc.short.totals.attributedSignups, 2);
    assert.equal(results.utc.short.totals.sellerRegistrations, 1);
    assert.equal(results.utc.short.totals.buyerRegistrations, 1);
    assert.deepEqual(
      results.utc.short.trafficSeries.filter(
        (point: { totalClicks: number }) => point.totalClicks > 0,
      ),
      [
        { date: "2026-07-16", totalClicks: 11, uniqueVisitors: 1 },
        { date: "2026-07-21", totalClicks: 2, uniqueVisitors: 1 },
        { date: "2026-07-22", totalClicks: 13, uniqueVisitors: 1 },
      ],
    );
    assert.deepEqual(
      results.utc.short.conversionSeries.filter(
        (point: { attributedSignups: number }) => point.attributedSignups > 0,
      ),
      [
        {
          date: "2026-07-21",
          attributedSignups: 2,
          sellerRegistrations: 1,
          buyerRegistrations: 1,
        },
      ],
    );
    assert.deepEqual(
      results.utc.all.trafficSeries,
      [{ date: "2026-07", totalClicks: 36, uniqueVisitors: 4 }],
    );
    assert.deepEqual(
      results.utc.all.conversionSeries,
      [
        {
          date: "2026-07",
          attributedSignups: 2,
          sellerRegistrations: 1,
          buyerRegistrations: 1,
        },
      ],
    );
  } finally {
    await db.referralConversion.deleteMany({ where: { partnerProfileId: partner.id } });
    await db.referralAttribution.deleteMany({ where: { partnerProfileId: partner.id } });
    await db.referralClickDailyVisitor.deleteMany({ where: { partnerProfileId: partner.id } });
    await db.partnerProfile.delete({ where: { id: partner.id } });
    await db.userProfile.deleteMany({ where: { id: { in: [partnerUser.id, ...referredUsers.map((user) => user.id)] } } });
  }
});
