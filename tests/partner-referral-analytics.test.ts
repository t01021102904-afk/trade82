import assert from "node:assert/strict";
import { test } from "node:test";

import {
  applyReferralVisitorCookie,
  getPartnerReferralAnalytics,
  hasPartnerReferralActivity,
  hashPartnerReferralVisitor,
  normalizePartnerAnalyticsRange,
  recordReferralClick,
} from "../src/lib/partner-referral-analytics.ts";
import { recordReferralConversionForCompany } from "../src/lib/partner-referral-conversions.ts";

process.env.PARTNER_PROGRAM_MODE = "on";

const now = new Date("2026-07-21T15:30:00.000Z");

test("analytics range and visitor hashes fail closed without exposing raw identifiers", () => {
  assert.equal(normalizePartnerAnalyticsRange(undefined), "30d");
  assert.equal(normalizePartnerAnalyticsRange("30d"), "30d");
  assert.equal(normalizePartnerAnalyticsRange("invalid"), "30d");
  const samePartnerHash = hashPartnerReferralVisitor("partner-1", "test-cookie-value");
  assert.equal(
    samePartnerHash,
    hashPartnerReferralVisitor("partner-1", "test-cookie-value"),
  );
  assert.notEqual(
    samePartnerHash,
    hashPartnerReferralVisitor("partner-2", "test-cookie-value"),
  );
  assert.match(samePartnerHash, /^[a-f0-9]{64}$/);
  assert.notEqual(samePartnerHash, "test-cookie-value");
});

test("seller conversion activity is not treated as an empty dashboard", () => {
  assert.equal(
    hasPartnerReferralActivity({
      totalClicks: 0,
      uniqueVisitors: 0,
      attributedSignups: 0,
      sellerRegistrations: 1,
      buyerRegistrations: 0,
    }),
    true,
  );
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

test("analytics totals use PostgreSQL aggregates, zero-filled UTC buckets, and zero denominator rates", async () => {
  let queryCount = 0;
  const db = {
    $queryRaw: async () => {
      const result = [
        [{ totalClicks: 6, uniqueVisitors: 2, firstActivity: new Date("2026-07-20T00:00:00.000Z") }],
        [{ attributedSignups: 1, firstActivity: new Date("2026-07-21T12:00:00.000Z") }],
        [{ sellerRegistrations: 1, buyerRegistrations: 1, firstActivity: new Date("2026-07-21T12:00:00.000Z") }],
        [
          { date: "2026-07-20", totalClicks: 3, uniqueVisitors: 1 },
          { date: "2026-07-21", totalClicks: 3, uniqueVisitors: 2 },
        ],
        [{ date: "2026-07-21", attributedSignups: 0, sellerRegistrations: 1, buyerRegistrations: 1 }],
        [{ date: "2026-07-21", attributedSignups: 1 }],
      ][queryCount++] ?? [];
      return result;
    },
    referralClickDailyVisitor: { upsert: async () => undefined },
    referralConversion: { upsert: async () => undefined },
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
  assert.equal(analytics.totals.sellerConversionRate, 50);
  assert.equal(analytics.totals.buyerConversionRate, 50);
  assert.equal(analytics.trafficSeries.length, 7);
  assert.equal(analytics.trafficSeries[5]?.totalClicks, 3);
  assert.equal(analytics.trafficSeries[6]?.totalClicks, 3);
  assert.equal(analytics.trafficSeries[6]?.uniqueVisitors, 2);
  assert.doesNotMatch(JSON.stringify(analytics), /visitorHash|visitor-a|visitor-b/);
  assert.equal(queryCount, 6);

  queryCount = 0;
  const empty = await getPartnerReferralAnalytics({
    db: {
      $queryRaw: async () => [],
      referralClickDailyVisitor: { upsert: async () => undefined },
      referralConversion: { upsert: async () => undefined },
    } as never,
    partnerProfileId: "partner-1",
    range: "30d",
    now,
  });
  assert.equal(empty.totals.signupConversionRate, 0);
  assert.equal(empty.totals.sellerConversionRate, 0);
  assert.equal(empty.totals.buyerConversionRate, 0);
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
