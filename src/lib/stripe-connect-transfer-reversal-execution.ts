import "server-only";

import type Stripe from "stripe";
import {
  Prisma,
  SettlementEventType,
  SettlementLegStatus,
  SettlementLegType,
  SettlementPaymentFlow,
  SettlementReversalSourceType,
  SettlementReversalStatus,
  SettlementStatus,
} from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { getStripeConnectTransferReversalExecutionMode, type StripeConnectTransferReversalExecutionMode } from "@/lib/stripe-connect-transfer-reversal-mode";
import { isTransferLockActive } from "@/lib/stripe-connect-transfer-recovery";
import { isStaleSettlementReversal } from "@/lib/stripe-connect-transfer-reversal-recovery";

export const MAX_REVERSAL_ATTEMPTS = 5;
const reversalRetryableTypes = new Set([
  "api_connection_error",
  "api_error",
  "idempotency_error",
  "rate_limit_error",
]);
const safeStripeCodes = new Set([
  "balance_insufficient",
  "charge_already_refunded",
  "idempotency_key_in_use",
  "lock_timeout",
  "rate_limit",
  "resource_missing",
]);

type ReversalDb = ReturnType<typeof getDb>;

type ReversalStripeClient = Pick<Stripe, "transfers">;

type ClaimedReversal = {
  id: string;
  settlementId: string;
  settlementLegId: string;
  requestedAmount: number;
  successfullyReversedAmount: number;
  remainingAmount: number;
  currency: string;
  originalStripeTransferId: string;
  sourceType: SettlementReversalSourceType | null;
  stripeSourceObjectId: string | null;
  reversalAttemptCount: number;
  reversalLockedAt: Date;
  executionKind: "new_execution" | "stale_recovery";
  settlement: { paymentRequestId: string };
};

export type SettlementReversalFailure = {
  retryable: boolean;
  code: string;
  sanitizedMessage: string;
};

export type SettlementReversalExecutionResult = {
  ok: boolean;
  settlementReversalId: string;
  status:
    | "disabled"
    | "reversed"
    | "retry_scheduled"
    | "failed"
    | "ineligible"
    | "claim_lost"
    | "persistence_failed"
    | "finalization_failed"
    | "needs_manual_review"
    | "recovery_pending"
    | "requeued";
  retryable: boolean;
  errorCode?: string;
  nextReversalAttemptAt?: string | null;
  stripeTransferReversalId?: string;
};

export function settlementReversalIdempotencyKey(reversalId: string) {
  return `stripe-connect-transfer-reversal:settlement-reversal:${reversalId}`;
}

export function nextReversalRetryAt({
  attemptCount,
  now,
  retryable,
}: {
  attemptCount: number;
  now: Date;
  retryable: boolean;
}) {
  if (!retryable || attemptCount >= MAX_REVERSAL_ATTEMPTS) return null;
  const delayMinutes = [15, 60, 240, 720][Math.min(Math.max(attemptCount - 1, 0), 3)] ?? 720;
  return new Date(now.getTime() + delayMinutes * 60_000);
}

export { isStaleSettlementReversal } from "@/lib/stripe-connect-transfer-reversal-recovery";

function stringProperty(value: unknown, key: string) {
  if (!value || typeof value !== "object") return null;
  const property = (value as Record<string, unknown>)[key];
  return typeof property === "string" ? property : null;
}

function numberProperty(value: unknown, key: string) {
  if (!value || typeof value !== "object") return null;
  const property = (value as Record<string, unknown>)[key];
  return typeof property === "number" ? property : null;
}

export function sanitizeStripeTransferReversalError(error: unknown): SettlementReversalFailure {
  const type = stringProperty(error, "type");
  const code = stringProperty(error, "code");
  const statusCode = numberProperty(error, "statusCode");
  const safeCode = code && safeStripeCodes.has(code)
    ? code
    : type && reversalRetryableTypes.has(type)
      ? type
      : "stripe_transfer_reversal_failed";
  const retryable = code === "balance_insufficient"
    || (
      code !== "resource_missing"
      && code !== "charge_already_refunded"
      && (reversalRetryableTypes.has(type ?? "") || Boolean(statusCode && statusCode >= 500))
    );
  return {
    retryable,
    code: safeCode,
    sanitizedMessage: retryable ? `retryable:${safeCode}` : `permanent:${safeCode}`,
  };
}

