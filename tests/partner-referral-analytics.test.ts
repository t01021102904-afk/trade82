import assert from "node:assert/strict";
import { test } from "node:test";

import {
  applyReferralVisitorCookie,
  getPartnerReferralAnalytics,
  hashReferralVisitor,
  normalizePartnerAnalyticsRange,
  recordReferralClick,
} from "../src/lib/partner-referral-analytics.ts";
import { recordReferralConversionForCompany } from "../src/lib/partner-referral-conversions.ts";

const now = new Date("2026-07-21T15:30:00.000Z");

test("analytics range and visitor hashes fail closed without exposing raw identifiers", () => {
  assert.equal(normalizePartnerAnalyticsRange(undefined), "30d");
  assert.equal(normalizePartnerAnalyticsRange("30d"), "30d");
  assert.equal(normalizePartnerAnalyticsRange("invalid"), "30d");
  const hash = hashReferralVisitor("test-cookie-value");
  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.notEqual(hash, "test-cookie-value");
});

test("referral clicks exclude prefetches, non-GETs, self-clicks, and inactive partners", async () => {
  let upserts = 0;
  const db = {
    partnerProfile: {
      findFirst: async () => ({ id: "partner-1", userId: "profile-owner" }),
    },
    referralClickDailyVisitor: {
      upsert: async () => {
        upserts += 1;
      },
      findMany: async () => [],
    },
    referralAttribution: { findMany: async () => [] },
    referralConversion: {
      upsert: async () => undefined,
      findMany: async () => [],
    },
  };

  await recordReferralClick({
    db,
    request: new Request("https://trade82.test/r/T82-VALID_CODE", {
      headers: { purpose: "prefetch" },
    }),
    referralCode: "T82-VALID_CODE",
    now,
  });
  await recordReferralClick({
    db,
    request: new Request("https://trade82.test/r/T82-VALID_CODE", {
      method: "POST",
    }),
    referralCode: "T82-VALID_CODE",
    now,
  });
  await recordReferralClick({
    db,
    request: new Request("https://trade82.test/r/T82-VALID_CODE"),
    referralCode: "T82-VALID_CODE",
    authenticatedUserProfileId: "profile-owner",
    now,
  });
  assert.equal(upserts, 0);
});

