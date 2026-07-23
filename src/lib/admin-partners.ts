import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import {
  normalizePartnerAnalyticsRange,
  type PartnerAnalyticsRange,
} from "@/lib/partner-referral-analytics";

export const ADMIN_PARTNER_DEFAULT_PAGE_SIZE = 25;
export const ADMIN_PARTNER_MAX_PAGE_SIZE = 50;

const statuses = ["all", "pending_review", "active", "suspended", "rejected"] as const;
const payoutSetups = [
  "all",
  "notStarted",
  "pending",
  "enabled",
  "restricted",
  "disabled",
] as const;
const sorts = [
  "newest",
  "oldest",
  "clicks",
  "uniqueVisitors",
  "signups",
  "sellerRegistrations",
  "buyerRegistrations",
  "netCommission",
] as const;

export type AdminPartnerStatusFilter = (typeof statuses)[number];
export type AdminPartnerPayoutFilter = (typeof payoutSetups)[number];
export type AdminPartnerSort = (typeof sorts)[number];

export type AdminPartnerListQuery = {
  search: string;
  status: AdminPartnerStatusFilter;
  country: string | null;
  payoutSetup: AdminPartnerPayoutFilter;
  sort: AdminPartnerSort;
  page: number;
  pageSize: number;
};

export type AdminPartnerListRow = {
  id: string;
  displayName: string | null;
  legalName: string | null;
  organizationName: string | null;
  contactEmail: string | null;
  country: string | null;
  preferredLanguage: string | null;
  status: string;
  createdAt: Date;
  linkVisits: number;
  uniqueVisitors: number;
  attributedSignups: number;
  sellerRegistrations: number;
  buyerRegistrations: number;
  qualifyingTransactions: number;
  netCommissionUsd: number;
  hasNonUsdCommission: boolean;
  payoutSetup: AdminPartnerPayoutFilter;
};

export type AdminPartnerListData = {
  rows: AdminPartnerListRow[];
  total: number;
  page: number;
  pageSize: number;
  countries: string[];
  invalidPage: boolean;
};

