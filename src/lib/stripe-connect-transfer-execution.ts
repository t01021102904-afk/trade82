import "server-only";

import type Stripe from "stripe";
import {
  PaymentRequestStatus,
  Prisma,
  SettlementEventType,
  SettlementLegStatus,
  SettlementLegType,
  SettlementPaymentFlow,
  SettlementStatus,
  StripeConnectedAccountStatus,
} from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import {
  getStripeConnectTransferExecutionMode,
  type StripeConnectTransferExecutionMode,
} from "@/lib/stripe-connect-transfer-execution-mode";
import { assertStripeConnectRuntimeConfiguration } from "@/lib/stripe-connect-runtime-mode";
import {
  isTransferLockActive,
  TRANSFER_LOCK_TIMEOUT_MS,
} from "@/lib/stripe-connect-transfer-recovery";

const transferableLegTypes = new Set<SettlementLegType>([
  SettlementLegType.SELLER_PAYABLE,
  SettlementLegType.PARTNER_REFERRAL,
]);

const MAX_TRANSFER_ATTEMPTS = 5;

const retryableErrorTypes = new Set([
  "api_connection_error",
  "api_error",
  "idempotency_error",
  "rate_limit_error",
]);

const safeStripeCodes = new Set([
  "account_invalid",
  "amount_too_small",
  "authentication_required",
  "balance_insufficient",
  "charge_not_found",
  "idempotency_key_in_use",
  "lock_timeout",
  "rate_limit",
  "resource_missing",
]);

type TransferExecutorDb = ReturnType<typeof getDb>;

type TransferAccount = {
  stripeAccountId: string;
  status: StripeConnectedAccountStatus;
  transfersEnabled: boolean;
  payoutsEnabled: boolean;
} | null | undefined;

type ClaimedTransferLeg = Prisma.SettlementLegGetPayload<{
  include: {
    settlement: {
      include: {
        paymentRequest: {
          select: {
            id: true;
            status: true;
            stripeChargeId: true;
            requiresManualReconciliation: true;
          };
        };
      };
    };
    recipientCompany: {
      select: {
        stripeConnectedAccount: {
          select: {
            stripeAccountId: true;
            status: true;
            transfersEnabled: true;
            payoutsEnabled: true;
          };
        };
      };
    };
    partnerProfile: {
      select: {
        stripeConnectedAccount: {
          select: {
            stripeAccountId: true;
            status: true;
            transfersEnabled: true;
            payoutsEnabled: true;
          };
        };
      };
    };
  };
}>;

type TransferExecutionKind = "new_execution" | "stale_recovery";

export type SettlementTransferExecutionResult = {
  ok: boolean;
  settlementLegId: string;
  status:
    | "disabled"
    | "claimed"
    | "transferred"
    | "retry_scheduled"
    | "failed"
    | "ineligible"
    | "claim_lost"
    | "persistence_failed"
    | "finalization_failed";
  retryable: boolean;
  errorCode?: string;
  nextTransferAttemptAt?: string | null;
  stripeTransferId?: string;
};

export type SettlementTransferFailure = {
  retryable: boolean;
  code: string;
  sanitizedMessage: string;
};

export function settlementTransferIdempotencyKey(settlementLegId: string) {
  return `stripe-connect-transfer:settlement-leg:${settlementLegId}`;
}

export function isActivelyTransferLocked(lockedAt: Date | null | undefined, now: Date) {
  return isTransferLockActive(lockedAt, now);
}

export function isTransferExecutionAccountReady(account: TransferAccount) {
  return Boolean(
    account
    && account.status === StripeConnectedAccountStatus.ENABLED
    && account.transfersEnabled
    && account.payoutsEnabled
    && account.stripeAccountId.startsWith("acct_"),
  );
}

export function nextTransferRetryAt({
  attemptCount,
  now,
  retryable,
}: {
  attemptCount: number;
  now: Date;
  retryable: boolean;
}) {
  if (!retryable || attemptCount >= MAX_TRANSFER_ATTEMPTS) return null;
  const delayMinutes = [15, 60, 240, 720][Math.min(attemptCount - 1, 3)] ?? 720;
  return new Date(now.getTime() + delayMinutes * 60_000);
}

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

