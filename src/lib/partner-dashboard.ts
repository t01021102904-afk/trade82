import "server-only";

import {
  AccountDeletionStatus,
  PartnerPayoutProfileStatus,
  SettlementLegStatus,
  SettlementLegType,
  SettlementReversalStatus,
} from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { isPartnerProgramEnabled } from "@/lib/partner-program-feature";
import {
  getPartnerReferralAnalytics,
  normalizePartnerAnalyticsRange,
  type PartnerAnalyticsRange,
  type PartnerAnalyticsDatabase,
} from "@/lib/partner-referral-analytics";
import {
  partnerPayoutProfileAdminSummarySelect,
  partnerPayoutProfileOwnerSelect,
} from "@/lib/partner-payout-profiles";

const adjustmentStatuses: SettlementReversalStatus[] = [
  SettlementReversalStatus.ACCOUNTING_APPLIED,
  SettlementReversalStatus.PENDING,
  SettlementReversalStatus.COMPLETED,
];

type PartnerLeg = {
  id: string;
  amount: number;
  currency: string;
  status: SettlementLegStatus;
  holdUntil: Date;
  settlement: {
    createdAt: Date;
    grossAmount: number;
    tradeOrder: { orderNumber: string };
  };
  reversals: { amount: number; status: SettlementReversalStatus }[];
};

function adjustmentAmount(leg: Pick<PartnerLeg, "reversals">) {
  return leg.reversals
    .filter((reversal) => adjustmentStatuses.includes(reversal.status))
    .reduce((total, reversal) => total + reversal.amount, 0);
}

function netAmount(leg: PartnerLeg) {
  return Math.max(0, leg.amount - adjustmentAmount(leg));
}

export function partnerCommissionPresentation(leg: PartnerLeg) {
  const net = netAmount(leg);
  const adjustment = adjustmentAmount(leg);
  const usable = leg.status === SettlementLegStatus.READY ? net : 0;
  return {
    grossAmount: leg.amount,
    adjustmentAmount: adjustment,
    netAmount: net,
    usableAmount: usable,
    status: partnerLegStatus(leg.status),
  };
}

export function partnerLegStatus(status: SettlementLegStatus) {
  switch (status) {
    case SettlementLegStatus.PENDING:
    case SettlementLegStatus.HOLD:
      return "pending" as const;
    case SettlementLegStatus.READY:
      return "available" as const;
    case SettlementLegStatus.TRANSFER_PENDING:
      return "processing" as const;
    case SettlementLegStatus.TRANSFERRED:
      return "paid" as const;
    case SettlementLegStatus.REVERSAL_PENDING:
      return "under_review" as const;
    case SettlementLegStatus.REVERSED:
    case SettlementLegStatus.CANCELLED:
      return "cancelled" as const;
  }
}

export function partnerProfileStatus(status: string) {
  switch (status) {
    case "PENDING_REVIEW":
      return "pendingReview" as const;
    case "ACTIVE":
      return "active" as const;
    case "REJECTED":
      return "rejected" as const;
    default:
      return "suspended" as const;
  }
}

export function partnerPayoutSetupStatus(
  profile: { status: string } | null,
) {
  if (!profile) return "notStarted" as const;
  switch (profile.status) {
    case PartnerPayoutProfileStatus.VERIFIED:
      return "enabled" as const;
    case PartnerPayoutProfileStatus.PENDING_VERIFICATION:
      return "pending" as const;
    case PartnerPayoutProfileStatus.REJECTED:
      return "restricted" as const;
    case PartnerPayoutProfileStatus.DISABLED:
      return "disabled" as const;
    default:
      return "notStarted" as const;
  }
}

export function anonymizePartnerMember(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "Member";
  const first = Array.from(trimmed)[0] ?? "M";
  return `${first.toUpperCase()}.`;
}

function emptyPartnerAnalytics(range: PartnerAnalyticsRange) {
  return {
    range,
    totals: {
      totalClicks: 0,
      uniqueVisitors: 0,
      attributedSignups: 0,
      sellerRegistrations: 0,
      buyerRegistrations: 0,
      signupConversionRate: 0,
      sellerConversionRate: 0,
      buyerConversionRate: 0,
    },
    comparisonTotals: {
      totalClicks: 0,
      uniqueVisitors: 0,
      attributedSignups: 0,
      sellerRegistrations: 0,
      buyerRegistrations: 0,
      signupConversionRate: 0,
      sellerConversionRate: 0,
      buyerConversionRate: 0,
    },
    trafficSeries: [],
    conversionSeries: [],
  };
}

