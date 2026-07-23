import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import {
  analyticsChartLabelIndices,
  analyticsPeriodContext,
  buildPartnerAnalyticsWorkspaceModel,
  compareAnalyticsValue,
  formatAnalyticsChartLabel,
  groupPartnerAnalyticsPoints,
  partnerAnalyticsMetrics,
  recommendedAnalyticsGrouping,
} from "../src/lib/partner-analytics-workspace.ts";
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
  assert.equal(normalizePartnerAnalyticsRange("12m"), "12m");
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
        [{ totalClicks: 3, uniqueVisitors: 1, firstActivity: new Date("2026-07-14T00:00:00.000Z") }],
        [{ attributedSignups: 1, firstActivity: new Date("2026-07-14T12:00:00.000Z") }],
        [{ sellerRegistrations: 0, buyerRegistrations: 0, firstActivity: null }],
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
  assert.equal(analytics.comparisonTotals.totalClicks, 3);
  assert.equal(analytics.comparisonTotals.uniqueVisitors, 1);
  assert.equal(analytics.comparisonTotals.signupConversionRate, 100);
  assert.equal(analytics.trafficSeries.length, 7);
  assert.equal(analytics.trafficSeries[5]?.totalClicks, 3);
  assert.equal(analytics.trafficSeries[6]?.totalClicks, 3);
  assert.equal(analytics.trafficSeries[6]?.uniqueVisitors, 2);
  assert.doesNotMatch(JSON.stringify(analytics), /visitorHash|visitor-a|visitor-b/);
  assert.equal(queryCount, 9);

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
  assert.equal(empty.comparisonTotals.totalClicks, 0);
  assert.equal(empty.trafficSeries.length, 30);
});

test("analytics raw aggregate queries preserve Prisma client context", async () => {
  let queryCount = 0;
  const db = {
    expectedContext: "transaction-client",
    async $queryRaw() {
      assert.equal(this.expectedContext, "transaction-client");
      const result = [
        [{ totalClicks: 1, uniqueVisitors: 1, firstActivity: new Date("2026-07-21T00:00:00.000Z") }],
        [{ attributedSignups: 0, firstActivity: null }],
        [{ sellerRegistrations: 0, buyerRegistrations: 0, firstActivity: null }],
        [{ date: "2026-07", totalClicks: 1, uniqueVisitors: 1 }],
        [],
        [],
      ][queryCount++] ?? [];
      return result;
    },
    referralClickDailyVisitor: { upsert: async () => undefined },
    referralConversion: { upsert: async () => undefined },
  };

  const analytics = await getPartnerReferralAnalytics({
    db: db as never,
    partnerProfileId: "partner-1",
    range: "all",
    now,
  });

  assert.equal(analytics.totals.totalClicks, 1);
  assert.equal(queryCount, 6);
});

test("unified partner analytics helpers provide safe comparison and grouped buckets", () => {
  assert.deepEqual(compareAnalyticsValue(0, 0), {
    status: "neutral",
    percentChange: null,
  });
  assert.deepEqual(compareAnalyticsValue(4, 0), {
    status: "new",
    percentChange: null,
  });
  assert.deepEqual(compareAnalyticsValue(15, 10), {
    status: "up",
    percentChange: 50,
  });

  const grouped = groupPartnerAnalyticsPoints(
    [
      {
        date: "2026-07-20",
        totalClicks: 3,
        uniqueVisitors: 2,
        attributedSignups: 1,
        sellerRegistrations: 1,
        buyerRegistrations: 0,
        signupConversionRate: 50,
        sellerConversionRate: 50,
        buyerConversionRate: 0,
      },
      {
        date: "2026-07-21",
        totalClicks: 7,
        uniqueVisitors: 3,
        attributedSignups: 2,
        sellerRegistrations: 0,
        buyerRegistrations: 1,
        signupConversionRate: 66.7,
        sellerConversionRate: 0,
        buyerConversionRate: 33.3,
      },
    ],
    "weekly",
  );
  assert.equal(grouped.length, 1);
  assert.equal(grouped[0]?.totalClicks, 10);
  assert.equal(grouped[0]?.uniqueVisitors, 5);
  assert.equal(grouped[0]?.signupConversionRate, 60);
});