export function sanitizeStripeTransferError(error: unknown): SettlementTransferFailure {
  const type = stringProperty(error, "type");
  const code = stringProperty(error, "code");
  const statusCode = numberProperty(error, "statusCode");
  const safeCode = code && safeStripeCodes.has(code) ? code : type && retryableErrorTypes.has(type) ? type : "stripe_transfer_failed";
  const retryable = retryableErrorTypes.has(type ?? "") || Boolean(statusCode && statusCode >= 500);
  return {
    retryable,
    code: safeCode,
    sanitizedMessage: retryable ? `retryable:${safeCode}` : `permanent:${safeCode}`,
  };
}

function accountForLeg(leg: ClaimedTransferLeg) {
  return leg.type === SettlementLegType.SELLER_PAYABLE
    ? leg.recipientCompany?.stripeConnectedAccount
    : leg.partnerProfile?.stripeConnectedAccount;
}

function ineligible(code: string, legId: string): SettlementTransferExecutionResult {
  return {
    ok: false,
    settlementLegId: legId,
    status: "ineligible",
    retryable: false,
    errorCode: code,
  };
}

export function validateClaimedTransferLeg(leg: ClaimedTransferLeg, now: Date) {
  if (leg.status !== SettlementLegStatus.TRANSFER_PENDING) return "not_claimed";
  return validateTransferLegEligibility(leg, now, { claimed: true });
}

export function validateTransferLegEligibility(
  leg: ClaimedTransferLeg,
  now: Date,
  { claimed = false }: { claimed?: boolean } = {},
) {
  if (leg.settlement.paymentFlow !== SettlementPaymentFlow.SCT) return "direct_charge_not_supported";
  if (!transferableLegTypes.has(leg.type)) return "not_transferable";
  if (leg.manualReviewRequired) return "manual_review_required";
  if (
    !claimed
    && leg.status !== SettlementLegStatus.READY
    && leg.status !== SettlementLegStatus.TRANSFER_PENDING
  ) {
    return "not_claimable";
  }
  if (!claimed && isActivelyTransferLocked(leg.transferLockedAt, now)) return "transfer_locked";
  if (leg.amount <= 0) return "invalid_amount";
  if (leg.currency !== "usd") return "invalid_currency";
  if (leg.holdUntil > now) return "hold_not_expired";
  if (leg.status === SettlementLegStatus.READY && leg.transferAttemptCount >= MAX_TRANSFER_ATTEMPTS) {
    return "max_attempts";
  }
  if (leg.nextTransferAttemptAt && leg.nextTransferAttemptAt > now) return "retry_not_due";
  if (leg.stripeTransferId || leg.transferredAt) return "already_transferred";
  const canRecoverStalePendingSettlement = (
    !claimed
    && leg.status === SettlementLegStatus.TRANSFER_PENDING
    && leg.settlement.status === SettlementStatus.TRANSFER_PENDING
    && !isActivelyTransferLocked(leg.transferLockedAt, now)
  );
  if (leg.settlement.status !== SettlementStatus.READY && !canRecoverStalePendingSettlement) {
    return "settlement_not_ready";
  }
  if (!leg.settlement.approvedAt) return "not_approved";
  if (leg.settlement.holdReason) return "settlement_on_hold";
  if (leg.settlement.paymentRequest.status !== PaymentRequestStatus.PAID) return "payment_not_paid";
  if (leg.settlement.paymentRequest.requiresManualReconciliation) return "manual_reconciliation_required";
  if (!leg.settlement.paymentRequest.stripeChargeId) return "missing_source_charge";
  if (!isTransferExecutionAccountReady(accountForLeg(leg))) return "destination_not_transfer_capable";
  return null;
}

