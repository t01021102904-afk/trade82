import "server-only";

import { createHash, randomBytes } from "node:crypto";

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

export type PartnerAnalyticsDatabase = {
  partnerProfile: {
    findFirst: (
      args: unknown,
    ) => Promise<{ id: string; userId: string } | null>;
  };
  referralClickDailyVisitor: {
    upsert: (args: unknown) => Promise<unknown>;
    findMany: (args: unknown) => Promise<
      Array<{
        visitorHash: string;
        day: Date;
        clickCount: number;
      }>
    >;
  };
  referralAttribution: {
    findMany: (args: unknown) => Promise<Array<{ lockedAt: Date }>>;
  };
  referralConversion: {
    upsert: (args: unknown) => Promise<unknown>;
    findMany: (args: unknown) => Promise<
      Array<{
        subjectType: "BUYER" | "SELLER";
        convertedAt: Date;
      }>
    >;
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

function isPrefetch(request: Request) {
  return [
    request.headers.get("purpose"),
    request.headers.get("sec-purpose"),
    request.headers.get("x-middleware-prefetch"),
    request.headers.get("next-router-prefetch"),
  ].some((value) => value && /prefetch|prerender/i.test(value));
}

function isValidVisitorCookie(value: string | undefined): value is string {
  return Boolean(value && /^[A-Za-z0-9_-]{20,128}$/.test(value));
}

export function hashReferralVisitor(value: string) {
  return createHash("sha256").update(value).digest("hex");
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
  if (request.method !== "GET" || isPrefetch(request)) return null;

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
  const visitorHash = hashReferralVisitor(visitorCookie);
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

function inWindow(value: Date, start: Date | null, end: Date) {
  return (!start || value >= start) && value < end;
}

function percent(value: number, denominator: number) {
  return denominator === 0
    ? 0
    : Number(((value / denominator) * 100).toFixed(1));
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
  const clickWhere = {
    partnerProfileId,
    ...(window.start ? { day: { gte: window.start, lt: window.end } } : {}),
  };
  const [clicks, attributions, conversions] = await Promise.all([
    db.referralClickDailyVisitor.findMany({ where: clickWhere }),
    db.referralAttribution.findMany({
      where: {
        partnerProfileId,
        ...(window.start
          ? { lockedAt: { gte: window.start, lt: window.end } }
          : {}),
      },
      select: { lockedAt: true },
    }),
    db.referralConversion.findMany({
      where: {
        partnerProfileId,
        ...(window.start
          ? { convertedAt: { gte: window.start, lt: window.end } }
          : {}),
      },
      select: { subjectType: true, convertedAt: true },
    }),
  ]);

  const filteredClicks = clicks.filter((click) =>
    inWindow(click.day, window.start, window.end),
  );
  const filteredAttributions = window.start
    ? attributions
    : attributions.filter((item) => item.lockedAt < window.end);
  const filteredConversions = window.start
    ? conversions
    : conversions.filter((item) => item.convertedAt < window.end);
  const uniqueVisitors = new Set(
    filteredClicks.map((click) => click.visitorHash),
  ).size;
  const totalClicks = filteredClicks.reduce(
    (sum, click) => sum + click.clickCount,
    0,
  );
  const sellerRegistrations = filteredConversions.filter(
    (item) => item.subjectType === "SELLER",
  ).length;
  const buyerRegistrations = filteredConversions.filter(
    (item) => item.subjectType === "BUYER",
  ).length;
  const attributedSignups = filteredAttributions.length;

  const dates: string[] = [];
  if (range === "all") {
    const datesFound = [
      ...filteredClicks.map((item) => item.day),
      ...filteredAttributions.map((item) => item.lockedAt),
      ...filteredConversions.map((item) => item.convertedAt),
    ];
    if (datesFound.length) {
      const first = new Date(
        Math.min(...datesFound.map((dateValue) => dateValue.getTime())),
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

  const bucket = (value: Date) =>
    range === "all" ? monthKey(value) : dayKey(value);
  const traffic = new Map(
    dates.map((dateValue) => [
      dateValue,
      { totalClicks: 0, visitors: new Set<string>() },
    ]),
  );
  const conversion = new Map(
    dates.map((dateValue) => [
      dateValue,
      { attributedSignups: 0, sellerRegistrations: 0, buyerRegistrations: 0 },
    ]),
  );
  for (const click of filteredClicks) {
    const entry = traffic.get(bucket(click.day));
    if (entry) {
      entry.totalClicks += click.clickCount;
      entry.visitors.add(click.visitorHash);
    }
  }
  for (const attribution of filteredAttributions) {
    const entry = conversion.get(bucket(attribution.lockedAt));
    if (entry) entry.attributedSignups += 1;
  }
  for (const item of filteredConversions) {
    const entry = conversion.get(bucket(item.convertedAt));
    if (!entry) continue;
    if (item.subjectType === "SELLER") entry.sellerRegistrations += 1;
    if (item.subjectType === "BUYER") entry.buyerRegistrations += 1;
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
      const entry = traffic.get(dateValue);
      return {
        date: dateValue,
        totalClicks: entry?.totalClicks ?? 0,
        uniqueVisitors: entry?.visitors.size ?? 0,
      };
    }),
    conversionSeries: dates.map((dateValue) => ({
      date: dateValue,
      ...(conversion.get(dateValue) ?? {
        attributedSignups: 0,
        sellerRegistrations: 0,
        buyerRegistrations: 0,
      }),
    })),
  };
}