test("referral click capture uses a random cookie and an atomic daily upsert", async () => {
  const writes: unknown[] = [];
  const db = {
    partnerProfile: {
      findFirst: async () => ({ id: "partner-1", userId: "profile-owner" }),
    },
    referralClickDailyVisitor: {
      upsert: async (args: unknown) => {
        writes.push(args);
      },
      findMany: async () => [],
    },
    referralAttribution: { findMany: async () => [] },
    referralConversion: {
      upsert: async () => undefined,
      findMany: async () => [],
    },
  };

  const first = await recordReferralClick({
    db,
    request: new Request("https://trade82.test/r/T82-VALID_CODE"),
    referralCode: " t82-valid_code ",
    now,
  });
  assert.ok(first);
  assert.match(first.value, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(writes.length, 1);
  const firstWrite = writes[0] as {
    where: {
      partnerProfileId_visitorHash_day: { visitorHash: string; day: Date };
    };
    create: { visitorHash: string; clickCount: number };
    update: { clickCount: { increment: number } };
  };
  assert.equal(firstWrite.create.clickCount, 1);
  assert.equal(firstWrite.update.clickCount.increment, 1);
  assert.match(firstWrite.create.visitorHash, /^[a-f0-9]{64}$/);
  assert.notEqual(firstWrite.create.visitorHash, first.value);
  assert.equal(
    firstWrite.where.partnerProfileId_visitorHash_day.day.toISOString(),
    "2026-07-21T00:00:00.000Z",
  );

  const response = new Response(null, { status: 302 });
  applyReferralVisitorCookie(response, first.value);
  const setCookie = response.headers.get("set-cookie") ?? "";
  assert.match(setCookie, /trade82_referral_visitor=/);
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Lax/);
  assert.match(setCookie, /Path=\//);
  assert.match(setCookie, /Max-Age=31536000/);
  assert.doesNotMatch(setCookie, /Domain=/);
  assert.doesNotMatch(
    setCookie,
    /test-cookie-value|profile-owner|T82-VALID_CODE/,
  );
});

test("analytics totals use distinct visitors, zero-filled UTC buckets, and a zero denominator rate", async () => {
  const db = {
    referralClickDailyVisitor: {
      findMany: async () => [
        {
          visitorHash: "visitor-a",
          day: new Date("2026-07-20T00:00:00.000Z"),
          clickCount: 3,
        },
        {
          visitorHash: "visitor-a",
          day: new Date("2026-07-21T00:00:00.000Z"),
          clickCount: 2,
        },
        {
          visitorHash: "visitor-b",
          day: new Date("2026-07-21T00:00:00.000Z"),
          clickCount: 1,
        },
      ],
    },
    referralAttribution: {
      findMany: async () => [
        { lockedAt: new Date("2026-07-21T12:00:00.000Z") },
      ],
    },
    referralConversion: {
      findMany: async () => [
        {
          subjectType: "SELLER" as const,
          convertedAt: new Date("2026-07-21T12:00:00.000Z"),
        },
        {
          subjectType: "BUYER" as const,
          convertedAt: new Date("2026-07-21T12:00:00.000Z"),
        },
      ],
    },
  };
  const analytics = await getPartnerReferralAnalytics({
    db: db as never,
    partnerProfileId: "partner-1",
    range: "7d",
    now,
  });
  assert.equal(analytics.totals.totalClicks, 6);
  assert.equal(analytics.totals.uniqueVisitors, 2);
  assert.equal(analytics.totals.attributedSignups, 1);
  assert.equal(analytics.totals.sellerRegistrations, 1);
  assert.equal(analytics.totals.buyerRegistrations, 1);
  assert.equal(analytics.totals.signupConversionRate, 50);
  assert.equal(analytics.trafficSeries.length, 7);
  assert.equal(analytics.trafficSeries[5]?.totalClicks, 3);
  assert.equal(analytics.trafficSeries[6]?.totalClicks, 3);
  assert.equal(analytics.trafficSeries[6]?.uniqueVisitors, 2);

  const empty = await getPartnerReferralAnalytics({
    db: {
      referralClickDailyVisitor: { findMany: async () => [] },
      referralAttribution: { findMany: async () => [] },
      referralConversion: { findMany: async () => [] },
    } as never,
    partnerProfileId: "partner-1",
    range: "30d",
    now,
  });
  assert.equal(empty.totals.signupConversionRate, 0);
  assert.equal(empty.trafficSeries.length, 30);
});

test("company conversion snapshots are immutable and idempotent for seller and buyer roles", async () => {
  const writes: unknown[] = [];
  const db = {
    referralAttribution: {
      findUnique: async () => ({
        id: "attribution-1",
        partnerProfileId: "partner-1",
      }),
    },
    referralConversion: {
      upsert: async (args: unknown) => {
        writes.push(args);
        return args;
      },
    },
  };
  await recordReferralConversionForCompany(db, {
    ownerUserId: "user-1",
    companyRole: "seller",
    companyCreatedAt: new Date("2026-07-21T10:00:00.000Z"),
  });
  await recordReferralConversionForCompany(db, {
    ownerUserId: "user-1",
    companyRole: "buyer",
    companyCreatedAt: new Date("2026-07-21T11:00:00.000Z"),
  });
  await recordReferralConversionForCompany(db, {
    ownerUserId: "user-1",
    companyRole: "seller",
    companyCreatedAt: new Date("2026-07-21T12:00:00.000Z"),
  });
  assert.equal(writes.length, 3);
  assert.equal(
    (writes[0] as { create: { subjectType: string } }).create.subjectType,
    "SELLER",
  );
  assert.equal(
    (writes[1] as { create: { subjectType: string } }).create.subjectType,
    "BUYER",
  );
  assert.deepEqual((writes[2] as { update: unknown }).update, {});
});