async function createTransferEvent(
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
  const existing = await tx.settlementEvent.findUnique({
    where: { idempotencyKey },
    select: { id: true },
  });
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

async function refreshSettlementStatus(tx: Prisma.TransactionClient, settlementId: string) {
  const legs = await tx.settlementLeg.findMany({
    where: {
      settlementId,
      type: { in: [SettlementLegType.SELLER_PAYABLE, SettlementLegType.PARTNER_REFERRAL] },
    },
    select: { status: true },
  });

  if (legs.length === 0) return;
  const allTransferred = legs.every((leg) => (
    leg.status === SettlementLegStatus.TRANSFERRED
    || leg.status === SettlementLegStatus.CANCELLED
    || leg.status === SettlementLegStatus.REVERSED
  ));
  const hasPending = legs.some((leg) => leg.status === SettlementLegStatus.TRANSFER_PENDING);
  const hasReady = legs.some((leg) => leg.status === SettlementLegStatus.READY);
  const nextStatus = allTransferred
    ? SettlementStatus.TRANSFERRED
    : hasPending
      ? SettlementStatus.TRANSFER_PENDING
      : hasReady
        ? SettlementStatus.READY
        : SettlementStatus.HOLD;

  await tx.settlement.update({ where: { id: settlementId }, data: { status: nextStatus } });
}

async function claimTransferLeg({
  db,
  settlementLegId,
  now,
  actorUserId,
}: {
  db: TransferExecutorDb;
  settlementLegId: string;
  now: Date;
    actorUserId?: string | null;
}) {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`trade82-settlement-transfer:${settlementLegId}`}, 0))`;
    const lockExpiresBefore = new Date(now.getTime() - TRANSFER_LOCK_TIMEOUT_MS);
    const legReference = await tx.settlementLeg.findUnique({
      where: { id: settlementLegId },
      select: { settlementId: true },
    });
    if (!legReference) return { kind: "not_claimable" as const };

    const lockedSettlement = await tx.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`SELECT "id" FROM "Settlement" WHERE "id" = ${legReference.settlementId} FOR UPDATE`,
    );
    if (lockedSettlement.length === 0) return { kind: "not_claimable" as const };

    const currentLeg = await tx.settlementLeg.findUnique({
      where: { id: settlementLegId },
      include: {
        settlement: {
          include: {
            paymentRequest: {
              select: {
                id: true,
                status: true,
                stripeChargeId: true,
                requiresManualReconciliation: true,
              },
            },
          },
        },
        recipientCompany: {
          select: {
            stripeConnectedAccount: {
              select: {
                stripeAccountId: true,
                status: true,
                transfersEnabled: true,
                payoutsEnabled: true,
              },
            },
          },
        },
        partnerProfile: {
          select: {
            stripeConnectedAccount: {
              select: {
                stripeAccountId: true,
                status: true,
                transfersEnabled: true,
                payoutsEnabled: true,
              },
            },
          },
        },
      },
    });

    if (!currentLeg) return { kind: "not_claimable" as const };
    const eligibility = validateTransferLegEligibility(currentLeg, now);
    if (eligibility) return { kind: "ineligible" as const, reason: eligibility };

    const isStaleRecovery = currentLeg.status === SettlementLegStatus.TRANSFER_PENDING;
    const updated = await tx.settlementLeg.updateMany({
      where: {
        id: currentLeg.id,
        status: currentLeg.status,
        transferAttemptCount: currentLeg.transferAttemptCount,
        stripeTransferId: null,
        transferredAt: null,
        AND: [
          {
            OR: [
              { nextTransferAttemptAt: null },
              { nextTransferAttemptAt: { lte: now } },
            ],
          },
          currentLeg.status === SettlementLegStatus.READY
            ? {
              OR: [
                { transferLockedAt: null },
                { transferLockedAt: { lt: lockExpiresBefore } },
              ],
            }
            : { transferLockedAt: currentLeg.transferLockedAt },
        ],
      },
      data: {
        status: SettlementLegStatus.TRANSFER_PENDING,
        transferLockedAt: now,
        transferAttemptCount: isStaleRecovery
          ? currentLeg.transferAttemptCount
          : { increment: 1 },
        transferLastError: null,
      },
    });
    if (updated.count !== 1) return { kind: "not_claimable" as const };

    const leg = await tx.settlementLeg.findUniqueOrThrow({
      where: { id: settlementLegId },
      include: {
        settlement: {
          include: {
            paymentRequest: {
              select: {
                id: true,
                status: true,
                stripeChargeId: true,
                requiresManualReconciliation: true,
              },
            },
          },
        },
        recipientCompany: {
          select: {
            stripeConnectedAccount: {
              select: {
                stripeAccountId: true,
                status: true,
                transfersEnabled: true,
                payoutsEnabled: true,
              },
            },
          },
        },
        partnerProfile: {
          select: {
            stripeConnectedAccount: {
              select: {
                stripeAccountId: true,
                status: true,
                transfersEnabled: true,
                payoutsEnabled: true,
              },
            },
          },
        },
      },
    });

    await createTransferEvent(tx, {
      settlementId: leg.settlementId,
      settlementLegId: leg.id,
      eventType: SettlementEventType.TRANSFER_PENDING,
      actorUserId,
      message: "An administrator claimed this settlement leg for Stripe transfer execution.",
      metadata: {
        attempt: leg.transferAttemptCount,
        claimedAt: now.toISOString(),
      },
      idempotencyKey: `settlement:${leg.settlementId}:leg:${leg.id}:transfer-attempt:${leg.transferAttemptCount}:claimed`,
    });
    await refreshSettlementStatus(tx, leg.settlementId);
    return {
      kind: "claimed" as const,
      leg,
      executionKind: isStaleRecovery ? "stale_recovery" as const : "new_execution" as const,
    };
  });
}

function claimOwnershipWhere(leg: ClaimedTransferLeg) {
  return {
    id: leg.id,
    status: SettlementLegStatus.TRANSFER_PENDING,
    transferLockedAt: leg.transferLockedAt,
    transferAttemptCount: leg.transferAttemptCount,
  };
}

function persistenceFailure(legId: string): SettlementTransferExecutionResult {
  return {
    ok: false,
    settlementLegId: legId,
    status: "persistence_failed",
    retryable: false,
    errorCode: "transfer_state_persistence_failed",
  };
}

function claimLost(legId: string): SettlementTransferExecutionResult {
  return {
    ok: false,
    settlementLegId: legId,
    status: "claim_lost",
    retryable: false,
    errorCode: "transfer_claim_lost",
  };
}

async function releaseFailedClaim({
  db,
  leg,
  now,
  failure,
  actorUserId,
  executionKind,
}: {
  db: TransferExecutorDb;
  leg: ClaimedTransferLeg;
  now: Date;
  failure: SettlementTransferFailure;
  actorUserId?: string | null;
  executionKind: TransferExecutionKind;
}) {
  const isStaleRecovery = executionKind === "stale_recovery";
  const nextTransferAttemptAt = isStaleRecovery
    ? (failure.retryable ? new Date(now.getTime() + 15 * 60_000) : null)
    : nextTransferRetryAt({
      attemptCount: leg.transferAttemptCount,
      now,
      retryable: failure.retryable,
    });

  const updated = await db.$transaction(async (tx) => {
    const changed = await tx.settlementLeg.updateMany({
      where: claimOwnershipWhere(leg),
      data: {
        status: isStaleRecovery ? SettlementLegStatus.TRANSFER_PENDING : SettlementLegStatus.READY,
        transferLockedAt: null,
        transferLastError: failure.sanitizedMessage,
        nextTransferAttemptAt,
      },
    });
    if (changed.count !== 1) return false;
    await createTransferEvent(tx, {
      settlementId: leg.settlementId,
      settlementLegId: leg.id,
      eventType: SettlementEventType.TRANSFER_PENDING,
      actorUserId,
      message: isStaleRecovery
        ? failure.retryable
          ? "Stale Stripe transfer recovery failed with a retryable error; the uncertain transfer remains pending."
          : "Stale Stripe transfer recovery failed; the uncertain transfer remains pending."
        : failure.retryable
          ? "Stripe transfer execution failed with a retryable error."
          : "Stripe transfer execution failed with a permanent error.",
      metadata: {
        attempt: leg.transferAttemptCount,
        executionKind,
        code: failure.code,
        retryable: failure.retryable,
        nextTransferAttemptAt: nextTransferAttemptAt?.toISOString() ?? null,
      },
      idempotencyKey: isStaleRecovery
        ? `settlement:${leg.settlementId}:leg:${leg.id}:transfer-attempt:${leg.transferAttemptCount}:claim:${leg.transferLockedAt?.toISOString() ?? "unknown"}:recovery-failed`
        : `settlement:${leg.settlementId}:leg:${leg.id}:transfer-attempt:${leg.transferAttemptCount}:failed`,
    });
    await refreshSettlementStatus(tx, leg.settlementId);
    return true;
  });

  if (!updated) return claimLost(leg.id);

  return {
    ok: false,
    settlementLegId: leg.id,
    status: nextTransferAttemptAt ? "retry_scheduled" : "failed",
    retryable: failure.retryable,
    errorCode: failure.code,
    nextTransferAttemptAt: nextTransferAttemptAt?.toISOString() ?? null,
  } satisfies SettlementTransferExecutionResult;
}

async function finalizeSuccessfulTransfer({
  db,
  leg,
  transfer,
  now,
  actorUserId,
}: {
  db: TransferExecutorDb;
  leg: ClaimedTransferLeg;
  transfer: Pick<Stripe.Transfer, "id">;
  now: Date;
  actorUserId?: string | null;
}) {
  const updated = await db.$transaction(async (tx) => {
    const changed = await tx.settlementLeg.updateMany({
      where: claimOwnershipWhere(leg),
      data: {
        status: SettlementLegStatus.TRANSFERRED,
        stripeTransferId: transfer.id,
        transferredAt: now,
        transferLockedAt: null,
        nextTransferAttemptAt: null,
        transferLastError: null,
      },
    });
    if (changed.count !== 1) return false;
    await createTransferEvent(tx, {
      settlementId: leg.settlementId,
      settlementLegId: leg.id,
      eventType: SettlementEventType.TRANSFERRED,
      actorUserId,
      message: "Stripe transfer completed for this settlement leg.",
      metadata: {
        attempt: leg.transferAttemptCount,
        stripeTransferId: transfer.id,
        transferredAt: now.toISOString(),
      },
      idempotencyKey: `settlement:${leg.settlementId}:leg:${leg.id}:transfer:${transfer.id}:completed`,
    });
    await refreshSettlementStatus(tx, leg.settlementId);
    return true;
  });

  if (!updated) return claimLost(leg.id);

  return {
    ok: true,
    settlementLegId: leg.id,
    status: "transferred",
    retryable: false,
    stripeTransferId: transfer.id,
  } satisfies SettlementTransferExecutionResult;
}

export async function executeSettlementLegTransfer({
  settlementLegId,
  actorUserId,
  mode = getStripeConnectTransferExecutionMode(),
  db,
  stripe,
  now = new Date(),
  assertRuntime = assertStripeConnectRuntimeConfiguration,
}: {
  settlementLegId: string;
  actorUserId?: string | null;
  mode?: StripeConnectTransferExecutionMode;
  db?: TransferExecutorDb;
  stripe?: Pick<Stripe, "transfers">;
  now?: Date;
  assertRuntime?: () => unknown;
}) {
  if (mode !== "manual" && mode !== "auto") {
    return {
      ok: false,
      settlementLegId,
      status: "disabled",
      retryable: false,
      errorCode: "transfer_execution_disabled",
    } satisfies SettlementTransferExecutionResult;
  }

  try {
    assertRuntime();
  } catch {
    return ineligible("runtime_configuration_invalid", settlementLegId);
  }

  const executorDb = db ?? getDb();
  const claimedResult = await claimTransferLeg({ db: executorDb, settlementLegId, now, actorUserId });
  if (claimedResult.kind === "not_claimable") return ineligible("not_claimable", settlementLegId);
  if (claimedResult.kind === "ineligible") return ineligible(claimedResult.reason, settlementLegId);
  const claimed = claimedResult.leg;
  const stripeClient = stripe ?? getStripe();

  const account = accountForLeg(claimed)!;
  const chargeId = claimed.settlement.paymentRequest.stripeChargeId!;
  const idempotencyKey = settlementTransferIdempotencyKey(claimed.id);

  try {
    const transfer = await stripeClient.transfers.create(
      {
        amount: claimed.amount,
        currency: claimed.currency,
        destination: account.stripeAccountId,
        source_transaction: chargeId,
        metadata: {
          settlementId: claimed.settlementId,
          settlementLegId: claimed.id,
          paymentRequestId: claimed.settlement.paymentRequest.id,
          tradeOrderId: claimed.settlement.tradeOrderId,
          legType: claimed.type,
        },
      },
      { idempotencyKey },
    );
    try {
      return await finalizeSuccessfulTransfer({ db: executorDb, leg: claimed, transfer, now, actorUserId });
    } catch {
      return {
        ...persistenceFailure(claimed.id),
        status: "finalization_failed",
        errorCode: "transfer_finalization_failed",
      } satisfies SettlementTransferExecutionResult;
    }
  } catch (error) {
    try {
      return await releaseFailedClaim({
        db: executorDb,
        leg: claimed,
        now,
        actorUserId,
        executionKind: claimedResult.executionKind,
        failure: sanitizeStripeTransferError(error),
      });
    } catch {
      return persistenceFailure(claimed.id);
    }
  }
}
