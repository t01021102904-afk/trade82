import "server-only";

import {
  PaymentRequestStatus,
  Prisma,
  SettlementEventType,
  SettlementLegStatus,
  SettlementLegType,
  SettlementReversalStatus,
  SettlementStatus,
  StripeConnectedAccountStatus,
} from "@/generated/prisma/client";
import { getDb } from "@/lib/db";

type Tx = Prisma.TransactionClient;

const transferableLegTypes = [
  SettlementLegType.SELLER_PAYABLE,
  SettlementLegType.PARTNER_REFERRAL,
] as const;

const closedDisputeStatuses = new Set([
  "won",
  "lost",
  "prevented",
  "warning_closed",
  "charge_refunded",
]);

type TransferAccount = {
  status: StripeConnectedAccountStatus;
  payoutsEnabled: boolean;
  transfersEnabled: boolean;
} | null | undefined;

type SettlementReleaseLeg = {
  id: string;
  settlementId: string;
  type: SettlementLegType;
  amount: number;
  holdUntil: Date;
  status: SettlementLegStatus;
  recipientCompany: { stripeConnectedAccount: TransferAccount } | null;
  partnerProfile: { stripeConnectedAccount: TransferAccount } | null;
};

const lockedSettlementInclude = {
  paymentRequest: {
    select: {
      status: true,
      refundAmount: true,
      grossAmount: true,
      requiresManualReconciliation: true,
      disputes: { select: { status: true } },
    },
  },
  legs: {
    include: {
      recipientCompany: {
        select: {
          stripeConnectedAccount: {
            select: { status: true, payoutsEnabled: true, transfersEnabled: true },
          },
        },
      },
      partnerProfile: {
        select: {
          stripeConnectedAccount: {
            select: { status: true, payoutsEnabled: true, transfersEnabled: true },
          },
        },
      },
    },
  },
  reversals: { select: { settlementLegId: true, amount: true, requestedAmount: true, status: true } },
} satisfies Prisma.SettlementInclude;

type LockedSettlement = Prisma.SettlementGetPayload<{ include: typeof lockedSettlementInclude }>;

export type SettlementReleaseResult = {
  settlementId: string;
  readyLegIds: string[];
  blockedLegIds: string[];
};

function isTransferableLegType(type: SettlementLegType) {
  return transferableLegTypes.includes(type as (typeof transferableLegTypes)[number]);
}

export function isOpenSettlementDispute(status: string) {
  return !closedDisputeStatuses.has(status);
}

export function isTransferAccountReady(account: TransferAccount) {
  return Boolean(
    account
    && account.status === StripeConnectedAccountStatus.ENABLED
    && account.transfersEnabled
    && account.payoutsEnabled,
  );
}

export function calculateSettlementLegNetAmount({
  amount,
  reversalAmounts,
}: {
  amount: number;
  reversalAmounts: readonly number[];
}) {
  const reversedAmount = reversalAmounts.reduce((total, value) => total + value, 0);
  return Math.max(0, amount - reversedAmount);
}

function getTransferAccount(leg: SettlementReleaseLeg) {
  return leg.type === SettlementLegType.SELLER_PAYABLE
    ? leg.recipientCompany?.stripeConnectedAccount
    : leg.partnerProfile?.stripeConnectedAccount;
}

async function createSettlementEvent(
  tx: Tx,
  {
    settlementId,
    settlementLegId,
    eventType,
    actorUserId,
    message,
    metadata,
    idempotencyKey,
  }: {
    settlementId: string;
    settlementLegId?: string;
    eventType: SettlementEventType;
    actorUserId?: string;
    message: string;
    metadata: Prisma.InputJsonValue;
    idempotencyKey: string;
  },
) {
  const existing = await tx.settlementEvent.findUnique({
    where: { idempotencyKey },
    select: { id: true },
  });
  if (existing) return false;
  await tx.settlementEvent.create({
    data: {
      settlementId,
      ...(settlementLegId ? { settlementLegId } : {}),
      ...(actorUserId ? { actorUserId } : {}),
      eventType,
      message,
      metadata,
      idempotencyKey,
    },
  });
  return true;
}