function sourceTypeForReason(reason: string) {
  if (reason === "REFUND") return SettlementReversalSourceType.REFUND;
  if (reason === "DISPUTE") return SettlementReversalSourceType.DISPUTE_LOST;
  return SettlementReversalSourceType.PAYMENT_FAILURE;
}

function ineligible(errorCode: string, reversalId: string): SettlementReversalExecutionResult {
  return {
    ok: false,
    settlementReversalId: reversalId,
    status: "ineligible",
    retryable: false,
    errorCode,
  };
}

function claimLost(reversalId: string): SettlementReversalExecutionResult {
  return {
    ok: false,
    settlementReversalId: reversalId,
    status: "claim_lost",
    retryable: false,
    errorCode: "reversal_claim_lost",
  };
}

function persistenceFailure(reversalId: string): SettlementReversalExecutionResult {
  return {
    ok: false,
    settlementReversalId: reversalId,
    status: "persistence_failed",
    retryable: false,
    errorCode: "reversal_persistence_failed",
  };
}

async function findAcceptedStripeReversal(
  stripe: ReversalStripeClient,
  reversal: ClaimedReversal,
) {
  if (reversal.executionKind !== "stale_recovery") return { reversal: null, complete: true };

  let startingAfter: string | undefined;
  for (let page = 0; page < 10; page += 1) {
    const list = await stripe.transfers.listReversals(reversal.originalStripeTransferId, {
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    const accepted = list.data.find((item) => (
      item.metadata?.settlementReversalId === reversal.id
      && item.amount === reversal.remainingAmount
    ));
    if (accepted) return { reversal: accepted, complete: true };
    if (!list.has_more || list.data.length === 0) return { reversal: null, complete: true };
    startingAfter = list.data[list.data.length - 1]?.id;
    if (!startingAfter) return { reversal: null, complete: true };
  }

  return { reversal: null, complete: false };
}

async function createReversalEvent(
  tx: Prisma.TransactionClient,
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
    settlementLegId: string;
    eventType: SettlementEventType;
    actorUserId?: string | null;
    message: string;
    metadata: Prisma.InputJsonValue;
    idempotencyKey: string;
  },
) {
  const existing = await tx.settlementEvent.findUnique({ where: { idempotencyKey }, select: { id: true } });
  if (existing) return;
  await tx.settlementEvent.create({
    data: {
      settlementId,
      settlementLegId,
      ...(actorUserId ? { actorUserId } : {}),
      eventType,
      message,
      metadata,
      idempotencyKey,
    },
  });
}

function isEligibleSettlementStatus(status: SettlementStatus) {
  return status === SettlementStatus.REVERSAL_PENDING
    || status === SettlementStatus.TRANSFERRED;
}

async function claimReversal({
  db,
  reversalId,
  actorUserId,
  now,
}: {
  db: ReversalDb;
  reversalId: string;
    actorUserId?: string | null;
  now: Date;
}): Promise<{ kind: "claimed"; reversal: ClaimedReversal } | { kind: "ineligible"; reason: string } | { kind: "claim_lost" }> {
  return db.$transaction(async (tx) => {
    const advisory = await tx.$queryRaw<Array<{ acquired: boolean }>>(
      Prisma.sql`SELECT pg_try_advisory_xact_lock(hashtextextended(${`trade82-settlement-reversal:${reversalId}`}, 0)) AS acquired`,
    );
    if (!advisory[0]?.acquired) return { kind: "claim_lost" };

    const before = await tx.settlementReversal.findUnique({
      where: { id: reversalId },
      select: { settlementId: true },
    });
    if (!before) return { kind: "ineligible", reason: "reversal_not_found" };
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Settlement" WHERE "id" = ${before.settlementId} FOR UPDATE`);

    const reversal = await tx.settlementReversal.findUnique({
      where: { id: reversalId },
      select: {
        id: true,
        settlementId: true,
        settlementLegId: true,
        amount: true,
        requestedAmount: true,
        successfullyReversedAmount: true,
        currency: true,
        reason: true,
        status: true,
        originalStripeTransferId: true,
        sourceType: true,
        stripeSourceObjectId: true,
        reversalAttemptCount: true,
        nextReversalAttemptAt: true,
        reversalLockedAt: true,
        reversalLastError: true,
        settlement: {
          select: {
            id: true,
            status: true,
            paymentRequestId: true,
            paymentFlow: true,
            paymentRequest: { select: { requiresManualReconciliation: true } },
          },
        },
        settlementLeg: {
          select: {
            id: true,
            settlementId: true,
            type: true,
            status: true,
            currency: true,
            amount: true,
            stripeTransferId: true,
            transferredAt: true,
          },
        },
      },
    });
    if (!reversal) return { kind: "ineligible", reason: "reversal_not_found" };
    if (reversal.settlement.paymentFlow !== SettlementPaymentFlow.SCT) return { kind: "ineligible", reason: "direct_charge_not_supported" };
    if (reversal.status !== SettlementReversalStatus.PENDING) return { kind: "ineligible", reason: "reversal_not_pending" };
    if (reversal.settlementLeg.settlementId !== reversal.settlementId) return { kind: "ineligible", reason: "reversal_leg_mismatch" };
    if (reversal.settlementLeg.type === SettlementLegType.PLATFORM_FEE) return { kind: "ineligible", reason: "platform_fee_not_reversible" };
    if (
      reversal.settlementLeg.type !== SettlementLegType.SELLER_PAYABLE
      && reversal.settlementLeg.type !== SettlementLegType.PARTNER_REFERRAL
    ) return { kind: "ineligible", reason: "leg_not_transferable" };
    if (!isEligibleSettlementStatus(reversal.settlement.status)) return { kind: "ineligible", reason: "settlement_not_reversal_ready" };
    if (reversal.settlement.paymentRequest.requiresManualReconciliation) return { kind: "ineligible", reason: "manual_reconciliation_required" };
    if (reversal.settlementLeg.status !== SettlementLegStatus.TRANSFERRED && reversal.settlementLeg.status !== SettlementLegStatus.REVERSAL_PENDING) {
      return { kind: "ineligible", reason: "leg_not_transferred" };
    }

    const requestedAmount = reversal.requestedAmount ?? reversal.amount;
    const successfullyReversedAmount = reversal.successfullyReversedAmount;
    const remainingAmount = requestedAmount - successfullyReversedAmount;
    if (!Number.isSafeInteger(requestedAmount) || requestedAmount <= 0 || successfullyReversedAmount < 0 || remainingAmount <= 0) {
      return { kind: "ineligible", reason: "reversal_amount_invalid" };
    }
    if (reversal.currency !== "usd" || reversal.settlementLeg.currency !== "usd") return { kind: "ineligible", reason: "reversal_currency_invalid" };
    if (!reversal.settlementLeg.stripeTransferId && !reversal.originalStripeTransferId) return { kind: "ineligible", reason: "original_transfer_missing" };
    const originalStripeTransferId = reversal.originalStripeTransferId ?? reversal.settlementLeg.stripeTransferId;
    if (!originalStripeTransferId?.startsWith("tr_")) return { kind: "ineligible", reason: "original_transfer_invalid" };
    if (reversal.nextReversalAttemptAt && reversal.nextReversalAttemptAt > now) return { kind: "ineligible", reason: "reversal_retry_not_due" };
    if (isTransferLockActive(reversal.reversalLockedAt, now)) return { kind: "ineligible", reason: "reversal_locked" };

    const executionKind = isStaleSettlementReversal(reversal, now)
      ? "stale_recovery"
      : "new_execution";
    if (executionKind === "new_execution" && reversal.reversalAttemptCount >= MAX_REVERSAL_ATTEMPTS) {
      const changed = await tx.settlementReversal.updateMany({
        where: {
          id: reversal.id,
          status: SettlementReversalStatus.PENDING,
          reversalAttemptCount: reversal.reversalAttemptCount,
          reversalLockedAt: null,
        },
        data: {
          status: SettlementReversalStatus.NEEDS_MANUAL_REVIEW,
          nextReversalAttemptAt: null,
          reversalLockedAt: null,
        },
      });
      if (changed.count !== 1) return { kind: "claim_lost" };
      await createReversalEvent(tx, {
        settlementId: reversal.settlementId,
        settlementLegId: reversal.settlementLegId,
        actorUserId,
        eventType: SettlementEventType.POST_TRANSFER_REVERSAL_REQUIRED,
        message: "A Stripe transfer reversal reached the retry limit and requires manual review.",
        metadata: {
          attempt: reversal.reversalAttemptCount,
          status: SettlementReversalStatus.NEEDS_MANUAL_REVIEW,
          reason: "max_attempts",
        },
        idempotencyKey: `settlement:${reversal.settlementId}:reversal:${reversal.id}:manual-review:${reversal.reversalAttemptCount}`,
      });
      return { kind: "ineligible", reason: "reversal_max_attempts" };
    }
    const nextAttemptCount = executionKind === "stale_recovery"
      ? reversal.reversalAttemptCount
      : reversal.reversalAttemptCount + 1;
    const lockAt = now;
    const updated = await tx.settlementReversal.updateMany({
      where: {
        id: reversal.id,
        status: SettlementReversalStatus.PENDING,
        reversalAttemptCount: reversal.reversalAttemptCount,
        reversalLockedAt: reversal.reversalLockedAt,
      },
      data: {
        requestedAmount,
        originalStripeTransferId,
        sourceType: reversal.sourceType ?? sourceTypeForReason(reversal.reason),
        reversalAttemptCount: nextAttemptCount,
        reversalLockedAt: lockAt,
        reversalLastError: null,
      },
    });
    if (updated.count !== 1) return { kind: "claim_lost" };

    await createReversalEvent(tx, {
      settlementId: reversal.settlementId,
      settlementLegId: reversal.settlementLegId,
      actorUserId,
      eventType: SettlementEventType.REVERSAL_CREATED,
      message: executionKind === "stale_recovery"
        ? "A stale Stripe transfer reversal was claimed for recovery."
        : "A Stripe transfer reversal was claimed for manual execution.",
      metadata: {
        source: reversal.sourceType ?? sourceTypeForReason(reversal.reason),
        requestedAmount,
        remainingAmount,
        attempt: nextAttemptCount,
        executionKind,
      },
      idempotencyKey: `settlement:${reversal.settlementId}:reversal:${reversal.id}:claim:${nextAttemptCount}`,
    });

    return {
      kind: "claimed",
      reversal: {
        id: reversal.id,
        settlementId: reversal.settlementId,
        settlementLegId: reversal.settlementLegId,
        requestedAmount,
        successfullyReversedAmount,
        remainingAmount,
        currency: reversal.currency,
        originalStripeTransferId,
        sourceType: reversal.sourceType ?? sourceTypeForReason(reversal.reason),
        stripeSourceObjectId: reversal.stripeSourceObjectId,
        reversalAttemptCount: nextAttemptCount,
        reversalLockedAt: lockAt,
        executionKind,
        settlement: { paymentRequestId: reversal.settlement.paymentRequestId },
      },
    };
  });
}

async function finalizeSuccessfulReversal({
  db,
  reversal,
  stripeReversal,
  actorUserId,
  now,
}: {
  db: ReversalDb;
  reversal: ClaimedReversal;
  stripeReversal: Pick<Stripe.TransferReversal, "id" | "amount">;
  actorUserId?: string | null;
  now: Date;
}) {
  if (!Number.isSafeInteger(stripeReversal.amount) || stripeReversal.amount !== reversal.remainingAmount) {
    throw new Error("Provider reversal amount did not match the claimed amount.");
  }
  const updated = await db.$transaction(async (tx) => {
    const changed = await tx.settlementReversal.updateMany({
      where: {
        id: reversal.id,
        status: SettlementReversalStatus.PENDING,
        reversalAttemptCount: reversal.reversalAttemptCount,
        reversalLockedAt: reversal.reversalLockedAt,
      },
      data: {
        status: SettlementReversalStatus.COMPLETED,
        successfullyReversedAmount: reversal.successfullyReversedAmount + stripeReversal.amount,
        stripeTransferReversalId: stripeReversal.id,
        completedAt: now,
        reversalLockedAt: null,
        nextReversalAttemptAt: null,
        reversalLastError: null,
      },
    });
    if (changed.count !== 1) return false;
    await createReversalEvent(tx, {
      settlementId: reversal.settlementId,
      settlementLegId: reversal.settlementLegId,
      actorUserId,
      eventType: SettlementEventType.REVERSED,
      message: "A Stripe transfer reversal completed for this settlement leg.",
      metadata: {
        stripeTransferReversalId: stripeReversal.id,
        amount: stripeReversal.amount,
        currency: reversal.currency,
        attempt: reversal.reversalAttemptCount,
      },
      idempotencyKey: `settlement:${reversal.settlementId}:reversal:${reversal.id}:completed:${stripeReversal.id}`,
    });

    const leg = await tx.settlementLeg.findUnique({
      where: { id: reversal.settlementLegId },
      select: { amount: true, status: true },
    });
    const legReversals = await tx.settlementReversal.findMany({
      where: { settlementLegId: reversal.settlementLegId, status: SettlementReversalStatus.COMPLETED },
      select: { successfullyReversedAmount: true },
    });
    const reversedAmount = legReversals.reduce((total, item) => total + item.successfullyReversedAmount, 0);
    if (leg && reversedAmount >= leg.amount) {
      await tx.settlementLeg.updateMany({
        where: {
          id: reversal.settlementLegId,
          status: { in: [SettlementLegStatus.TRANSFERRED, SettlementLegStatus.REVERSAL_PENDING] },
        },
        data: { status: SettlementLegStatus.REVERSED },
      });
    }

    const legs = await tx.settlementLeg.findMany({
      where: { settlementId: reversal.settlementId },
      select: { type: true, amount: true, status: true },
    });
    const externallySettled = legs
      .filter((leg) => leg.type === SettlementLegType.SELLER_PAYABLE || leg.type === SettlementLegType.PARTNER_REFERRAL)
      .every((leg) => leg.amount <= 0 || leg.status === SettlementLegStatus.REVERSED || leg.status === SettlementLegStatus.CANCELLED);
    if (externallySettled) {
      await tx.settlement.updateMany({
        where: { id: reversal.settlementId, status: SettlementStatus.REVERSAL_PENDING },
        data: { status: SettlementStatus.REVERSED },
      });
    }
    return true;
  });
  if (!updated) return false;
  return true;
}

async function persistFailure({
  db,
  reversal,
  failure,
  now,
}: {
  db: ReversalDb;
  reversal: ClaimedReversal;
  failure: SettlementReversalFailure;
  now: Date;
}) {
  const nextAttempt = nextReversalRetryAt({
    attemptCount: reversal.reversalAttemptCount,
    now,
    retryable: failure.retryable,
  });
  const status = !failure.retryable
    ? reversal.executionKind === "stale_recovery"
      ? SettlementReversalStatus.PENDING
      : SettlementReversalStatus.FAILED
    : nextAttempt || reversal.executionKind === "stale_recovery"
      ? SettlementReversalStatus.PENDING
      : SettlementReversalStatus.NEEDS_MANUAL_REVIEW;
  await db.$transaction(async (tx) => {
    const changed = await tx.settlementReversal.updateMany({
      where: {
        id: reversal.id,
        status: SettlementReversalStatus.PENDING,
        reversalAttemptCount: reversal.reversalAttemptCount,
        reversalLockedAt: reversal.reversalLockedAt,
      },
      data: {
        status,
        nextReversalAttemptAt: nextAttempt,
        reversalLastError: reversal.executionKind === "stale_recovery"
          ? `uncertain:${failure.sanitizedMessage}`
          : failure.sanitizedMessage,
        reversalLockedAt: null,
      },
    });
    if (changed.count !== 1) throw new Error("Reversal claim ownership changed.");
    await createReversalEvent(tx, {
      settlementId: reversal.settlementId,
      settlementLegId: reversal.settlementLegId,
      eventType: SettlementEventType.POST_TRANSFER_REVERSAL_REQUIRED,
      message: reversal.executionKind === "stale_recovery"
        ? "Stripe reversal recovery remains pending after a sanitized provider error."
        : "Stripe transfer reversal execution failed and was recorded for review.",
      metadata: {
        attempt: reversal.reversalAttemptCount,
        executionKind: reversal.executionKind,
        retryable: failure.retryable,
        errorCode: failure.code,
        status,
        nextReversalAttemptAt: nextAttempt?.toISOString() ?? null,
      },
      idempotencyKey: `settlement:${reversal.settlementId}:reversal:${reversal.id}:failure:${reversal.reversalAttemptCount}:${reversal.executionKind}:${failure.code}:${status}`,
    });
  });
  return { nextAttempt, status };
}

async function persistUncertainFinalization({
  db,
  reversal,
  now,
}: {
  db: ReversalDb;
  reversal: ClaimedReversal;
  now: Date;
}) {
  try {
    await db.$transaction(async (tx) => {
      const changed = await tx.settlementReversal.updateMany({
        where: {
          id: reversal.id,
          status: SettlementReversalStatus.PENDING,
          reversalAttemptCount: reversal.reversalAttemptCount,
          reversalLockedAt: reversal.reversalLockedAt,
        },
        data: {
          status: SettlementReversalStatus.PENDING,
          nextReversalAttemptAt: null,
          reversalLastError: "uncertain:reversal_finalization_failed",
        },
      });
      if (changed.count !== 1) return;
      await createReversalEvent(tx, {
        settlementId: reversal.settlementId,
        settlementLegId: reversal.settlementLegId,
        actorUserId: undefined,
        eventType: SettlementEventType.POST_TRANSFER_REVERSAL_REQUIRED,
        message: "Stripe accepted a transfer reversal but local finalization failed; recovery is required.",
        metadata: {
          attempt: reversal.reversalAttemptCount,
          executionKind: reversal.executionKind,
          reason: "reversal_finalization_failed",
          recordedAt: now.toISOString(),
        },
        idempotencyKey: `settlement:${reversal.settlementId}:reversal:${reversal.id}:finalization-failed:${reversal.reversalAttemptCount}`,
      });
    });
  } catch {
    // The provider request is already uncertain. The caller still returns a
    // sanitized finalization failure without exposing persistence details.
  }
}

export async function executeSettlementReversal({
  settlementReversalId,
  actorUserId,
  mode = getStripeConnectTransferReversalExecutionMode(),
  db,
  stripe,
  now = new Date(),
}: {
  settlementReversalId: string;
  actorUserId?: string | null;
  mode?: StripeConnectTransferReversalExecutionMode;
  db?: ReversalDb;
  stripe?: ReversalStripeClient;
  now?: Date;
}) {
  if (mode !== "manual" && mode !== "auto") {
    return {
      ok: false,
      settlementReversalId,
      status: "disabled",
      retryable: false,
      errorCode: "reversal_execution_disabled",
    } satisfies SettlementReversalExecutionResult;
  }

  let stripeClient: ReversalStripeClient;
  try {
    stripeClient = stripe ?? getStripe();
  } catch {
    return ineligible("reversal_runtime_configuration_invalid", settlementReversalId);
  }

  const executorDb = db ?? getDb();
  let claimedResult: Awaited<ReturnType<typeof claimReversal>>;
  try {
    claimedResult = await claimReversal({ db: executorDb, reversalId: settlementReversalId, actorUserId, now });
  } catch {
    return persistenceFailure(settlementReversalId);
  }
  if (claimedResult.kind === "claim_lost") return claimLost(settlementReversalId);
  if (claimedResult.kind === "ineligible") return ineligible(claimedResult.reason, settlementReversalId);

  const claimed = claimedResult.reversal;
  try {
    const accepted = await findAcceptedStripeReversal(stripeClient, claimed);
    if (!accepted.complete) {
      const persisted = await persistFailure({
        db: executorDb,
        reversal: claimed,
        failure: {
          retryable: true,
          code: "reversal_recovery_incomplete",
          sanitizedMessage: "retryable:reversal_recovery_incomplete",
        },
        now,
      });
      return {
        ok: false,
        settlementReversalId: claimed.id,
        status: claimed.executionKind === "stale_recovery" ? "recovery_pending" : "retry_scheduled",
        retryable: true,
        errorCode: "reversal_recovery_incomplete",
        nextReversalAttemptAt: persisted.nextAttempt?.toISOString() ?? null,
      } satisfies SettlementReversalExecutionResult;
    }
    const transferReversal = accepted.reversal ?? await stripeClient.transfers.createReversal(
      claimed.originalStripeTransferId,
      {
        amount: claimed.remainingAmount,
        metadata: {
          settlementId: claimed.settlementId,
          settlementLegId: claimed.settlementLegId,
          settlementReversalId: claimed.id,
          paymentRequestId: claimed.settlement.paymentRequestId,
          sourceType: claimed.sourceType ?? "UNKNOWN",
          ...(claimed.stripeSourceObjectId ? { stripeSourceObjectId: claimed.stripeSourceObjectId } : {}),
        },
      },
      { idempotencyKey: settlementReversalIdempotencyKey(claimed.id) },
    );
    try {
      const finalized = await finalizeSuccessfulReversal({
        db: executorDb,
        reversal: claimed,
        stripeReversal: transferReversal,
        actorUserId,
        now,
      });
      if (!finalized) return claimLost(claimed.id);
      return {
        ok: true,
        settlementReversalId: claimed.id,
        status: "reversed",
        retryable: false,
        stripeTransferReversalId: transferReversal.id,
      } satisfies SettlementReversalExecutionResult;
    } catch {
      await persistUncertainFinalization({ db: executorDb, reversal: claimed, now });
      return {
        ok: false,
        settlementReversalId: claimed.id,
        status: "finalization_failed",
        retryable: true,
        errorCode: "reversal_finalization_failed",
      } satisfies SettlementReversalExecutionResult;
    }
  } catch (error) {
    const failure = sanitizeStripeTransferReversalError(error);
    try {
      const persisted = await persistFailure({ db: executorDb, reversal: claimed, failure, now });
      const status = persisted.status === SettlementReversalStatus.FAILED
        ? "failed"
        : persisted.status === SettlementReversalStatus.NEEDS_MANUAL_REVIEW
          ? "needs_manual_review"
          : claimed.executionKind === "stale_recovery" && !persisted.nextAttempt
            ? "recovery_pending"
            : "retry_scheduled";
      return {
        ok: false,
        settlementReversalId: claimed.id,
        status,
        retryable: failure.retryable,
        errorCode: failure.code,
        nextReversalAttemptAt: persisted.nextAttempt?.toISOString() ?? null,
      } satisfies SettlementReversalExecutionResult;
    } catch {
      return persistenceFailure(claimed.id);
    }
  }
}

export async function requeueSettlementReversal({
  settlementReversalId,
  actorUserId,
  db,
}: {
  settlementReversalId: string;
  actorUserId: string;
  db?: ReversalDb;
}) {
  const executorDb = db ?? getDb();
  try {
    return await executorDb.$transaction(async (tx) => {
      const advisory = await tx.$queryRaw<Array<{ acquired: boolean }>>(
        Prisma.sql`SELECT pg_try_advisory_xact_lock(hashtextextended(${`trade82-settlement-reversal:${settlementReversalId}`}, 0)) AS acquired`,
      );
      if (!advisory[0]?.acquired) {
        return { ok: false, settlementReversalId, status: "claim_lost", retryable: false, errorCode: "reversal_claim_lost" };
      }

      const before = await tx.settlementReversal.findUnique({
        where: { id: settlementReversalId },
        select: { settlementId: true },
      });
      if (!before) return { ok: false, settlementReversalId, status: "ineligible", retryable: false, errorCode: "reversal_not_found" };
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Settlement" WHERE "id" = ${before.settlementId} FOR UPDATE`);

      const reversal = await tx.settlementReversal.findUnique({
        where: { id: settlementReversalId },
        select: {
          id: true,
          settlementId: true,
          settlementLegId: true,
          amount: true,
          requestedAmount: true,
          successfullyReversedAmount: true,
          status: true,
          originalStripeTransferId: true,
          stripeTransferReversalId: true,
          reversalAttemptCount: true,
          manualRequeueCount: true,
        settlementLeg: { select: { type: true } },
        },
      });
      if (!reversal) return { ok: false, settlementReversalId, status: "ineligible", retryable: false, errorCode: "reversal_not_found" };
      if (
        reversal.status !== SettlementReversalStatus.FAILED
        && reversal.status !== SettlementReversalStatus.NEEDS_MANUAL_REVIEW
      ) return { ok: false, settlementReversalId, status: "ineligible", retryable: false, errorCode: "reversal_not_requeueable" };
      if (reversal.stripeTransferReversalId) return { ok: false, settlementReversalId, status: "ineligible", retryable: false, errorCode: "reversal_already_completed" };
      if (reversal.settlementLeg.type === SettlementLegType.PLATFORM_FEE) return { ok: false, settlementReversalId, status: "ineligible", retryable: false, errorCode: "platform_fee_not_reversible" };

      const requestedAmount = reversal.requestedAmount ?? reversal.amount;
      const remainingAmount = requestedAmount - reversal.successfullyReversedAmount;
      const originalStripeTransferId = reversal.originalStripeTransferId;
      if (!Number.isSafeInteger(remainingAmount) || remainingAmount <= 0) {
        return { ok: false, settlementReversalId, status: "ineligible", retryable: false, errorCode: "reversal_amount_invalid" };
      }
      if (!originalStripeTransferId?.startsWith("tr_")) {
        return { ok: false, settlementReversalId, status: "ineligible", retryable: false, errorCode: "original_transfer_invalid" };
      }

      const manualRequeueCount = reversal.manualRequeueCount + 1;
      const changed = await tx.settlementReversal.updateMany({
        where: {
          id: reversal.id,
          status: reversal.status,
          reversalAttemptCount: reversal.reversalAttemptCount,
          manualRequeueCount: reversal.manualRequeueCount,
        },
        data: {
          status: SettlementReversalStatus.PENDING,
          reversalAttemptCount: 0,
          manualRequeueCount,
          nextReversalAttemptAt: null,
          reversalLockedAt: null,
          reversalLastError: null,
          completedAt: null,
        },
      });
      if (changed.count !== 1) return { ok: false, settlementReversalId, status: "claim_lost", retryable: false, errorCode: "reversal_claim_lost" };

      await createReversalEvent(tx, {
        settlementId: reversal.settlementId,
        settlementLegId: reversal.settlementLegId,
        actorUserId,
        eventType: SettlementEventType.POST_TRANSFER_REVERSAL_REQUIRED,
        message: "An administrator requeued a transfer reversal for separate manual execution.",
        metadata: {
          action: "requeue",
          previousStatus: reversal.status,
          previousAttemptCount: reversal.reversalAttemptCount,
          manualRequeueCount,
          requestedAmount,
          remainingAmount,
        },
        idempotencyKey: `settlement:${reversal.settlementId}:reversal:${reversal.id}:requeue:${manualRequeueCount}`,
      });
      return {
        ok: true,
        settlementReversalId,
        status: "requeued",
        retryable: false,
        nextReversalAttemptAt: null,
      };
    });
  } catch {
    return { ok: false, settlementReversalId, status: "persistence_failed", retryable: false, errorCode: "reversal_persistence_failed" };
  }
}
