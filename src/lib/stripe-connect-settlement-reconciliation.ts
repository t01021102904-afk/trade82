import "server-only";

import {
  PaymentRequestStatus,
  Prisma,
  SettlementEventType,
  SettlementLegStatus,
  SettlementLegType,
  SettlementReversalReason,
  SettlementReversalSourceType,
  SettlementReversalStatus,
  SettlementStatus,
} from "@/generated/prisma/client";
import { calculateStripeConnectSettlementFinancials } from "@/lib/stripe-connect-settlement-financials";
import { isStripeConnectSettlementLedgerEnabled } from "@/lib/stripe-connect-settlement-feature";

type Tx = Prisma.TransactionClient;

type ReconciliationSource = {
  paymentRequestId: string;
  stripeSourceId: string;
  stripeEventId: string;
  stripeEventType: string;
  stripeEventCreatedAt: Date;
};

type DisputeReconciliationSource = ReconciliationSource & {
  disputeStatus: string;
  disputeAmount: number;
  disputeCurrency: string;
};

type EconomicLossSource = ReconciliationSource & {
  reason: SettlementReversalReason;
  disputeStatus?: string;
  disputeAmount?: number;
  disputeCurrency?: string;
};

function isInFlightOrTransferred(status: SettlementLegStatus) {
  return (
    status === SettlementLegStatus.TRANSFER_PENDING
    || status === SettlementLegStatus.TRANSFERRED
    || status === SettlementLegStatus.REVERSAL_PENDING
  );
}

function isTransferableLeg(type: SettlementLegType) {
  return type === SettlementLegType.SELLER_PAYABLE || type === SettlementLegType.PARTNER_REFERRAL;
}

function isFullEconomicLoss(refundAmount: number, grossAmount: number) {
  return refundAmount >= grossAmount;
}

function disputeIsLoss(status: string) {
  return status === "lost" || status === "charge_refunded";
}

function disputeRestoresEligibility(status: string) {
  return ["won", "prevented", "warning_closed"].includes(status);
}

function disputeAuditMetadata(source: DisputeReconciliationSource): Prisma.JsonObject {
  return {
    stripeDisputeId: source.stripeSourceId,
    disputeStatus: source.disputeStatus,
    stripeEventId: source.stripeEventId,
    stripeEventType: source.stripeEventType,
    stripeEventCreatedAt: source.stripeEventCreatedAt.toISOString(),
    amount: source.disputeAmount,
    currency: source.disputeCurrency.toLowerCase(),
  };
}

function isDisputeEconomicLossSource(source: EconomicLossSource): source is EconomicLossSource & DisputeReconciliationSource {
  return source.reason === SettlementReversalReason.DISPUTE
    && typeof source.disputeStatus === "string"
    && typeof source.disputeAmount === "number"
    && typeof source.disputeCurrency === "string";
}

async function createSettlementEvent(
  tx: Tx,
  {
    settlementId,
    settlementLegId,
    eventType,
    message,
    metadata,
    idempotencyKey,
  }: {
    settlementId: string;
    settlementLegId?: string;
    eventType: SettlementEventType;
    message: string;
    metadata: Prisma.InputJsonValue;
    idempotencyKey: string;
  },
) {
  const existingEvent = await tx.settlementEvent.findUnique({
    where: { idempotencyKey },
    select: { id: true },
  });
  if (existingEvent) return;
  await tx.settlementEvent.create({
    data: {
      settlementId,
      ...(settlementLegId ? { settlementLegId } : {}),
      eventType,
      message,
      metadata,
      idempotencyKey,
    },
  });
}

