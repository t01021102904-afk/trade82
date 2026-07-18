import "server-only";

import {
  SettlementLegStatus,
  SettlementLegType,
  SettlementReversalStatus,
} from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { isPartnerProgramEnabled } from "@/lib/partner-program-feature";

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
  return status === "ACTIVE" ? ("active" as const) : ("suspended" as const);
}

export function partnerPayoutSetupStatus(
  account: { status: string; onboardingComplete: boolean } | null,
) {
  if (!account) return "notStarted" as const;
  if (account.status === "DISABLED") return "disabled" as const;
  if (account.status === "ENABLED" && account.onboardingComplete)
    return "enabled" as const;
  if (account.status === "PENDING") return "pending" as const;
  return "restricted" as const;
}

export function anonymizePartnerMember(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "Member";
  const first = Array.from(trimmed)[0] ?? "M";
  return `${first.toUpperCase()}.`;
}

export async function getPartnerDashboardData({
  partnerProfileId,
  commissionPage = 1,
  memberPage = 1,
  pageSize = 20,
  partnerProgramEnabled = isPartnerProgramEnabled(),
  getDatabase = getDb,
}: {
  partnerProfileId: string;
  commissionPage?: number;
  memberPage?: number;
  pageSize?: number;
  partnerProgramEnabled?: boolean;
  getDatabase?: typeof getDb;
}) {
  // This guard is intentionally before getDb() so feature-off requests never
  // execute financial, member, or connected-account queries.
  if (!partnerProgramEnabled) return null;

  const db = getDatabase();
  const safeCommissionPage = Math.max(1, Math.floor(commissionPage));
  const safeMemberPage = Math.max(1, Math.floor(memberPage));
  const safePageSize = Math.min(50, Math.max(1, Math.floor(pageSize)));
  const legWhere = {
    partnerProfileId,
    type: SettlementLegType.PARTNER_REFERRAL,
  };

  const [
    partner,
    referralCount,
    qualifyingTransactions,
    allLegs,
    commissionLegs,
    referredMembers,
  ] = await Promise.all([
    db.partnerProfile.findUniqueOrThrow({
      where: { id: partnerProfileId },
      include: { stripeConnectedAccount: true },
    }),
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
      where: { partnerProfileId },
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
  ]);

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
      status: partner.status,
      referralCode: partner.referralCode,
      createdAt: partner.createdAt,
      stripeAccount: partner.stripeConnectedAccount
        ? {
            status: partner.stripeConnectedAccount.status,
            onboardingComplete:
              partner.stripeConnectedAccount.onboardingComplete,
          }
        : null,
    },
    totals: { ...totals, currency: "usd" as const },
    counts: { referredMembers: referralCount, qualifyingTransactions },
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
