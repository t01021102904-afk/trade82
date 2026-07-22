import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { Prisma } from "@/generated/prisma/client";
import { isPartnerProgramEnabled } from "@/lib/partner-program-feature";
import { normalizeReferralCode } from "@/lib/partner-referrals";

export const REFERRAL_VISITOR_COOKIE = "trade82_referral_visitor";
const VISITOR_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;
const DAY_MS = 24 * 60 * 60 * 1000;

export type PartnerAnalyticsRange = "7d" | "30d" | "90d" | "all";

export type PartnerReferralAnalytics = {
  range: PartnerAnalyticsRange;
  totals: {
    totalClicks: number;
    uniqueVisitors: number;
    attributedSignups: number;
    sellerRegistrations: number;
    buyerRegistrations: number;
    signupConversionRate: number;
    sellerConversionRate: number;
    buyerConversionRate: number;
  };
  trafficSeries: Array<{
    date: string;
    totalClicks: number;
    uniqueVisitors: number;
  }>;
  conversionSeries: Array<{
    date: string;
    attributedSignups: number;
    sellerRegistrations: number;
    buyerRegistrations: number;
  }>;
};

export function hasPartnerReferralActivity(
  totals: Pick<
    PartnerReferralAnalytics["totals"],
    | "totalClicks"
    | "uniqueVisitors"
    | "attributedSignups"
    | "sellerRegistrations"
    | "buyerRegistrations"
  >,
) {
  return (
    totals.totalClicks > 0 ||
    totals.uniqueVisitors > 0 ||
    totals.attributedSignups > 0 ||
    totals.sellerRegistrations > 0 ||
    totals.buyerRegistrations > 0
  );
}