async function loadLockedSettlement(tx: Tx, paymentRequestId: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT "id" FROM "Settlement" WHERE "paymentRequestId" = ${paymentRequestId} FOR UPDATE`,
  );
  if (rows.length === 0) return null;

  return tx.settlement.findUniqueOrThrow({
    where: { id: rows[0].id },
    include: {
      legs: { orderBy: { type: "asc" } },
      reversals: {
        select: {
          settlementLegId: true,
          amount: true,
          requestedAmount: true,
          successfullyReversedAmount: true,
          status: true,
        },
      },
    },
  });
}

type LockedSettlement = NonNullable<Awaited<ReturnType<typeof loadLockedSettlement>>>;

function hasExternalReversalPending(settlement: LockedSettlement) {
  return (
    settlement.status === SettlementStatus.REVERSAL_PENDING
    || settlement.legs.some((leg) => leg.status === SettlementLegStatus.REVERSAL_PENDING)
    || settlement.reversals.some((reversal) => reversal.status === SettlementReversalStatus.PENDING)
  );
}

function settlementStatusAfterEconomicLoss({
  settlement,
  fullLoss,
  hasNewExternalReversal,
}: {
  settlement: LockedSettlement;
  fullLoss: boolean;
  hasNewExternalReversal: boolean;
}) {
  if (settlement.status === SettlementStatus.REVERSED) return SettlementStatus.REVERSED;
  if (hasNewExternalReversal || hasExternalReversalPending(settlement)) {
    return SettlementStatus.REVERSAL_PENDING;
  }
  if (settlement.status === SettlementStatus.CANCELLED) return SettlementStatus.CANCELLED;
  return fullLoss ? SettlementStatus.CANCELLED : SettlementStatus.HOLD;
}

async function loadReconciliationContext(tx: Tx, paymentRequestId: string) {
  const settlement = await loadLockedSettlement(tx, paymentRequestId);
  if (!settlement) return null;

  const paymentRequest = await tx.paymentRequest.findUniqueOrThrow({
    where: { id: paymentRequestId },
    select: {
      id: true,
      status: true,
      paidAt: true,
      refundAmount: true,
      grossAmount: true,
      currency: true,
      requiresManualReconciliation: true,
    },
  });
  if (
    !paymentRequest.paidAt
    || paymentRequest.currency !== "usd"
    || paymentRequest.grossAmount !== settlement.grossAmount
    || settlement.currency !== "usd"
  ) {
    throw new Error("Settlement reconciliation requires a verified USD payment snapshot.");
  }

  return { settlement, paymentRequest };
}

export function calculateCumulativeSettlementReversalTargets({
  grossAmount,
  currency,
  hasReferralAttribution,
  cumulativeRefundAmount,
}: {
  grossAmount: number;
  currency: string;
  hasReferralAttribution: boolean;
  cumulativeRefundAmount: number;
}) {
  if (!Number.isSafeInteger(cumulativeRefundAmount) || cumulativeRefundAmount < 1 || cumulativeRefundAmount > grossAmount) {
    throw new Error("Cumulative settlement reconciliation amount is invalid.");
  }
  const originalFinancials = calculateStripeConnectSettlementFinancials({
    grossAmount,
    currency,
    hasReferralAttribution,
  });
  const roundProportionalAmount = (legAmount: number) => Number(
    (BigInt(cumulativeRefundAmount) * BigInt(legAmount) + BigInt(grossAmount) / BigInt(2)) / BigInt(grossAmount),
  );
  return new Map<SettlementLegType, number>([
    [SettlementLegType.SELLER_PAYABLE, roundProportionalAmount(originalFinancials.sellerPayableAmount)],
    [SettlementLegType.PARTNER_REFERRAL, roundProportionalAmount(originalFinancials.partnerReferralAmount)],
  ]);
}

async function reconcileEconomicLoss(
  tx: Tx,
  source: EconomicLossSource,
) {
  const context = await loadReconciliationContext(tx, source.paymentRequestId);
  if (!context) return null;

  const { paymentRequest, settlement } = context;
  if (
    (paymentRequest.status !== PaymentRequestStatus.PARTIALLY_REFUNDED
      && paymentRequest.status !== PaymentRequestStatus.REFUNDED)
    || paymentRequest.refundAmount <= 0
  ) {
    return null;
  }

  const [refundTotals, lostDisputeTotals] = await Promise.all([
    tx.paymentRefund.aggregate({
      where: { paymentRequestId: source.paymentRequestId, status: "succeeded" },
      _sum: { amount: true },
    }),
    tx.paymentDispute.aggregate({
      where: {
        paymentRequestId: source.paymentRequestId,
        status: { in: ["lost", "charge_refunded"] },
      },
      _sum: { amount: true },
    }),
  ]);
  if ((refundTotals._sum.amount ?? 0) > 0 && (lostDisputeTotals._sum.amount ?? 0) > 0) {
    await tx.paymentRequest.update({
      where: { id: paymentRequest.id },
      data: {
        requiresManualReconciliation: true,
        reconciliationNote: "Refund and dispute loss overlap requires manual reconciliation.",
      },
    });
    await createSettlementEvent(tx, {
      settlementId: settlement.id,
      eventType: SettlementEventType.POST_TRANSFER_REVERSAL_REQUIRED,
      message: "Refund and dispute loss evidence overlaps and requires manual reconciliation.",
      metadata: {
        source: source.reason.toLowerCase(),
        stripeSourceId: source.stripeSourceId,
        refundAmount: refundTotals._sum.amount ?? 0,
        disputeLossAmount: lostDisputeTotals._sum.amount ?? 0,
        requiresManualReconciliation: true,
      },
      idempotencyKey: `settlement:${settlement.id}:reconciliation:overlap:${source.stripeSourceId}`,
    });
    return { settlementId: settlement.id, requiresManualReconciliation: true, hasTransferredReversal: false };
  }

  const refundAmount = Math.min(paymentRequest.refundAmount, paymentRequest.grossAmount);
  const fullLoss = isFullEconomicLoss(refundAmount, paymentRequest.grossAmount);
  const targets = calculateCumulativeSettlementReversalTargets({
    grossAmount: paymentRequest.grossAmount,
    currency: settlement.currency,
    hasReferralAttribution: settlement.partnerReferralAmount > 0,
    cumulativeRefundAmount: refundAmount,
  });
  const priorAmounts = new Map<string, number>();
  for (const reversal of settlement.reversals) {
    priorAmounts.set(
      reversal.settlementLegId,
      (priorAmounts.get(reversal.settlementLegId) ?? 0) + (reversal.requestedAmount ?? reversal.amount),
    );
  }

  const reversalLegs = settlement.legs.filter((leg) => isTransferableLeg(leg.type));
  const deltaByLegId = new Map<string, number>();
  for (const leg of reversalLegs) {
    const target = targets.get(leg.type) ?? 0;
    const prior = priorAmounts.get(leg.id) ?? 0;
    const delta = Math.max(0, target - prior);
    if (delta > 0) deltaByLegId.set(leg.id, delta);
  }

  const newlyAffectedExternalReversalLegIds = new Set(
    reversalLegs
      .filter((leg) => isInFlightOrTransferred(leg.status) && (deltaByLegId.get(leg.id) ?? 0) > 0)
      .map((leg) => leg.id),
  );
  const existingPendingReversalLegIds = new Set(
    settlement.reversals
      .filter((reversal) => reversal.status === SettlementReversalStatus.PENDING)
      .map((reversal) => reversal.settlementLegId),
  );
  const externalReversalLegIds = new Set([
    ...newlyAffectedExternalReversalLegIds,
    ...existingPendingReversalLegIds,
    ...reversalLegs
      .filter((leg) => leg.status === SettlementLegStatus.REVERSAL_PENDING)
      .map((leg) => leg.id),
  ]);

  await createSettlementEvent(tx, {
    settlementId: settlement.id,
    eventType: SettlementEventType.REFUND_RECONCILIATION_STARTED,
    message: "Settlement reconciliation started after a verified refund or dispute loss.",
    metadata: {
      source: source.reason.toLowerCase(),
      stripeSourceId: source.stripeSourceId,
      stripeEventId: source.stripeEventId,
      stripeEventType: source.stripeEventType,
      stripeEventCreatedAt: source.stripeEventCreatedAt.toISOString(),
      refundAmount,
      currency: "usd",
      ...(isDisputeEconomicLossSource(source)
        ? disputeAuditMetadata(source)
        : {}),
    },
    idempotencyKey: `settlement:${settlement.id}:reconciliation:${source.reason}:${source.stripeSourceId}:started`,
  });

  for (const leg of reversalLegs) {
    const delta = deltaByLegId.get(leg.id) ?? 0;
    if (delta <= 0) continue;
    const idempotencyKey = `settlement:${settlement.id}:reversal:${source.reason}:${source.stripeSourceId}:leg:${leg.type}`;
    let reversalCreated = false;
    const existingReversal = await tx.settlementReversal.findUnique({
      where: { idempotencyKey },
      select: { id: true },
    });
    if (!existingReversal) {
      await tx.settlementReversal.create({
        data: {
          settlementId: settlement.id,
          settlementLegId: leg.id,
          amount: delta,
          requestedAmount: delta,
          successfullyReversedAmount: 0,
          currency: "usd",
          reason: source.reason,
          sourceType: source.reason === SettlementReversalReason.REFUND
            ? SettlementReversalSourceType.REFUND
            : SettlementReversalSourceType.DISPUTE_LOST,
          stripeSourceObjectId: source.stripeSourceId,
          ...(newlyAffectedExternalReversalLegIds.has(leg.id) && leg.stripeTransferId
            ? { originalStripeTransferId: leg.stripeTransferId }
            : {}),
          status: newlyAffectedExternalReversalLegIds.has(leg.id)
            ? SettlementReversalStatus.PENDING
            : SettlementReversalStatus.ACCOUNTING_APPLIED,
          idempotencyKey,
          ...(source.reason === SettlementReversalReason.REFUND
            ? { stripeRefundId: source.stripeSourceId }
            : { stripeDisputeId: source.stripeSourceId }),
        },
      });
      reversalCreated = true;
    }
    if (reversalCreated) {
      await createSettlementEvent(tx, {
        settlementId: settlement.id,
        settlementLegId: leg.id,
        eventType: SettlementEventType.REVERSAL_CREATED,
        message: newlyAffectedExternalReversalLegIds.has(leg.id)
          ? "A pending internal settlement reversal was recorded for a transferred settlement leg."
          : "An accounting-only settlement reversal was recorded before any transfer occurred.",
        metadata: {
          source: source.reason.toLowerCase(),
          stripeSourceId: source.stripeSourceId,
          stripeEventId: source.stripeEventId,
          stripeEventType: source.stripeEventType,
          stripeEventCreatedAt: source.stripeEventCreatedAt.toISOString(),
          amount: delta,
          currency: "usd",
          reversalStatus: newlyAffectedExternalReversalLegIds.has(leg.id) ? "PENDING" : "ACCOUNTING_APPLIED",
          ...(isDisputeEconomicLossSource(source)
            ? disputeAuditMetadata(source)
            : {}),
        },
        idempotencyKey: `settlement:${settlement.id}:reversal:${source.reason}:${source.stripeSourceId}:leg:${leg.type}:event`,
      });
    }
  }

  for (const leg of settlement.legs) {
    if (externalReversalLegIds.has(leg.id) && leg.status !== SettlementLegStatus.REVERSED) {
      await tx.settlementLeg.update({
        where: { id: leg.id },
        data: { status: SettlementLegStatus.REVERSAL_PENDING },
      });
      continue;
    }
    if (leg.status === SettlementLegStatus.REVERSED) continue;
    if (isInFlightOrTransferred(leg.status)) continue;
    if (fullLoss) {
      await tx.settlementLeg.update({
        where: { id: leg.id },
        data: { status: SettlementLegStatus.CANCELLED },
      });
    } else if (leg.status !== SettlementLegStatus.CANCELLED) {
      await tx.settlementLeg.update({
        where: { id: leg.id },
        data: { status: SettlementLegStatus.HOLD },
      });
    }
  }

  const nextSettlementStatus = settlementStatusAfterEconomicLoss({
    settlement,
    fullLoss,
    hasNewExternalReversal: newlyAffectedExternalReversalLegIds.size > 0,
  });
  await tx.settlement.update({
    where: { id: settlement.id },
    data: { status: nextSettlementStatus },
  });

  const refundReconciliationEventType = fullLoss
    ? nextSettlementStatus === SettlementStatus.CANCELLED
      ? SettlementEventType.FULL_REFUND_CANCELLED
      : null
    : source.reason === SettlementReversalReason.REFUND
      ? SettlementEventType.PARTIAL_REFUND_RECONCILED
      : null;

  if (refundReconciliationEventType) {
    await createSettlementEvent(tx, {
      settlementId: settlement.id,
      eventType: refundReconciliationEventType,
      message: refundReconciliationEventType === SettlementEventType.FULL_REFUND_CANCELLED
        ? "A full economic loss cancelled unreleased settlement amounts."
        : "A partial refund reduced future settlement availability proportionally.",
      metadata: {
        source: source.reason.toLowerCase(),
        stripeSourceId: source.stripeSourceId,
        stripeEventId: source.stripeEventId,
        stripeEventType: source.stripeEventType,
        stripeEventCreatedAt: source.stripeEventCreatedAt.toISOString(),
        refundAmount,
        grossAmount: paymentRequest.grossAmount,
        currency: "usd",
        ...(isDisputeEconomicLossSource(source)
          ? disputeAuditMetadata(source)
          : {}),
      },
      idempotencyKey: `settlement:${settlement.id}:reconciliation:${source.reason}:${source.stripeSourceId}:${fullLoss ? "full" : "partial"}`,
    });
  }

  if (
    source.reason === SettlementReversalReason.REFUND
    && fullLoss
    && nextSettlementStatus === SettlementStatus.CANCELLED
  ) {
    await createSettlementEvent(tx, {
      settlementId: settlement.id,
      eventType: SettlementEventType.CANCELLED,
      message: "A full refund cancelled the unreleased settlement ledger.",
      metadata: {
        source: "refund",
        stripeRefundId: source.stripeSourceId,
        stripeEventId: source.stripeEventId,
        stripeEventType: source.stripeEventType,
        stripeEventCreatedAt: source.stripeEventCreatedAt.toISOString(),
        amount: refundAmount,
        currency: "usd",
      },
      idempotencyKey: `settlement:${settlement.id}:cancelled:refund:${source.stripeSourceId}`,
    });
  }

  if (source.reason === SettlementReversalReason.DISPUTE) {
    if (!isDisputeEconomicLossSource(source)) {
      throw new Error("Dispute settlement reconciliation requires dispute audit evidence.");
    }
    await createSettlementEvent(tx, {
      settlementId: settlement.id,
      eventType: SettlementEventType.DISPUTE_LOST,
      message: "A lost dispute reduced future settlement availability without moving money.",
      metadata: { ...disputeAuditMetadata(source), refundAmount },
      idempotencyKey: `settlement:${settlement.id}:dispute:${source.stripeSourceId}:lost`,
    });
  }

  if (nextSettlementStatus === SettlementStatus.REVERSAL_PENDING) {
    await createSettlementEvent(tx, {
      settlementId: settlement.id,
      eventType: SettlementEventType.POST_TRANSFER_REVERSAL_REQUIRED,
      message: "A transferred settlement leg requires later internal transfer-reversal reconciliation.",
      metadata: {
        source: source.reason.toLowerCase(),
        stripeSourceId: source.stripeSourceId,
        stripeEventId: source.stripeEventId,
        stripeEventType: source.stripeEventType,
        stripeEventCreatedAt: source.stripeEventCreatedAt.toISOString(),
        currency: "usd",
        ...(isDisputeEconomicLossSource(source)
          ? disputeAuditMetadata(source)
          : {}),
      },
      idempotencyKey: `settlement:${settlement.id}:reconciliation:${source.reason}:${source.stripeSourceId}:post-transfer`,
    });
  }

  return {
    settlementId: settlement.id,
    fullLoss,
    hasTransferredReversal: nextSettlementStatus === SettlementStatus.REVERSAL_PENDING,
  };
}

async function blockSettlementForOpenDispute(tx: Tx, source: DisputeReconciliationSource) {
  const context = await loadReconciliationContext(tx, source.paymentRequestId);
  if (!context) return null;
  const { settlement } = context;

  for (const leg of settlement.legs) {
    if (!isInFlightOrTransferred(leg.status) && leg.status !== SettlementLegStatus.CANCELLED) {
      await tx.settlementLeg.update({
        where: { id: leg.id },
        data: { status: SettlementLegStatus.HOLD },
      });
    }
  }
  if (
    settlement.status !== SettlementStatus.CANCELLED
    && settlement.status !== SettlementStatus.REVERSAL_PENDING
    && settlement.status !== SettlementStatus.TRANSFERRED
    && settlement.status !== SettlementStatus.REVERSED
  ) {
    await tx.settlement.update({
      where: { id: settlement.id },
      data: { status: SettlementStatus.HOLD },
    });
  }
  await createSettlementEvent(tx, {
    settlementId: settlement.id,
    eventType: source.stripeEventType === "charge.dispute.created"
      ? SettlementEventType.DISPUTE_OPENED
      : SettlementEventType.DISPUTE_UPDATED,
    message: "An open dispute blocks future settlement release eligibility.",
    metadata: disputeAuditMetadata(source),
    idempotencyKey: `settlement:${settlement.id}:dispute:${source.stripeSourceId}:${source.stripeEventType === "charge.dispute.created" ? "opened" : "updated"}:status:${source.disputeStatus}`,
  });
  return { settlementId: settlement.id };
}

async function restoreSettlementAfterWonDispute(tx: Tx, source: DisputeReconciliationSource) {
  const context = await loadReconciliationContext(tx, source.paymentRequestId);
  if (!context) return null;
  const { settlement } = context;
  const anotherOpenDispute = await tx.paymentDispute.findFirst({
    where: {
      paymentRequestId: source.paymentRequestId,
      stripeDisputeId: { not: source.stripeSourceId },
      status: { notIn: ["won", "lost", "prevented", "warning_closed", "charge_refunded"] },
    },
    select: { id: true },
  });

  if (
    settlement.status !== SettlementStatus.CANCELLED
    && settlement.status !== SettlementStatus.REVERSAL_PENDING
    && settlement.status !== SettlementStatus.TRANSFERRED
    && settlement.status !== SettlementStatus.REVERSED
  ) {
    await tx.settlement.update({
      where: { id: settlement.id },
      data: { status: SettlementStatus.HOLD },
    });
  }
  for (const leg of settlement.legs) {
    if (!isInFlightOrTransferred(leg.status) && leg.status !== SettlementLegStatus.CANCELLED) {
      await tx.settlementLeg.update({
        where: { id: leg.id },
        data: { status: SettlementLegStatus.HOLD },
      });
    }
  }
  await createSettlementEvent(tx, {
    settlementId: settlement.id,
    eventType: SettlementEventType.DISPUTE_WON,
    message: "A favorable dispute outcome retained settlement funds on hold without releasing funds.",
    metadata: { ...disputeAuditMetadata(source), anotherOpenDispute: Boolean(anotherOpenDispute) },
    idempotencyKey: `settlement:${settlement.id}:dispute:${source.stripeSourceId}:won:status:${source.disputeStatus}`,
  });
  return { settlementId: settlement.id };
}

// These functions are called only after the existing webhook synchronizers have
// persisted and validated the Stripe refund or dispute. The default feature mode
// exits before reading or writing any settlement ledger records.
export async function reconcileSettlementAfterVerifiedRefund(
  tx: Tx,
  source: ReconciliationSource,
) {
  if (!isStripeConnectSettlementLedgerEnabled()) return null;
  const refund = await tx.paymentRefund.findUnique({ where: { stripeRefundId: source.stripeSourceId } });
  if (!refund || refund.paymentRequestId !== source.paymentRequestId || refund.status !== "succeeded") {
    return null;
  }
  return reconcileEconomicLoss(tx, { ...source, reason: SettlementReversalReason.REFUND });
}

export async function reconcileSettlementAfterVerifiedDispute(
  tx: Tx,
  source: DisputeReconciliationSource,
) {
  if (!isStripeConnectSettlementLedgerEnabled()) return null;
  const dispute = await tx.paymentDispute.findUnique({ where: { stripeDisputeId: source.stripeSourceId } });
  if (!dispute || dispute.paymentRequestId !== source.paymentRequestId) return null;

  if (disputeIsLoss(dispute.status)) {
    return reconcileEconomicLoss(tx, { ...source, reason: SettlementReversalReason.DISPUTE });
  }
  if (disputeRestoresEligibility(dispute.status)) {
    return restoreSettlementAfterWonDispute(tx, source);
  }
  return blockSettlementForOpenDispute(tx, source);
}