test("analytics chart labels keep daily axes day-based with nearby period context", () => {
  assert.equal(formatAnalyticsChartLabel("2026-07-01", "daily", "en"), "1");
  assert.equal(formatAnalyticsChartLabel("2026-07-31", "daily", "ko"), "31");
  assert.equal(formatAnalyticsChartLabel("2026-07-06", "weekly", "en"), "Week of Jul 6");
  assert.equal(formatAnalyticsChartLabel("2026-07", "monthly", "en"), "Jul");
  assert.equal(
    analyticsPeriodContext(
      [{ date: "2026-07-01" }, { date: "2026-07-21" }],
      "daily",
      "en",
    ),
    "Jul 2026",
  );
  assert.equal(
    analyticsPeriodContext(
      [{ date: "2026-06-25" }, { date: "2026-07-21" }],
      "daily",
      "en",
    ),
    "Jun 2026 - Jul 2026",
  );
  assert.equal(analyticsPeriodContext([{ date: "2026-07" }], "monthly", "en"), null);
  assert.deepEqual([...analyticsChartLabelIndices(52, "weekly")], [0, 7, 14, 21, 28, 35, 42, 49, 51]);
});

test("analytics ranges choose contained defaults while manual grouping remains available", async () => {
  assert.equal(recommendedAnalyticsGrouping("7d"), "daily");
  assert.equal(recommendedAnalyticsGrouping("30d"), "daily");
  assert.equal(recommendedAnalyticsGrouping("90d"), "weekly");
  assert.equal(recommendedAnalyticsGrouping("12m"), "monthly");
  assert.equal(recommendedAnalyticsGrouping("all"), "monthly");
  assert.ok(analyticsChartLabelIndices(365, "daily").size < 365);

  const componentSource = await readFile(
    new URL("../src/components/partner-referral-analytics.tsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(componentSource, /minmax\(22px,\s*1fr\)/);
  assert.match(componentSource, /minmax\(0,\s*1fr\)/);
  assert.match(componentSource, /recommendedAnalyticsGrouping\(analytics\.range\)/);
  assert.match(componentSource, /setGrouping\(event\.target\.value as AnalyticsGrouping\)/);
  assert.match(componentSource, /w-full max-w-full min-w-0 overflow-hidden/);

  assert.equal(formatAnalyticsChartLabel("2026-08-01", "monthly", "en"), "Aug");
  assert.equal(
    formatAnalyticsChartLabel("2026-08-03", "weekly", "en"),
    "Week of Aug 3",
  );
});

test("partner and admin dashboards render the unified white analytics workspace", async () => {
  const analytics = {
    range: "30d" as const,
    totals: {
      totalClicks: 10,
      uniqueVisitors: 5,
      attributedSignups: 3,
      sellerRegistrations: 2,
      buyerRegistrations: 1,
      signupConversionRate: 60,
      sellerConversionRate: 40,
      buyerConversionRate: 20,
    },
    comparisonTotals: {
      totalClicks: 5,
      uniqueVisitors: 4,
      attributedSignups: 1,
      sellerRegistrations: 1,
      buyerRegistrations: 0,
      signupConversionRate: 25,
      sellerConversionRate: 25,
      buyerConversionRate: 0,
    },
    trafficSeries: [
      { date: "2026-07-20", totalClicks: 4, uniqueVisitors: 2 },
      { date: "2026-07-21", totalClicks: 6, uniqueVisitors: 3 },
    ],
    conversionSeries: [
      {
        date: "2026-07-20",
        attributedSignups: 1,
        sellerRegistrations: 1,
        buyerRegistrations: 0,
      },
      {
        date: "2026-07-21",
        attributedSignups: 2,
        sellerRegistrations: 1,
        buyerRegistrations: 1,
      },
    ],
  };
  const model = buildPartnerAnalyticsWorkspaceModel({
    analytics,
    qualifyingTransactions: 4,
    netCommissionAmount: 12345,
  });
  assert.equal(model.totals.qualifyingTransactions, 4);
  assert.equal(model.totals.netCommission, 12345);
  assert.equal(model.hasActivity, true);
  assert.equal(
    partnerAnalyticsMetrics.map((metric) => metric.value).includes("netCommission"),
    true,
  );

  const componentSource = await readFile(
    new URL("../src/components/partner-referral-analytics.tsx", import.meta.url),
    "utf8",
  );

  assert.match(componentSource, /data-testid="partner-analytics-workspace"/);
  assert.match(componentSource, /buildPartnerAnalyticsWorkspaceModel/);
  assert.match(componentSource, /setSelectedMetric/);
  assert.match(componentSource, /setGrouping/);
  assert.match(componentSource, /window\.location\.href = buildRangeHref/);
  assert.match(componentSource, /bg-white/);
  assert.match(componentSource, /border-zinc-200/);
  assert.match(componentSource, /partnerAnalyticsRangeOptions/);
  assert.doesNotMatch(componentSource, /trafficChart/);
  assert.doesNotMatch(componentSource, /conversionChart/);
  assert.doesNotMatch(componentSource, /StripeConnectOnboardingPanel/);
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