export type PartnerAnalyticsDatabase = {
  $queryRaw?: <T>(query: unknown) => Promise<T>;
  partnerProfile: {
    findFirst: (
      args: unknown,
    ) => Promise<{ id: string; userId: string } | null>;
  };
  referralClickDailyVisitor: {
    upsert: (args: unknown) => Promise<unknown>;
  };
  referralConversion: {
    upsert: (args: unknown) => Promise<unknown>;
  };
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function utcDay(value: Date) {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

function dayKey(value: Date) {
  return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
}

function monthKey(value: Date) {
  return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}`;
}

export function normalizePartnerAnalyticsRange(
  value: unknown,
): PartnerAnalyticsRange {
  return value === "7d" || value === "90d" || value === "all" ? value : "30d";
}

function parseCookies(header: string | null) {
  const cookies = new Map<string, string>();
  for (const part of (header ?? "").split(";")) {
    const separator = part.indexOf("=");
    if (separator < 1) continue;
    cookies.set(
      part.slice(0, separator).trim(),
      part.slice(separator + 1).trim(),
    );
  }
  return cookies;
}

export function isReferralPrefetchRequest(request: Request) {
  const middlewarePrefetch = request.headers.get("x-middleware-prefetch");
  return Boolean(middlewarePrefetch) || [
    request.headers.get("purpose"),
    request.headers.get("sec-purpose"),
    request.headers.get("next-router-prefetch"),
  ].some((value) => value && /prefetch|prerender/i.test(value));
}

function isValidVisitorCookie(value: string | undefined): value is string {
  return Boolean(value && /^[A-Za-z0-9_-]{20,128}$/.test(value));
}

export function hashPartnerReferralVisitor(
  partnerProfileId: string,
  rawVisitorCookie: string,
) {
  return createHash("sha256")
    .update(`${partnerProfileId}:${rawVisitorCookie}`, "utf8")
    .digest("hex");
}

export async function recordReferralClick({
  db,
  request,
  referralCode,
  authenticatedUserProfileId,
  now = new Date(),
}: {
  db: PartnerAnalyticsDatabase;
  request: Request;
  referralCode: string;
  authenticatedUserProfileId?: string | null;
  now?: Date;
}) {
  if (
    request.method !== "GET" ||
    isReferralPrefetchRequest(request) ||
    !isPartnerProgramEnabled()
  ) {
    return null;
  }

  const normalizedReferralCode = normalizeReferralCode(referralCode);
  if (!normalizedReferralCode) return null;

  const partner = await db.partnerProfile.findFirst({
    where: {
      referralCode: normalizedReferralCode,
      status: "ACTIVE",
      deletedAt: null,
    },
    select: { id: true, userId: true },
  });
  if (!partner || partner.userId === authenticatedUserProfileId) return null;

  const cookies = parseCookies(request.headers.get("cookie"));
  const existing = cookies.get(REFERRAL_VISITOR_COOKIE);
  const visitorCookie = isValidVisitorCookie(existing)
    ? existing
    : randomBytes(32).toString("base64url");
  const visitorHash = hashPartnerReferralVisitor(partner.id, visitorCookie);
  const day = utcDay(now);

  await db.referralClickDailyVisitor.upsert({
    where: {
      partnerProfileId_visitorHash_day: {
        partnerProfileId: partner.id,
        visitorHash,
        day,
      },
    },
    create: {
      partnerProfileId: partner.id,
      visitorHash,
      day,
      clickCount: 1,
      firstClickedAt: now,
      lastClickedAt: now,
    },
    update: {
      clickCount: { increment: 1 },
      lastClickedAt: now,
    },
  });

  return { value: visitorCookie };
}

export function applyReferralVisitorCookie(
  response: Response,
  value: string | null,
) {
  if (!value || !(response instanceof Response)) return;
  const cookie = [
    `${REFERRAL_VISITOR_COOKIE}=${value}`,
    "Path=/",
    `Max-Age=${VISITOR_COOKIE_MAX_AGE}`,
    "HttpOnly",
    "SameSite=Lax",
    ...(process.env.NODE_ENV === "production" ? ["Secure"] : []),
  ].join("; ");
  response.headers.append("Set-Cookie", cookie);
}

function rangeWindow(range: PartnerAnalyticsRange, now: Date) {
  const end = new Date(utcDay(now).getTime() + DAY_MS);
  if (range === "all") return { start: null, end };
  const days = range === "7d" ? 7 : range === "90d" ? 90 : 30;
  return { start: new Date(end.getTime() - days * DAY_MS), end };
}

function percent(value: number, denominator: number) {
  return denominator === 0
    ? 0
    : Number(((value / denominator) * 100).toFixed(1));
}

type ClickSummaryRow = {
  totalClicks: bigint | number;
  uniqueVisitors: bigint | number;
  firstActivity: Date | string | null;
};

type AttributionSummaryRow = {
  attributedSignups: bigint | number;
  firstActivity: Date | string | null;
};

type ConversionSummaryRow = {
  sellerRegistrations: bigint | number;
  buyerRegistrations: bigint | number;
  firstActivity: Date | string | null;
};

type TrafficBucketRow = {
  date: string;
  totalClicks: bigint | number;
  uniqueVisitors: bigint | number;
};

type ConversionBucketRow = {
  date: string;
  attributedSignups: bigint | number;
  sellerRegistrations: bigint | number;
  buyerRegistrations: bigint | number;
};

function numberValue(value: bigint | number | null | undefined) {
  return typeof value === "bigint" ? Number(value) : Number(value ?? 0);
}

function dateValue(value: Date | string | null) {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

export async function getPartnerReferralAnalytics({
  db,
  partnerProfileId,
  range: inputRange = "30d",
  now = new Date(),
}: {
  db: PartnerAnalyticsDatabase;
  partnerProfileId: string;
  range?: unknown;
  now?: Date;
}) {
  const range = normalizePartnerAnalyticsRange(inputRange);
  const window = rangeWindow(range, now);
  if (!db.$queryRaw) {
    throw new Error("Partner analytics aggregation requires PostgreSQL.");
  }

  const clickFilter = Prisma.sql`
    "partnerProfileId" = ${partnerProfileId}
    AND "day" < ${window.end}::timestamptz::date
    AND (${window.start}::timestamptz IS NULL OR "day" >= ${window.start}::timestamptz::date)
  `;
  const attributionFilter = Prisma.sql`
    "partnerProfileId" = ${partnerProfileId}
    AND "lockedAt" < ${window.end}
    AND (${window.start}::timestamptz IS NULL OR "lockedAt" >= ${window.start})
  `;
  const conversionFilter = Prisma.sql`
    "partnerProfileId" = ${partnerProfileId}
    AND "convertedAt" < ${window.end}
    AND (${window.start}::timestamptz IS NULL OR "convertedAt" >= ${window.start})
  `;

  const [clickSummaryRows, attributionSummaryRows, conversionSummaryRows] =
    await Promise.all([
      db.$queryRaw<ClickSummaryRow[]>(Prisma.sql`
        SELECT
          COALESCE(SUM("clickCount"), 0)::bigint AS "totalClicks",
          COUNT(DISTINCT "visitorHash")::bigint AS "uniqueVisitors",
          MIN("day") AS "firstActivity"
        FROM "ReferralClickDailyVisitor"
        WHERE ${clickFilter}
      `),
      db.$queryRaw<AttributionSummaryRow[]>(Prisma.sql`
        SELECT
          COUNT(*)::bigint AS "attributedSignups",
          MIN("lockedAt") AS "firstActivity"
        FROM "ReferralAttribution"
        WHERE ${attributionFilter}
      `),
      db.$queryRaw<ConversionSummaryRow[]>(Prisma.sql`
        SELECT
          COUNT(*) FILTER (WHERE "subjectType" = 'SELLER'::"ReferralSubjectType")::bigint AS "sellerRegistrations",
          COUNT(*) FILTER (WHERE "subjectType" = 'BUYER'::"ReferralSubjectType")::bigint AS "buyerRegistrations",
          MIN("convertedAt") AS "firstActivity"
        FROM "ReferralConversion"
        WHERE ${conversionFilter}
      `),
    ]);

  const clickSummary = clickSummaryRows[0] ?? {
    totalClicks: 0,
    uniqueVisitors: 0,
    firstActivity: null,
  };
  const attributionSummary = attributionSummaryRows[0] ?? {
    attributedSignups: 0,
    firstActivity: null,
  };
  const conversionSummary = conversionSummaryRows[0] ?? {
    sellerRegistrations: 0,
    buyerRegistrations: 0,
    firstActivity: null,
  };
  const totalClicks = numberValue(clickSummary.totalClicks);
  const uniqueVisitors = numberValue(clickSummary.uniqueVisitors);
  const attributedSignups = numberValue(attributionSummary.attributedSignups);
  const sellerRegistrations = numberValue(conversionSummary.sellerRegistrations);
  const buyerRegistrations = numberValue(conversionSummary.buyerRegistrations);

  const trafficBucketRows =
    range === "all"
      ? await db.$queryRaw<TrafficBucketRow[]>(Prisma.sql`
          SELECT
            to_char(date_trunc('month', "day"::timestamp), 'YYYY-MM') AS date,
            COALESCE(SUM("clickCount"), 0)::bigint AS "totalClicks",
            COUNT(DISTINCT "visitorHash")::bigint AS "uniqueVisitors"
          FROM "ReferralClickDailyVisitor"
          WHERE ${clickFilter}
          GROUP BY 1
          ORDER BY 1
        `)
      : await db.$queryRaw<TrafficBucketRow[]>(Prisma.sql`
          SELECT
            to_char(date_trunc('day', "day"::timestamp), 'YYYY-MM-DD') AS date,
            COALESCE(SUM("clickCount"), 0)::bigint AS "totalClicks",
            COUNT(DISTINCT "visitorHash")::bigint AS "uniqueVisitors"
          FROM "ReferralClickDailyVisitor"
          WHERE ${clickFilter}
          GROUP BY 1
          ORDER BY 1
        `);
  const conversionBucketRows =
    range === "all"
      ? await db.$queryRaw<ConversionBucketRow[]>(Prisma.sql`
          SELECT
            to_char(date_trunc('month', "convertedAt" AT TIME ZONE 'UTC'), 'YYYY-MM') AS date,
            0::bigint AS "attributedSignups",
            COUNT(*) FILTER (WHERE "subjectType" = 'SELLER'::"ReferralSubjectType")::bigint AS "sellerRegistrations",
            COUNT(*) FILTER (WHERE "subjectType" = 'BUYER'::"ReferralSubjectType")::bigint AS "buyerRegistrations"
          FROM "ReferralConversion"
          WHERE ${conversionFilter}
          GROUP BY 1
          ORDER BY 1
        `)
      : await db.$queryRaw<ConversionBucketRow[]>(Prisma.sql`
          SELECT
            to_char(date_trunc('day', "convertedAt" AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS date,
            0::bigint AS "attributedSignups",
            COUNT(*) FILTER (WHERE "subjectType" = 'SELLER'::"ReferralSubjectType")::bigint AS "sellerRegistrations",
            COUNT(*) FILTER (WHERE "subjectType" = 'BUYER'::"ReferralSubjectType")::bigint AS "buyerRegistrations"
          FROM "ReferralConversion"
          WHERE ${conversionFilter}
          GROUP BY 1
          ORDER BY 1
        `);

  const attributionBucketRows =
    range === "all"
      ? await db.$queryRaw<Array<{ date: string; attributedSignups: bigint | number }>>(Prisma.sql`
          SELECT
            to_char(date_trunc('month', "lockedAt" AT TIME ZONE 'UTC'), 'YYYY-MM') AS date,
            COUNT(*)::bigint AS "attributedSignups"
          FROM "ReferralAttribution"
          WHERE ${attributionFilter}
          GROUP BY 1
          ORDER BY 1
        `)
      : await db.$queryRaw<Array<{ date: string; attributedSignups: bigint | number }>>(Prisma.sql`
          SELECT
            to_char(date_trunc('day', "lockedAt" AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS date,
            COUNT(*)::bigint AS "attributedSignups"
          FROM "ReferralAttribution"
          WHERE ${attributionFilter}
          GROUP BY 1
          ORDER BY 1
        `);

  const dates: string[] = [];
  if (range === "all") {
    const datesFound = [
      dateValue(clickSummary.firstActivity),
      dateValue(attributionSummary.firstActivity),
      dateValue(conversionSummary.firstActivity),
    ].filter((value): value is Date => value instanceof Date);
    if (datesFound.length) {
      const first = new Date(
        Math.min(...datesFound.map((dateItem) => dateItem.getTime())),
      );
      const cursor = new Date(
        Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1),
      );
      while (cursor < window.end) {
        dates.push(monthKey(cursor));
        cursor.setUTCMonth(cursor.getUTCMonth() + 1);
      }
    }
  } else {
    const cursor = new Date(window.start ?? window.end);
    while (cursor < window.end) {
      dates.push(dayKey(cursor));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  const trafficByDate = new Map(
    trafficBucketRows.map((row) => [
      row.date,
      {
        totalClicks: numberValue(row.totalClicks),
        uniqueVisitors: numberValue(row.uniqueVisitors),
      },
    ]),
  );
  const conversionByDate = new Map(
    conversionBucketRows.map((row) => [
      row.date,
      {
        attributedSignups: 0,
        sellerRegistrations: numberValue(row.sellerRegistrations),
        buyerRegistrations: numberValue(row.buyerRegistrations),
      },
    ]),
  );
  for (const row of attributionBucketRows) {
    const entry = conversionByDate.get(row.date) ?? {
      attributedSignups: 0,
      sellerRegistrations: 0,
      buyerRegistrations: 0,
    };
    entry.attributedSignups = numberValue(row.attributedSignups);
    conversionByDate.set(row.date, entry);
  }

  return {
    range,
    totals: {
      totalClicks,
      uniqueVisitors,
      attributedSignups,
      sellerRegistrations,
      buyerRegistrations,
      signupConversionRate: percent(attributedSignups, uniqueVisitors),
      sellerConversionRate: percent(sellerRegistrations, uniqueVisitors),
      buyerConversionRate: percent(buyerRegistrations, uniqueVisitors),
    },
    trafficSeries: dates.map((dateValue) => {
      return {
        date: dateValue,
        totalClicks: trafficByDate.get(dateValue)?.totalClicks ?? 0,
        uniqueVisitors: trafficByDate.get(dateValue)?.uniqueVisitors ?? 0,
      };
    }),
    conversionSeries: dates.map((dateValue) => ({
      date: dateValue,
      ...(conversionByDate.get(dateValue) ?? {
        attributedSignups: 0,
        sellerRegistrations: 0,
        buyerRegistrations: 0,
      }),
    })),
  };
}