export async function getPartnerDashboardData({
  partnerProfileId,
  commissionPage = 1,
  memberPage = 1,
  pageSize = 20,
  analyticsRange = "30d",
  partnerProgramEnabled = isPartnerProgramEnabled(),
  allowSuspended = false,
  getDatabase = getDb,
}: {
  partnerProfileId: string;
  commissionPage?: number;
  memberPage?: number;
  pageSize?: number;
  analyticsRange?: unknown;
  partnerProgramEnabled?: boolean;
  allowSuspended?: boolean;
  getDatabase?: typeof getDb;
}) {
  // This guard is intentionally before getDb() so feature-off requests never
  // execute financial, member, or connected-account queries.
  if (!partnerProgramEnabled) return null;

  const db = getDatabase();
  const safeCommissionPage = Math.max(1, Math.floor(commissionPage));
  const safeMemberPage = Math.max(1, Math.floor(memberPage));
  const safePageSize = Math.min(50, Math.max(1, Math.floor(pageSize)));
  const safeAnalyticsRange = normalizePartnerAnalyticsRange(analyticsRange);
  const legWhere = {
    partnerProfileId,
    type: SettlementLegType.PARTNER_REFERRAL,
  };

  const partner = await db.partnerProfile.findFirst({
    where: {
      id: partnerProfileId,
      deletedAt: null,
      status: { in: ["PENDING_REVIEW", "ACTIVE", "SUSPENDED", "REJECTED"] },
    },
    include: {
      payoutProfile: {
        select: allowSuspended
          ? partnerPayoutProfileAdminSummarySelect
          : partnerPayoutProfileOwnerSelect,
      },
      user: { select: { displayName: true, email: true, preferredLanguage: true } },
    },
  });
  if (!partner) return null;

  const restrictedPartnerView = !allowSuspended
    && (partner.status === "PENDING_REVIEW" || partner.status === "REJECTED");
  const operationalData = restrictedPartnerView
    ? null
    : await Promise.all([
        db.referralAttribution.count({ where: { partnerProfileId } }),
        db.settlement.count({
          where: { referralPartnerProfileId: partnerProfileId },
        }),
        db.settlementLeg.findMany({
          where: legWhere,
          select: {
            id: true,
            amount: true,
            currency: true,
            status: true,
            holdUntil: true,
            settlement: {
              select: {
                createdAt: true,
                grossAmount: true,
                tradeOrder: { select: { orderNumber: true } },
              },
            },
            reversals: { select: { amount: true, status: true } },
          },
        }),
        db.settlementLeg.findMany({
          where: legWhere,
          orderBy: [{ settlement: { createdAt: "desc" } }, { id: "desc" }],
          take: safePageSize,
          skip: (safeCommissionPage - 1) * safePageSize,
          select: {
            id: true,
            amount: true,
            currency: true,
            status: true,
            holdUntil: true,
            settlement: {
              select: {
                createdAt: true,
                grossAmount: true,
                tradeOrder: { select: { orderNumber: true } },
              },
            },
            reversals: { select: { amount: true, status: true } },
          },
        }),
        db.referralAttribution.findMany({
          where: {
            partnerProfileId,
            referredUser: {
              deletedAt: null,
              deletionStatus: AccountDeletionStatus.ACTIVE,
            },
          },
          orderBy: [{ lockedAt: "desc" }, { id: "desc" }],
          take: safePageSize,
          skip: (safeMemberPage - 1) * safePageSize,
          select: {
            status: true,
            lockedAt: true,
            referredUser: { select: { displayName: true, role: true } },
            settlements: { select: { id: true }, take: 1 },
          },
        }),
        "referralClickDailyVisitor" in db && "$queryRaw" in db
          ? getPartnerReferralAnalytics({
              db: db as unknown as PartnerAnalyticsDatabase,
              partnerProfileId,
              range: safeAnalyticsRange,
            })
          : Promise.resolve(emptyPartnerAnalytics(safeAnalyticsRange)),
      ]);

  const referralCount = operationalData?.[0] ?? 0;
  const qualifyingTransactions = operationalData?.[1] ?? 0;
  const allLegs = (operationalData?.[2] ?? []) as PartnerLeg[];
  const commissionLegs = (operationalData?.[3] ?? []) as PartnerLeg[];
  const referredMembers = operationalData?.[4] ?? [];
  const analytics = operationalData?.[5] ?? emptyPartnerAnalytics(safeAnalyticsRange);
  const payoutProfile = !allowSuspended && partner.status === "REJECTED"
    ? null
    : partner.payoutProfile;

  // Unknown currencies are intentionally excluded from USD totals rather than
  // silently combining different money units. The history still exposes its
  // own currency for a future explicit currency-specific presentation.
  const usdLegs = allLegs.filter(
    (leg) => leg.currency === "usd",
  ) as PartnerLeg[];
  const totals = usdLegs.reduce(
    (summary, leg) => {
      const presentation = partnerCommissionPresentation(leg);
      summary.gross += presentation.grossAmount;
      summary.adjustments += presentation.adjustmentAmount;
      summary.net += presentation.netAmount;
      if (presentation.status === "pending")
        summary.pending += presentation.netAmount;
      if (presentation.status === "available")
        summary.available += presentation.usableAmount;
      if (presentation.status === "processing")
        summary.processing += presentation.netAmount;
      if (presentation.status === "paid")
        summary.paid += presentation.netAmount;
      if (presentation.status === "under_review")
        summary.underReview += presentation.netAmount;
      return summary;
    },
    {
      gross: 0,
      adjustments: 0,
      net: 0,
      pending: 0,
      available: 0,
      processing: 0,
      paid: 0,
      underReview: 0,
    },
  );

  return {
    partner: {
      id: partner.id,
      displayName: partner.displayName,
      legalName: partner.legalName,
      organizationName: partner.organizationName,
      contactEmail: partner.contactEmail ?? partner.user?.email ?? null,
      contactPhone: partner.contactPhone,
      country: partner.country,
      preferredLanguage:
        partner.preferredLanguage ?? partner.user?.preferredLanguage ?? null,
      websiteOrSocialUrl: partner.websiteOrSocialUrl,
      promotionDescription: partner.promotionDescription,
      status: partner.status,
      referralCode: partner.status === "ACTIVE" ? partner.referralCode : null,
      createdAt: partner.createdAt,
      payoutProfile,
    },
    totals: { ...totals, currency: "usd" as const },
    counts: { referredMembers: referralCount, qualifyingTransactions },
    analytics,
    commissionHistory: commissionLegs.map((leg) => ({
      transactionDate: leg.settlement.createdAt,
      orderNumber: leg.settlement.tradeOrder.orderNumber,
      grossTransactionAmount: leg.settlement.grossAmount,
      originalCommissionAmount: leg.amount,
      adjustmentAmount: adjustmentAmount(leg as PartnerLeg),
      netCommissionAmount: netAmount(leg as PartnerLeg),
      status: partnerLegStatus(leg.status),
      holdUntil: leg.holdUntil,
      currency: leg.currency,
    })),
    referredMembers: referredMembers.map((attribution) => ({
      name: anonymizePartnerMember(attribution.referredUser.displayName),
      role: attribution.referredUser.role,
      status: attribution.status,
      lockedAt: attribution.lockedAt,
      hasQualifyingSettlement: attribution.settlements.length > 0,
    })),
    commissionPagination: {
      page: safeCommissionPage,
      pageSize: safePageSize,
      totalPages: Math.max(1, Math.ceil(allLegs.length / safePageSize)),
      totalRows: allLegs.length,
    },
    memberPagination: {
      page: safeMemberPage,
      pageSize: safePageSize,
      totalPages: Math.max(1, Math.ceil(referralCount / safePageSize)),
      totalRows: referralCount,
    },
  };
}

export async function getAdminPartnerDashboardData({
  partnerProfileId,
  commissionPage = 1,
  memberPage = 1,
  pageSize = 20,
  analyticsRange = "30d",
}: {
  partnerProfileId: string;
  commissionPage?: number;
  memberPage?: number;
  pageSize?: number;
  analyticsRange?: unknown;
}) {
  return getPartnerDashboardData({
    partnerProfileId,
    commissionPage,
    memberPage,
    pageSize,
    analyticsRange,
    partnerProgramEnabled: true,
    allowSuspended: true,
  });
}