async function loadLockedSettlement(tx: Tx, settlementId: string) {
  const locked = await tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT "id" FROM "Settlement" WHERE "id" = ${settlementId} FOR UPDATE`,
  );
  if (locked.length === 0) return null;

  return tx.settlement.findUniqueOrThrow({
    where: { id: settlementId },
    include: lockedSettlementInclude,
  });
}

function isFullRefund(settlement: LockedSettlement) {
  const payment = settlement.paymentRequest;
  return payment.status === PaymentRequestStatus.REFUNDED || payment.refundAmount >= payment.grossAmount;
}

function hasOpenDispute(settlement: LockedSettlement) {
  return settlement.paymentRequest.disputes.some((dispute) => isOpenSettlementDispute(dispute.status));
}

function hasTransferPendingLeg(settlement: LockedSettlement) {
  return settlement.legs.some((leg) => (
    isTransferableLegType(leg.type) && leg.status === SettlementLegStatus.TRANSFER_PENDING
  ));
}

function reversalAmountsByLeg(settlement: LockedSettlement) {
  const amounts = new Map<string, number[]>();
  for (const reversal of settlement.reversals) {
    const values = amounts.get(reversal.settlementLegId) ?? [];
    values.push(reversal.requestedAmount ?? reversal.amount);
    amounts.set(reversal.settlementLegId, values);
  }
  return amounts;
}

function hasPendingReversal(settlement: LockedSettlement, leg: SettlementReleaseLeg) {
  return (
    leg.status === SettlementLegStatus.REVERSAL_PENDING
    || settlement.reversals.some(
      (reversal) => reversal.settlementLegId === leg.id
        && reversal.status === SettlementReversalStatus.PENDING,
    )
  );
}

async function updateSettlementStatusFromLegs(tx: Tx, settlement: LockedSettlement) {
  if (
    settlement.status === SettlementStatus.CANCELLED
    || settlement.status === SettlementStatus.REVERSAL_PENDING
    || settlement.status === SettlementStatus.TRANSFERRED
    || settlement.status === SettlementStatus.REVERSED
    || settlement.status === SettlementStatus.TRANSFER_PENDING
  ) {
    return;
  }

  const legs = await tx.settlementLeg.findMany({
    where: { settlementId: settlement.id },
    select: { type: true, status: true },
  });
  const transferable = legs.filter((leg) => isTransferableLegType(leg.type));
  if (transferable.some((leg) => leg.status === SettlementLegStatus.TRANSFER_PENDING)) return;
  const nextStatus = transferable.some((leg) => leg.status === SettlementLegStatus.READY)
    ? SettlementStatus.READY
    : SettlementStatus.HOLD;
  if (settlement.status !== nextStatus) {
    await tx.settlement.update({ where: { id: settlement.id }, data: { status: nextStatus } });
  }
}

async function evaluateLockedSettlement(
  tx: Tx,
  settlement: LockedSettlement,
  {
    now,
    onlyLegIds,
  }: {
    now: Date;
    onlyLegIds?: ReadonlySet<string>;
  },
): Promise<SettlementReleaseResult> {
  const result: SettlementReleaseResult = {
    settlementId: settlement.id,
    readyLegIds: [],
    blockedLegIds: [],
  };

  const globallyBlocked = settlement.holdReason
    || settlement.paymentRequest.requiresManualReconciliation
    || isFullRefund(settlement)
    || hasOpenDispute(settlement);
  const reversalAmounts = reversalAmountsByLeg(settlement);

  for (const leg of settlement.legs as SettlementReleaseLeg[]) {
    if (!isTransferableLegType(leg.type) || leg.status !== SettlementLegStatus.HOLD) continue;
    if (onlyLegIds && !onlyLegIds.has(leg.id)) continue;
    if (leg.holdUntil > now || globallyBlocked || hasPendingReversal(settlement, leg)) {
      result.blockedLegIds.push(leg.id);
      continue;
    }

    const netAmount = calculateSettlementLegNetAmount({
      amount: leg.amount,
      reversalAmounts: reversalAmounts.get(leg.id) ?? [],
    });
    if (netAmount <= 0 || !isTransferAccountReady(getTransferAccount(leg))) {
      result.blockedLegIds.push(leg.id);
      continue;
    }

    const updated = await tx.settlementLeg.updateMany({
      where: { id: leg.id, status: SettlementLegStatus.HOLD },
      data: { status: SettlementLegStatus.READY },
    });
    if (updated.count !== 1) continue;

    await createSettlementEvent(tx, {
      settlementId: settlement.id,
      settlementLegId: leg.id,
      eventType: SettlementEventType.HOLD_RELEASED,
      message: "Settlement leg completed its hold and is ready for later transfer processing.",
      metadata: { netAmount, currency: "usd", evaluatedAt: now.toISOString() },
      idempotencyKey: `settlement:${settlement.id}:leg:${leg.id}:hold-released`,
    });
    result.readyLegIds.push(leg.id);
  }

  await updateSettlementStatusFromLegs(tx, settlement);
  return result;
}

export async function evaluateSettlementReleaseEligibilityInTransaction(
  tx: Tx,
  {
    settlementId,
    now,
  }: {
    settlementId: string;
    now: Date;
  },
) {
  const settlement = await loadLockedSettlement(tx, settlementId);
  if (!settlement) throw new Error("Settlement not found.");
  return evaluateLockedSettlement(tx, settlement, { now });
}

export async function evaluateSettlementReleaseEligibility({
  settlementId,
  now = new Date(),
}: {
  settlementId: string;
  now?: Date;
}) {
  return getDb().$transaction((tx) => evaluateSettlementReleaseEligibilityInTransaction(tx, { settlementId, now }));
}

export async function releaseEligibleSettlementLegs({
  now = new Date(),
  batchSize = 20,
}: {
  now?: Date;
  batchSize?: number;
} = {}) {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 20) {
    throw new Error("Settlement release batch size must be between 1 and 20.");
  }

  return getDb().$transaction(async (tx) => {
    const candidates = await tx.$queryRaw<Array<{ id: string; settlementId: string }>>(
      Prisma.sql`
        SELECT leg."id", leg."settlementId"
        FROM "SettlementLeg" AS leg
        INNER JOIN "Settlement" AS settlement ON settlement."id" = leg."settlementId"
        WHERE leg."status" = 'HOLD'
          AND leg."type" IN ('SELLER_PAYABLE', 'PARTNER_REFERRAL')
          AND leg."holdUntil" <= ${now}
        ORDER BY leg."holdUntil" ASC, leg."id" ASC
        FOR UPDATE OF settlement, leg SKIP LOCKED
        LIMIT ${batchSize}
      `,
    );
    const candidateIdsBySettlement = new Map<string, Set<string>>();
    for (const candidate of candidates) {
      const ids = candidateIdsBySettlement.get(candidate.settlementId) ?? new Set<string>();
      ids.add(candidate.id);
      candidateIdsBySettlement.set(candidate.settlementId, ids);
    }

    const results: SettlementReleaseResult[] = [];
    for (const [settlementId, candidateLegIds] of candidateIdsBySettlement) {
      const settlement = await tx.settlement.findUniqueOrThrow({
        where: { id: settlementId },
        include: lockedSettlementInclude,
      });
      results.push(await evaluateLockedSettlement(tx, settlement, { now, onlyLegIds: candidateLegIds }));
    }
    return results;
  });
}

export async function approveSettlementRelease({
  settlementId,
  actorUserId,
  now = new Date(),
}: {
  settlementId: string;
  actorUserId: string;
  now?: Date;
}) {
  return getDb().$transaction(async (tx) => {
    const settlement = await loadLockedSettlement(tx, settlementId);
    if (!settlement) throw new Error("Settlement not found.");
    if (
      settlement.status === SettlementStatus.CANCELLED
      || settlement.status === SettlementStatus.REVERSAL_PENDING
      || hasTransferPendingLeg(settlement)
    ) {
      throw new Error("This settlement cannot be approved in its current state.");
    }
    await tx.settlement.update({
      where: { id: settlement.id },
      data: { approvedAt: now, approvedByUserId: actorUserId, holdReason: null },
    });
    await createSettlementEvent(tx, {
      settlementId: settlement.id,
      eventType: SettlementEventType.ADMIN_APPROVED,
      actorUserId,
      message: "An administrator approved this settlement for future transfer processing.",
      metadata: { approvedAt: now.toISOString() },
      idempotencyKey: `settlement:${settlement.id}:admin:approved:${now.toISOString()}`,
    });
    return evaluateLockedSettlement(tx, { ...settlement, holdReason: null }, { now });
  });
}

export async function holdSettlementRelease({
  settlementId,
  actorUserId,
  reason,
}: {
  settlementId: string;
  actorUserId: string;
  reason: string;
}) {
  const holdReason = reason.trim();
  if (holdReason.length < 3 || holdReason.length > 1000) {
    throw new Error("Settlement hold reason must be between 3 and 1000 characters.");
  }

  return getDb().$transaction(async (tx) => {
    const settlement = await loadLockedSettlement(tx, settlementId);
    if (!settlement) throw new Error("Settlement not found.");
    if (hasTransferPendingLeg(settlement)) {
      throw new Error("This settlement cannot be placed on hold while a transfer is pending.");
    }
    await tx.settlement.update({
      where: { id: settlement.id },
      data: { holdReason, status: SettlementStatus.HOLD },
    });
    await tx.settlementLeg.updateMany({
      where: {
        settlementId: settlement.id,
        type: { in: [...transferableLegTypes] },
        status: SettlementLegStatus.READY,
      },
      data: { status: SettlementLegStatus.HOLD },
    });
    await createSettlementEvent(tx, {
      settlementId: settlement.id,
      eventType: SettlementEventType.ADMIN_HELD,
      actorUserId,
      message: "An administrator placed this settlement on hold.",
      metadata: { holdReason },
      idempotencyKey: `settlement:${settlement.id}:admin:held:${actorUserId}:${Date.now()}`,
    });
  });
}

export async function markSettlementManualReconciliation({
  settlementId,
  actorUserId,
  reason,
}: {
  settlementId: string;
  actorUserId: string;
  reason: string;
}) {
  const reconciliationNote = reason.trim();
  if (reconciliationNote.length < 3 || reconciliationNote.length > 1000) {
    throw new Error("Settlement reconciliation reason must be between 3 and 1000 characters.");
  }

  return getDb().$transaction(async (tx) => {
    const settlement = await loadLockedSettlement(tx, settlementId);
    if (!settlement) throw new Error("Settlement not found.");
    if (hasTransferPendingLeg(settlement)) {
      throw new Error("This settlement cannot be marked for reconciliation while a transfer is pending.");
    }

    const updated = await tx.paymentRequest.updateMany({
      where: { id: settlement.paymentRequestId, requiresManualReconciliation: false },
      data: { requiresManualReconciliation: true, reconciliationNote },
    });
    if (updated.count === 1) {
      await createSettlementEvent(tx, {
        settlementId: settlement.id,
        actorUserId,
        eventType: SettlementEventType.POST_TRANSFER_REVERSAL_REQUIRED,
        message: "An administrator marked this settlement for manual reconciliation.",
        metadata: { reconciliationNote },
        idempotencyKey: `settlement:${settlement.id}:admin:manual-reconciliation:${actorUserId}`,
      });
    }

    return { settlementId: settlement.id, requiresManualReconciliation: true };
  });
}

export async function reevaluateSettlementRelease({
  settlementId,
  actorUserId,
  now = new Date(),
}: {
  settlementId: string;
  actorUserId: string;
  now?: Date;
}) {
  return getDb().$transaction(async (tx) => {
    const settlement = await loadLockedSettlement(tx, settlementId);
    if (!settlement) throw new Error("Settlement not found.");
    if (hasTransferPendingLeg(settlement)) {
      throw new Error("This settlement cannot be reevaluated while a transfer is pending.");
    }
    await createSettlementEvent(tx, {
      settlementId: settlement.id,
      eventType: SettlementEventType.ADMIN_REEVALUATED,
      actorUserId,
      message: "An administrator requested a settlement release eligibility re-evaluation.",
      metadata: { evaluatedAt: now.toISOString() },
      idempotencyKey: `settlement:${settlement.id}:admin:reevaluated:${actorUserId}:${now.toISOString()}`,
    });
    return evaluateLockedSettlement(tx, settlement, { now });
  });
}