export type AdminPartnerDetailQuery = {
  analyticsRange: PartnerAnalyticsRange;
  commissionPage: number;
  memberPage: number;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function enumValue<T extends readonly string[]>(
  value: string | undefined,
  allowed: T,
  fallback: T[number],
) {
  return value && (allowed as readonly string[]).includes(value)
    ? (value as T[number])
    : fallback;
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function parseAdminPartnerListQuery(
  input: Record<string, string | string[] | undefined>,
): AdminPartnerListQuery {
  const rawSearch = firstValue(input.search)?.trim() ?? "";
  const rawCountry = firstValue(input.country)?.trim() ?? "";
  const pageSize = Math.min(
    ADMIN_PARTNER_MAX_PAGE_SIZE,
    positiveInteger(
      firstValue(input.pageSize),
      ADMIN_PARTNER_DEFAULT_PAGE_SIZE,
    ),
  );

  return {
    search: rawSearch.slice(0, 100),
    status: enumValue(firstValue(input.status), statuses, "all"),
    country: rawCountry ? rawCountry.slice(0, 100) : null,
    payoutSetup: enumValue(
      firstValue(input.payoutSetup),
      payoutSetups,
      "all",
    ),
    sort: enumValue(firstValue(input.sort), sorts, "newest"),
    page: positiveInteger(firstValue(input.page), 1),
    pageSize,
  };
}

export function parseAdminPartnerDetailQuery(
  input: Record<string, string | string[] | undefined>,
): AdminPartnerDetailQuery {
  return {
    analyticsRange: normalizePartnerAnalyticsRange(firstValue(input.analyticsRange)),
    commissionPage: positiveInteger(firstValue(input.commissionPage), 1),
    memberPage: positiveInteger(firstValue(input.memberPage), 1),
  };
}

const payoutSetupExpression = Prisma.sql`
  CASE
    WHEN pp."id" IS NULL THEN 'notStarted'
    WHEN pp."status" = 'DISABLED' THEN 'disabled'
    WHEN pp."status" = 'VERIFIED' THEN 'enabled'
    WHEN pp."status" = 'PENDING_VERIFICATION' THEN 'pending'
    WHEN pp."status" = 'REJECTED' THEN 'restricted'
    ELSE 'restricted'
  END
`;

function buildFilters(query: AdminPartnerListQuery) {
  const filters = [Prisma.sql`p."deletedAt" IS NULL`];

  if (query.status !== "all") {
    filters.push(Prisma.sql`p."status" = ${query.status.toUpperCase()}`);
  }
  if (query.country) {
    filters.push(Prisma.sql`p."country" = ${query.country}`);
  }
  if (query.payoutSetup !== "all") {
    filters.push(Prisma.sql`${payoutSetupExpression} = ${query.payoutSetup}`);
  }
  if (query.search) {
    const search = `%${query.search}%`;
    filters.push(Prisma.sql`(
      p."displayName" ILIKE ${search}
      OR p."legalName" ILIKE ${search}
      OR p."organizationName" ILIKE ${search}
      OR p."contactEmail" ILIKE ${search}
      OR u."email" ILIKE ${search}
      OR p."referralCode" ILIKE ${search}
    )`);
  }

  return Prisma.join(filters, " AND ");
}

const sortExpressions: Record<AdminPartnerSort, string> = {
  newest: 'p."createdAt" DESC, p."id" DESC',
  oldest: 'p."createdAt" ASC, p."id" ASC',
  clicks: 'COALESCE(click_stats."linkVisits", 0) DESC, p."createdAt" DESC, p."id" DESC',
  uniqueVisitors: 'COALESCE(click_stats."uniqueVisitors", 0) DESC, p."createdAt" DESC, p."id" DESC',
  signups: 'COALESCE(attribution_stats."attributedSignups", 0) DESC, p."createdAt" DESC, p."id" DESC',
  sellerRegistrations: 'COALESCE(conversion_stats."sellerRegistrations", 0) DESC, p."createdAt" DESC, p."id" DESC',
  buyerRegistrations: 'COALESCE(conversion_stats."buyerRegistrations", 0) DESC, p."createdAt" DESC, p."id" DESC',
  netCommission: 'COALESCE(commission_stats."netCommissionUsd", 0) DESC, p."createdAt" DESC, p."id" DESC',
};

function numberValue(value: bigint | number | null | undefined) {
  return typeof value === "bigint" ? Number(value) : Number(value ?? 0);
}

function payoutFilter(value: string): AdminPartnerPayoutFilter {
  return (payoutSetups as readonly string[]).includes(value)
    ? (value as AdminPartnerPayoutFilter)
    : "restricted";
}

export async function getAdminPartnerListData(
  query: AdminPartnerListQuery,
  getDatabase: typeof getDb = getDb,
): Promise<AdminPartnerListData> {
  const db = getDatabase();
  const where = buildFilters(query);
  const offset = (query.page - 1) * query.pageSize;

  const [rows, countRows, countryRows] = await Promise.all([
    db.$queryRaw<AdminPartnerListRow[]>(Prisma.sql`
      WITH click_stats AS (
        SELECT
          d."partnerProfileId",
          COALESCE(SUM(d."clickCount"), 0)::bigint AS "linkVisits",
          COUNT(DISTINCT d."visitorHash")::bigint AS "uniqueVisitors"
        FROM "ReferralClickDailyVisitor" d
        GROUP BY d."partnerProfileId"
      ),
      attribution_stats AS (
        SELECT "partnerProfileId", COUNT(*)::bigint AS "attributedSignups"
        FROM "ReferralAttribution" a
        GROUP BY "partnerProfileId"
      ),
      conversion_stats AS (
        SELECT
          "partnerProfileId",
          COUNT(*) FILTER (WHERE "subjectType" = 'SELLER')::bigint AS "sellerRegistrations",
          COUNT(*) FILTER (WHERE "subjectType" = 'BUYER')::bigint AS "buyerRegistrations"
        FROM "ReferralConversion" c
        GROUP BY "partnerProfileId"
      ),
      qualifying_stats AS (
        SELECT "referralPartnerProfileId" AS "partnerProfileId", COUNT(*)::bigint AS "qualifyingTransactions"
        FROM "Settlement"
        WHERE "referralPartnerProfileId" IS NOT NULL
        GROUP BY "referralPartnerProfileId"
      ),
      commission_stats AS (
        SELECT
          legs."partnerProfileId",
          COALESCE(SUM(legs."netAmount") FILTER (WHERE legs."currency" = 'usd'), 0)::bigint AS "netCommissionUsd",
          BOOL_OR(legs."currency" <> 'usd') AS "hasNonUsdCommission"
        FROM (
          SELECT
            sl."partnerProfileId",
            sl."currency",
            GREATEST(0, sl."amount" - COALESCE((
              SELECT SUM(sr."amount")
              FROM "SettlementReversal" sr
              WHERE sr."settlementLegId" = sl."id"
                AND sr."status" IN ('ACCOUNTING_APPLIED', 'PENDING', 'COMPLETED')
            ), 0)) AS "netAmount"
          FROM "SettlementLeg" sl
          WHERE sl."type" = 'PARTNER_REFERRAL'
            AND sl."partnerProfileId" IS NOT NULL
        ) legs
        GROUP BY legs."partnerProfileId"
      )
      SELECT
        p."id",
        p."displayName",
        p."legalName",
        p."organizationName",
        COALESCE(p."contactEmail", u."email") AS "contactEmail",
        p."country",
        p."preferredLanguage",
        p."status",
        p."createdAt",
        COALESCE(click_stats."linkVisits", 0)::bigint AS "linkVisits",
        COALESCE(click_stats."uniqueVisitors", 0)::bigint AS "uniqueVisitors",
        COALESCE(attribution_stats."attributedSignups", 0)::bigint AS "attributedSignups",
        COALESCE(conversion_stats."sellerRegistrations", 0)::bigint AS "sellerRegistrations",
        COALESCE(conversion_stats."buyerRegistrations", 0)::bigint AS "buyerRegistrations",
        COALESCE(qualifying_stats."qualifyingTransactions", 0)::bigint AS "qualifyingTransactions",
        COALESCE(commission_stats."netCommissionUsd", 0)::bigint AS "netCommissionUsd",
        COALESCE(commission_stats."hasNonUsdCommission", false) AS "hasNonUsdCommission",
        ${payoutSetupExpression} AS "payoutSetup"
      FROM "PartnerProfile" p
      JOIN "UserProfile" u ON u."id" = p."userId"
      LEFT JOIN "PartnerPayoutProfile" pp ON pp."partnerProfileId" = p."id"
      LEFT JOIN click_stats ON click_stats."partnerProfileId" = p."id"
      LEFT JOIN attribution_stats ON attribution_stats."partnerProfileId" = p."id"
      LEFT JOIN conversion_stats ON conversion_stats."partnerProfileId" = p."id"
      LEFT JOIN qualifying_stats ON qualifying_stats."partnerProfileId" = p."id"
      LEFT JOIN commission_stats ON commission_stats."partnerProfileId" = p."id"
      WHERE ${where}
      ORDER BY ${Prisma.raw(sortExpressions[query.sort])}
      LIMIT ${query.pageSize}
      OFFSET ${offset}
    `),
    db.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM "PartnerProfile" p
      JOIN "UserProfile" u ON u."id" = p."userId"
      LEFT JOIN "PartnerPayoutProfile" pp ON pp."partnerProfileId" = p."id"
      WHERE ${where}
    `),
    db.partnerProfile.findMany({
      where: {
        deletedAt: null,
        status: { in: ["PENDING_REVIEW", "ACTIVE", "SUSPENDED", "REJECTED"] },
        country: { not: null },
      },
      distinct: ["country"],
      orderBy: { country: "asc" },
      select: { country: true },
    }),
  ]);

  return {
    rows: rows.map((row) => ({
      ...row,
      linkVisits: numberValue(row.linkVisits),
      uniqueVisitors: numberValue(row.uniqueVisitors),
      attributedSignups: numberValue(row.attributedSignups),
      sellerRegistrations: numberValue(row.sellerRegistrations),
      buyerRegistrations: numberValue(row.buyerRegistrations),
      qualifyingTransactions: numberValue(row.qualifyingTransactions),
      netCommissionUsd: numberValue(row.netCommissionUsd),
      payoutSetup: payoutFilter(String(row.payoutSetup)),
    })),
    total: numberValue(countRows[0]?.count),
    page: query.page,
    pageSize: query.pageSize,
    invalidPage:
      query.page > 1 &&
      numberValue(countRows[0]?.count) > 0 &&
      rows.length === 0,
    countries: countryRows
      .map((row) => row.country)
      .filter((country): country is string => Boolean(country)),
  };
}
