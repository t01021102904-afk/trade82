import "server-only";

import {
  Prisma,
  SettlementEventType,
  SettlementLegStatus,
  SettlementLegType,
  SettlementOperationalAlertSeverity,
  SettlementOperationalAlertStatus,
  SettlementOperationalAlertType,
  SettlementPaymentFlow,
  SettlementReversalStatus,
  SettlementStatus,
  SettlementWorkerRunStatus,
  SettlementWorkerType,
  PaymentRequestStatus,
  OrderPaymentStatus,
  TradeOrderStatus,
} from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { executeSettlementLegTransfer } from "@/lib/stripe-connect-transfer-execution";
import { getStripeConnectTransferExecutionMode } from "@/lib/stripe-connect-transfer-execution-mode";
import { executeSettlementReversal } from "@/lib/stripe-connect-transfer-reversal-execution";
import { getStripeConnectTransferReversalExecutionMode } from "@/lib/stripe-connect-transfer-reversal-mode";
import { getStripe } from "@/lib/stripe";

export const DEFAULT_SETTLEMENT_WORKER_BATCH_SIZE = 20;
export const SETTLEMENT_WORKER_STALE_LOCK_MS = 10 * 60 * 1000;
export const SETTLEMENT_WORKER_MAX_DURATION_MS = 5 * 60 * 1000;
export const SETTLEMENT_LONG_PENDING_AGE_MS = 24 * 60 * 60 * 1000;

const TRANSFERABLE_LEG_TYPES = new Set<SettlementLegType>([
  SettlementLegType.SELLER_PAYABLE,
  SettlementLegType.PARTNER_REFERRAL,
]);
const TRANSFERABLE_LEG_STATUSES = new Set<SettlementLegStatus>([
  SettlementLegStatus.TRANSFERRED,
  SettlementLegStatus.REVERSAL_PENDING,
]);
const BLOCKED_ORDER_STATUSES = new Set<TradeOrderStatus>([
  TradeOrderStatus.CANCELLED,
  TradeOrderStatus.REFUNDED,
  TradeOrderStatus.DISPUTED,
]);

type OperationsDb = ReturnType<typeof getDb>;

type WorkerRunSummary = {
  workerRunId: string | null;
  executionMode: "off" | "manual" | "auto";
  status: "SUCCEEDED" | "PARTIALLY_FAILED" | "FAILED" | "SKIPPED";
  scannedCount: number;
  claimedCount: number;
  succeededCount: number;
  failedCount: number;
  skippedCount: number;
  manualReviewCount: number;
  staleRecoveredCount: number;
  timedOut?: boolean;
};

type RunOptions = {
  db?: OperationsDb;
  stripe?: Parameters<typeof executeSettlementLegTransfer>[0]["stripe"];
  transferExecutor?: typeof executeSettlementLegTransfer;
  reversalExecutor?: typeof executeSettlementReversal;
  now?: Date;
  clock?: () => Date;
  batchSize?: number;
};

export function createSettlementWorkerClock() {
  return () => new Date();
}

function boundedBatchSize(value: number | undefined) {
  if (!Number.isFinite(value) || !value) return DEFAULT_SETTLEMENT_WORKER_BATCH_SIZE;
  return Math.min(100, Math.max(1, Math.floor(value)));
}

function safeWorkerErrorCode(value: string | undefined) {
  return new Set([
    "transfer_execution_disabled",
    "reversal_execution_disabled",
    "runtime_configuration_invalid",
    "reversal_runtime_configuration_invalid",
    "stripe_transfer_failed",
    "stripe_transfer_reversal_failed",
    "rate_limit_error",
    "api_connection_error",
    "api_error",
    "idempotency_error",
    "resource_missing",
    "account_invalid",
    "balance_insufficient",
    "max_attempts",
    "reversal_max_attempts",
    "worker_timeout",
  ]).has(value ?? "") ? value : "worker_failed";
}

export function resolveSettlementWorkerRunStatus(summary: Pick<WorkerRunSummary, "failedCount" | "manualReviewCount" | "succeededCount" | "scannedCount" | "timedOut">) {
  if (summary.scannedCount === 0) return SettlementWorkerRunStatus.SUCCEEDED;
  if (summary.timedOut) return summary.succeededCount > 0 ? SettlementWorkerRunStatus.PARTIALLY_FAILED : SettlementWorkerRunStatus.FAILED;
  const unsuccessfulCount = summary.failedCount + summary.manualReviewCount;
  if (unsuccessfulCount > 0 && summary.succeededCount > 0) return SettlementWorkerRunStatus.PARTIALLY_FAILED;
  if (unsuccessfulCount > 0) return SettlementWorkerRunStatus.FAILED;
  return SettlementWorkerRunStatus.SUCCEEDED;
}

async function startWorkerRun(db: OperationsDb, workerType: SettlementWorkerType, executionMode: string, now: Date) {
  return db.settlementWorkerRun.create({
    data: { workerType, executionMode, status: SettlementWorkerRunStatus.RUNNING, startedAt: now },
    select: { id: true, startedAt: true },
  });
}

async function finishWorkerRun(
  db: OperationsDb,
  run: { id: string; startedAt: Date },
  summary: WorkerRunSummary,
  now: Date,
  sanitizedErrorCode?: string,
) {
  const durationMs = Math.max(0, now.getTime() - run.startedAt.getTime());
  await db.settlementWorkerRun.update({
    where: { id: run.id },
    data: {
      status: resolveSettlementWorkerRunStatus(summary),
      completedAt: now,
      scannedCount: summary.scannedCount,
      claimedCount: summary.claimedCount,
      succeededCount: summary.succeededCount,
      failedCount: summary.failedCount,
      skippedCount: summary.skippedCount,
      manualReviewCount: summary.manualReviewCount,
      staleRecoveredCount: summary.staleRecoveredCount,
      durationMs,
      ...(sanitizedErrorCode ? { sanitizedErrorCode: safeWorkerErrorCode(sanitizedErrorCode) } : {}),
      ...(!sanitizedErrorCode && summary.timedOut ? { sanitizedErrorCode: "worker_timeout" } : {}),
    },
  });
}

async function skippedWorkerRun(
  db: OperationsDb,
  workerType: SettlementWorkerType,
  executionMode: "off" | "manual" | "auto",
  now: Date,
): Promise<WorkerRunSummary> {
  const run = await db.settlementWorkerRun.create({
    data: { workerType, executionMode, status: SettlementWorkerRunStatus.SKIPPED, startedAt: now, completedAt: now, durationMs: 0 },
    select: { id: true },
  });
  return {
    workerRunId: run.id,
    executionMode,
    status: "SKIPPED",
    scannedCount: 0,
    claimedCount: 0,
    succeededCount: 0,
    failedCount: 0,
    skippedCount: 0,
    manualReviewCount: 0,
    staleRecoveredCount: 0,
  };
}

async function transferCandidateIds(db: OperationsDb, now: Date, batchSize: number) {
  return db.$transaction(async (tx) => tx.$queryRaw<Array<{ id: string; staleRecovery: boolean }>>(Prisma.sql`
    SELECT leg."id",
      (leg."status" = 'TRANSFER_PENDING'::"SettlementLegStatus") AS "staleRecovery"
    FROM "SettlementLeg" AS leg
    JOIN "Settlement" AS settlement ON settlement."id" = leg."settlementId"
    JOIN "PaymentRequest" AS payment ON payment."id" = settlement."paymentRequestId"
    JOIN "TradeOrder" AS order_record ON order_record."id" = settlement."tradeOrderId"
    WHERE settlement."paymentFlow" = ${SettlementPaymentFlow.SCT}::"SettlementPaymentFlow"
      AND settlement."approvedAt" IS NOT NULL
      AND leg."type" IN ('SELLER_PAYABLE'::"SettlementLegType", 'PARTNER_REFERRAL'::"SettlementLegType")
      AND (
        (settlement."status" = 'READY'::"SettlementStatus" AND leg."status" = 'READY'::"SettlementLegStatus")
        OR (settlement."status" = 'TRANSFER_PENDING'::"SettlementStatus" AND leg."status" = 'TRANSFER_PENDING'::"SettlementLegStatus")
      )
      AND leg."manualReviewRequired" = false
      AND leg."holdUntil" <= ${now}
      AND leg."amount" > 0
      AND leg."currency" = 'usd'
      AND leg."stripeTransferId" IS NULL
      AND leg."transferredAt" IS NULL
      AND payment."status" = 'PAID'::"PaymentRequestStatus"
      AND payment."requiresManualReconciliation" = false
      AND payment."refundAmount" = 0
      AND payment."currency" = 'usd'
      AND order_record."paymentStatus" = 'PAID'::"OrderPaymentStatus"
      AND order_record."orderStatus" NOT IN ('CANCELLED'::"TradeOrderStatus", 'REFUNDED'::"TradeOrderStatus", 'DISPUTED'::"TradeOrderStatus")
      AND NOT EXISTS (SELECT 1 FROM "PaymentDispute" AS dispute WHERE dispute."paymentRequestId" = payment."id")
      AND (leg."nextTransferAttemptAt" IS NULL OR leg."nextTransferAttemptAt" <= ${now})
      AND (leg."transferLockedAt" IS NULL OR leg."transferLockedAt" < ${new Date(now.getTime() - SETTLEMENT_WORKER_STALE_LOCK_MS)})
    ORDER BY leg."holdUntil" ASC, leg."id" ASC
    FOR UPDATE OF leg SKIP LOCKED
    LIMIT ${batchSize}
  `));
}

async function reversalCandidateIds(db: OperationsDb, now: Date, batchSize: number) {
  return db.$transaction(async (tx) => tx.$queryRaw<Array<{ id: string; settlementId: string }>>(Prisma.sql`
    SELECT reversal."id", reversal."settlementId"
    FROM "SettlementReversal" AS reversal
    JOIN "Settlement" AS settlement ON settlement."id" = reversal."settlementId"
    JOIN "SettlementLeg" AS leg ON leg."id" = reversal."settlementLegId"
      AND leg."settlementId" = reversal."settlementId"
    JOIN "PaymentRequest" AS payment ON payment."id" = settlement."paymentRequestId"
    WHERE settlement."paymentFlow" = ${SettlementPaymentFlow.SCT}::"SettlementPaymentFlow"
      AND reversal."status" = 'PENDING'::"SettlementReversalStatus"
      AND reversal."settlementLegId" IS NOT NULL
      AND leg."type" IN ('SELLER_PAYABLE'::"SettlementLegType", 'PARTNER_REFERRAL'::"SettlementLegType")
      AND leg."status" IN ('TRANSFERRED'::"SettlementLegStatus", 'REVERSAL_PENDING'::"SettlementLegStatus")
      AND (
        payment."status" <> 'DISPUTED'::"PaymentRequestStatus"
        OR reversal."sourceType" = 'DISPUTE_LOST'::"SettlementReversalSourceType"
      )
      AND payment."requiresManualReconciliation" = false
      AND payment."currency" = 'usd'
      AND leg."currency" = 'usd'
      AND (reversal."nextReversalAttemptAt" IS NULL OR reversal."nextReversalAttemptAt" <= ${now})
      AND (reversal."reversalLockedAt" IS NULL OR reversal."reversalLockedAt" < ${new Date(now.getTime() - SETTLEMENT_WORKER_STALE_LOCK_MS)})
    ORDER BY reversal."createdAt" ASC, reversal."id" ASC
    FOR UPDATE OF reversal SKIP LOCKED
    LIMIT ${batchSize}
  `));
}

export async function runSettlementTransferBatch({ db = getDb(), stripe, transferExecutor = executeSettlementLegTransfer, now, clock, batchSize }: RunOptions = {}) {
  const readNow = clock ?? createSettlementWorkerClock();
  const startedAt = now ?? readNow();
  const mode = getStripeConnectTransferExecutionMode();
  if (mode !== "auto") return skippedWorkerRun(db, SettlementWorkerType.TRANSFER, mode, startedAt);
  const run = await startWorkerRun(db, SettlementWorkerType.TRANSFER, mode, startedAt);
  const ids = await transferCandidateIds(db, startedAt, boundedBatchSize(batchSize));
  const summary: WorkerRunSummary = {
    workerRunId: run.id,
    executionMode: mode,
    status: "SUCCEEDED",
    scannedCount: ids.length,
    claimedCount: 0,
    succeededCount: 0,
    failedCount: 0,
    skippedCount: 0,
    manualReviewCount: 0,
    staleRecoveredCount: 0,
    timedOut: false,
  };
  let lastError: string | undefined;
  let timedOut = false;
  for (const [index, candidate] of ids.entries()) {
    const executionNow = readNow();
    if (executionNow.getTime() - run.startedAt.getTime() >= SETTLEMENT_WORKER_MAX_DURATION_MS) {
      summary.skippedCount += ids.length - index;
      lastError = "worker_timeout";
      timedOut = true;
      summary.timedOut = true;
      break;
    }
    try {
      const result = await transferExecutor({ settlementLegId: candidate.id, actorUserId: null, mode: "auto", db, stripe, now: executionNow });
      if (candidate.staleRecovery && result.status !== "ineligible" && result.status !== "claim_lost") {
        summary.staleRecoveredCount += 1;
      }
      if (result.status === "transferred") {
        summary.succeededCount += 1;
      } else if (result.status === "ineligible" || result.status === "claim_lost" || result.status === "disabled") {
        if (result.errorCode === "max_attempts" || result.errorCode === "manual_review_required") {
          summary.failedCount += 1;
          summary.manualReviewCount += 1;
          lastError = result.errorCode;
          await recordTransferWorkerFailure({
            db,
            legId: candidate.id,
            workerRunId: run.id,
            now: executionNow,
            errorCode: result.errorCode,
            exhausted: result.errorCode === "max_attempts",
          });
        } else {
          summary.skippedCount += 1;
        }
      } else {
        summary.failedCount += 1;
        lastError = result.errorCode;
        if (result.status === "failed" || result.status === "finalization_failed" || result.status === "persistence_failed") {
          const exhausted = !result.nextTransferAttemptAt;
          if (exhausted) {
            summary.manualReviewCount += 1;
            await recordTransferWorkerFailure({ db, legId: candidate.id, workerRunId: run.id, now: executionNow, errorCode: result.errorCode, exhausted });
          }
        }
      }
      summary.claimedCount += result.status === "claim_lost" || result.status === "ineligible" ? 0 : 1;
    } catch {
      summary.failedCount += 1;
      lastError = "worker_failed";
    }
  }
  const completedAt = readNow();
  await recordWorkerRunFailureAlert({ db, workerRunId: run.id, workerType: SettlementWorkerType.TRANSFER, summary, errorCode: timedOut ? "worker_timeout" : undefined, now: completedAt });
  await finishWorkerRun(db, run, summary, completedAt, lastError);
  return { ...summary, status: resolveSettlementWorkerRunStatus(summary) };
}

export async function runSettlementReversalBatch({ db = getDb(), stripe, reversalExecutor = executeSettlementReversal, now, clock, batchSize }: RunOptions = {}) {
  const readNow = clock ?? createSettlementWorkerClock();
  const startedAt = now ?? readNow();
  const mode = getStripeConnectTransferReversalExecutionMode();
  if (mode !== "auto") return skippedWorkerRun(db, SettlementWorkerType.REVERSAL, mode, startedAt);
  const run = await startWorkerRun(db, SettlementWorkerType.REVERSAL, mode, startedAt);
  const ids = await reversalCandidateIds(db, startedAt, boundedBatchSize(batchSize));
  const summary: WorkerRunSummary = {
    workerRunId: run.id,
    executionMode: mode,
    status: "SUCCEEDED",
    scannedCount: ids.length,
    claimedCount: 0,
    succeededCount: 0,
    failedCount: 0,
    skippedCount: 0,
    manualReviewCount: 0,
    staleRecoveredCount: 0,
    timedOut: false,
  };
  let lastError: string | undefined;
  let timedOut = false;
  for (const [index, candidate] of ids.entries()) {
    const executionNow = readNow();
    if (executionNow.getTime() - run.startedAt.getTime() >= SETTLEMENT_WORKER_MAX_DURATION_MS) {
      summary.skippedCount += ids.length - index;
      lastError = "worker_timeout";
      timedOut = true;
      summary.timedOut = true;
      break;
    }
    try {
      const result = await reversalExecutor({ settlementReversalId: candidate.id, actorUserId: null, mode: "auto", db, stripe, now: executionNow });
      if (result.status === "reversed") summary.succeededCount += 1;
      else if (result.status === "ineligible" || result.status === "claim_lost" || result.status === "disabled") {
        if (result.errorCode === "reversal_max_attempts" || result.errorCode === "manual_review_required") {
          summary.failedCount += 1;
          summary.manualReviewCount += 1;
          lastError = result.errorCode;
          await recordReversalWorkerFailure({
            db,
            reversalId: candidate.id,
            workerRunId: run.id,
            now: executionNow,
            exhausted: result.errorCode === "reversal_max_attempts",
          });
        } else {
          summary.skippedCount += 1;
        }
      }
      else if (result.status === "needs_manual_review") {
        summary.failedCount += 1;
        summary.manualReviewCount += 1;
        lastError = "max_attempts";
        await recordReversalWorkerFailure({ db, reversalId: candidate.id, workerRunId: run.id, now: executionNow, exhausted: true });
      }
      else {
        summary.failedCount += 1;
        lastError = result.errorCode;
        if (result.status === "failed" || result.status === "finalization_failed" || result.status === "persistence_failed") {
          const exhausted = !result.nextReversalAttemptAt;
          if (exhausted) {
            summary.manualReviewCount += 1;
            await recordReversalWorkerFailure({ db, reversalId: candidate.id, workerRunId: run.id, now: executionNow, exhausted });
          }
        }
      }
      summary.claimedCount += result.status === "claim_lost" || result.status === "ineligible" ? 0 : 1;
    } catch {
      summary.failedCount += 1;
      lastError = "worker_failed";
    }
  }
  const completedAt = readNow();
  await recordWorkerRunFailureAlert({ db, workerRunId: run.id, workerType: SettlementWorkerType.REVERSAL, summary, errorCode: timedOut ? "worker_timeout" : undefined, now: completedAt });
  await finishWorkerRun(db, run, summary, completedAt, lastError);
  return { ...summary, status: resolveSettlementWorkerRunStatus(summary) };
}

async function upsertOperationalAlert({
  db,
  alertType,
  severity,
  deduplicationKey,
  title,
  sanitizedMessage,
  settlementId,
  settlementLegId,
  settlementReversalId,
  workerRunId,
  now,
}: {
  db: OperationsDb;
  alertType: SettlementOperationalAlertType;
  severity: SettlementOperationalAlertSeverity;
  deduplicationKey: string;
  title: string;
  sanitizedMessage: string;
  settlementId?: string;
  settlementLegId?: string;
  settlementReversalId?: string;
  workerRunId?: string;
  now: Date;
}) {
  return db.settlementOperationalAlert.upsert({
    where: { deduplicationKey },
    create: {
      alertType,
      severity,
      status: SettlementOperationalAlertStatus.OPEN,
      deduplicationKey,
      title,
      sanitizedMessage,
      firstOccurredAt: now,
      lastOccurredAt: now,
      ...(settlementId ? { settlementId } : {}),
      ...(settlementLegId ? { settlementLegId } : {}),
      ...(settlementReversalId ? { settlementReversalId } : {}),
      ...(workerRunId ? { workerRunId } : {}),
    },
    update: {
      lastOccurredAt: now,
      occurrenceCount: { increment: 1 },
      status: SettlementOperationalAlertStatus.OPEN,
      acknowledgedAt: null,
      acknowledgedByUserId: null,
      resolvedAt: null,
      sanitizedMessage,
      ...(workerRunId ? { workerRunId } : {}),
    },
    select: { id: true, occurrenceCount: true, status: true },
  });
}

async function recordTransferWorkerFailure({
  db,
  legId,
  workerRunId,
  now,
  errorCode,
  exhausted,
}: {
  db: OperationsDb;
  legId: string;
  workerRunId: string;
  now: Date;
  errorCode?: string;
  exhausted: boolean;
}) {
  if (exhausted) {
    await db.settlementLeg.updateMany({ where: { id: legId, status: SettlementLegStatus.READY }, data: { manualReviewRequired: true } });
  }
  const leg = await db.settlementLeg.findUnique({ where: { id: legId }, select: { settlementId: true } });
  if (!leg) return;
  await upsertOperationalAlert({
    db,
    alertType: exhausted ? SettlementOperationalAlertType.TRANSFER_RETRY_EXHAUSTED : SettlementOperationalAlertType.TRANSFER_NEEDS_MANUAL_REVIEW,
    severity: SettlementOperationalAlertSeverity.CRITICAL,
    deduplicationKey: `${exhausted ? "transfer-retry-exhausted" : "transfer-needs-review"}:${legId}`,
    title: exhausted ? "Transfer retry limit reached" : "Transfer requires manual review",
    sanitizedMessage: exhausted
      ? "This transfer reached its automatic retry limit and requires administrator review."
      : `This transfer requires administrator review (${safeWorkerErrorCode(errorCode)}).`,
    settlementId: leg.settlementId,
    settlementLegId: legId,
    workerRunId,
    now,
  });
}

async function recordReversalWorkerFailure({
  db,
  reversalId,
  workerRunId,
  now,
  exhausted,
}: {
  db: OperationsDb;
  reversalId: string;
  workerRunId: string;
  now: Date;
  exhausted: boolean;
}) {
  const reversal = await db.settlementReversal.findUnique({ where: { id: reversalId }, select: { settlementId: true } });
  if (!reversal) return;
  await upsertOperationalAlert({
    db,
    alertType: exhausted ? SettlementOperationalAlertType.REVERSAL_RETRY_EXHAUSTED : SettlementOperationalAlertType.REVERSAL_NEEDS_MANUAL_REVIEW,
    severity: SettlementOperationalAlertSeverity.CRITICAL,
    deduplicationKey: `${exhausted ? "reversal-retry-exhausted" : "reversal-needs-review"}:${reversalId}`,
    title: exhausted ? "Reversal retry limit reached" : "Reversal requires manual review",
    sanitizedMessage: exhausted
      ? "This reversal reached its automatic retry limit and requires administrator review."
      : "This reversal requires administrator review.",
    settlementId: reversal.settlementId,
    settlementReversalId: reversalId,
    workerRunId,
    now,
  });
}

async function recordWorkerRunFailureAlert({
  db,
  workerRunId,
  workerType,
  summary,
  errorCode,
  now,
}: {
  db: OperationsDb;
  workerRunId: string;
  workerType: SettlementWorkerType;
  summary: Pick<WorkerRunSummary, "failedCount" | "succeededCount">;
  errorCode?: string;
  now: Date;
}) {
  if (summary.failedCount === 0 && !errorCode) return;
  const partiallyFailed = summary.succeededCount > 0;
  await upsertOperationalAlert({
    db,
    alertType: partiallyFailed
      ? SettlementOperationalAlertType.WORKER_PARTIALLY_FAILED
      : SettlementOperationalAlertType.WORKER_FAILED,
    severity: SettlementOperationalAlertSeverity.CRITICAL,
    deduplicationKey: `worker-${workerType.toLowerCase()}-${partiallyFailed ? "partial" : "failed"}`,
    title: partiallyFailed ? "Settlement worker partially failed" : "Settlement worker failed",
    sanitizedMessage: errorCode === "worker_timeout"
      ? "A settlement worker exceeded its maximum run duration; unprocessed records were skipped."
      : partiallyFailed
      ? "A settlement worker completed with one or more failed records."
      : "A settlement worker did not complete any record successfully.",
    workerRunId,
    now,
  });
}

export async function runSettlementStaleRecovery({ db = getDb(), now = new Date() }: { db?: OperationsDb; now?: Date } = {}) {
  const run = await startWorkerRun(db, SettlementWorkerType.STALE_RECOVERY, "off", now);
  const staleBefore = new Date(now.getTime() - SETTLEMENT_WORKER_STALE_LOCK_MS);
  const recovered = { transfer: 0, reversal: 0 };

  const stuckRuns = await db.settlementWorkerRun.findMany({
    where: { status: SettlementWorkerRunStatus.RUNNING, startedAt: { lt: new Date(now.getTime() - SETTLEMENT_WORKER_MAX_DURATION_MS) } },
    select: { id: true },
    take: DEFAULT_SETTLEMENT_WORKER_BATCH_SIZE,
  });
  for (const stuckRun of stuckRuns) {
    const changed = await db.settlementWorkerRun.updateMany({
      where: { id: stuckRun.id, status: SettlementWorkerRunStatus.RUNNING },
      data: { status: SettlementWorkerRunStatus.FAILED, completedAt: now, sanitizedErrorCode: "worker_timeout" },
    });
    if (changed.count === 1) {
      await upsertOperationalAlert({
        db,
        alertType: SettlementOperationalAlertType.WORKER_FAILED,
        severity: SettlementOperationalAlertSeverity.CRITICAL,
        deduplicationKey: `worker-failed:${stuckRun.id}`,
        title: "Settlement worker timed out",
        sanitizedMessage: "A settlement worker exceeded its maximum run duration.",
        workerRunId: stuckRun.id,
        now,
      });
    }
  }
  const staleTransfers = await db.settlementLeg.findMany({
    where: {
      status: SettlementLegStatus.TRANSFER_PENDING,
      settlement: { paymentFlow: SettlementPaymentFlow.SCT },
      transferLockedAt: { lt: staleBefore },
      type: { in: [SettlementLegType.SELLER_PAYABLE, SettlementLegType.PARTNER_REFERRAL] },
    },
    select: { id: true, settlementId: true },
    take: DEFAULT_SETTLEMENT_WORKER_BATCH_SIZE,
  });
  for (const leg of staleTransfers) {
    const changed = await db.$transaction(async (tx) => {
      const result = await tx.settlementLeg.updateMany({
        where: { id: leg.id, status: SettlementLegStatus.TRANSFER_PENDING, transferLockedAt: { lt: staleBefore } },
        data: { transferLockedAt: null, nextTransferAttemptAt: null },
      });
      if (result.count !== 1) return false;
      await tx.settlementEvent.create({
        data: {
          settlementId: leg.settlementId,
          settlementLegId: leg.id,
          eventType: SettlementEventType.TRANSFER_PENDING,
          message: "A stale transfer claim was cleared for controlled recovery.",
          metadata: { workerType: "STALE_RECOVERY", workerRunId: run.id },
          idempotencyKey: `settlement:leg:${leg.id}:stale-recovery:${now.toISOString()}`,
        },
      });
      return true;
    });
    if (changed) {
      recovered.transfer += 1;
      await upsertOperationalAlert({
        db,
        alertType: SettlementOperationalAlertType.STALE_TRANSFER_CLAIM,
        severity: SettlementOperationalAlertSeverity.WARNING,
        deduplicationKey: `stale-transfer:${leg.id}`,
        title: "Stale transfer claim recovered",
        sanitizedMessage: "A stale transfer claim was cleared for administrator-controlled recovery.",
        settlementId: leg.settlementId,
        settlementLegId: leg.id,
        workerRunId: run.id,
        now,
      });
    }
  }
  const staleReversals = await db.settlementReversal.findMany({
    where: { status: SettlementReversalStatus.PENDING, reversalLockedAt: { lt: staleBefore }, settlement: { paymentFlow: SettlementPaymentFlow.SCT } },
    select: { id: true, settlementId: true, settlementLegId: true },
    take: DEFAULT_SETTLEMENT_WORKER_BATCH_SIZE,
  });
  for (const reversal of staleReversals) {
    const changed = await db.$transaction(async (tx) => {
      const result = await tx.settlementReversal.updateMany({
        where: { id: reversal.id, status: SettlementReversalStatus.PENDING, reversalLockedAt: { lt: staleBefore } },
        data: { reversalLockedAt: null },
      });
      if (result.count !== 1) return false;
      await tx.settlementEvent.create({
        data: {
          settlementId: reversal.settlementId,
          settlementLegId: reversal.settlementLegId,
          eventType: SettlementEventType.REVERSAL_CREATED,
          message: "A stale reversal claim was cleared for controlled recovery.",
          metadata: { workerType: "STALE_RECOVERY", workerRunId: run.id },
          idempotencyKey: `settlement:reversal:${reversal.id}:stale-recovery:${now.toISOString()}`,
        },
      });
      return true;
    });
    if (changed) {
      recovered.reversal += 1;
      await upsertOperationalAlert({
        db,
        alertType: SettlementOperationalAlertType.STALE_REVERSAL_CLAIM,
        severity: SettlementOperationalAlertSeverity.WARNING,
        deduplicationKey: `stale-reversal:${reversal.id}`,
        title: "Stale reversal claim recovered",
        sanitizedMessage: "A stale reversal claim was cleared for administrator-controlled recovery.",
        settlementId: reversal.settlementId,
        settlementReversalId: reversal.id,
        workerRunId: run.id,
        now,
      });
    }
  }

  const exhaustedTransfers = await db.settlementLeg.findMany({
    where: {
      status: SettlementLegStatus.READY,
      manualReviewRequired: false,
      transferAttemptCount: { gte: 5 },
      type: { in: [SettlementLegType.SELLER_PAYABLE, SettlementLegType.PARTNER_REFERRAL] },
      settlement: { paymentFlow: SettlementPaymentFlow.SCT },
    },
    select: { id: true, settlementId: true },
    take: DEFAULT_SETTLEMENT_WORKER_BATCH_SIZE,
  });
  for (const leg of exhaustedTransfers) {
    const changed = await db.settlementLeg.updateMany({ where: { id: leg.id, status: SettlementLegStatus.READY, manualReviewRequired: false }, data: { manualReviewRequired: true } });
    if (changed.count === 1) {
      await db.settlementEvent.create({
        data: {
          settlementId: leg.settlementId,
          settlementLegId: leg.id,
          eventType: SettlementEventType.ADMIN_REEVALUATED,
          message: "A settlement transfer reached its retry limit and was marked for manual review.",
          metadata: { workerType: "STALE_RECOVERY", reason: "max_attempts" },
          idempotencyKey: `settlement:leg:${leg.id}:manual-review:max-attempts`,
        },
      });
      await upsertOperationalAlert({
        db,
        alertType: SettlementOperationalAlertType.TRANSFER_RETRY_EXHAUSTED,
        severity: SettlementOperationalAlertSeverity.CRITICAL,
        deduplicationKey: `transfer-retry-exhausted:${leg.id}`,
        title: "Transfer retry limit reached",
        sanitizedMessage: "This transfer requires administrator review after reaching the retry limit.",
        settlementId: leg.settlementId,
        settlementLegId: leg.id,
        workerRunId: run.id,
        now,
      });
    }
  }

  const exhaustedReversals = await db.settlementReversal.findMany({
    where: {
      status: { in: [SettlementReversalStatus.PENDING, SettlementReversalStatus.FAILED] },
      reversalAttemptCount: { gte: 5 },
      settlement: { paymentFlow: SettlementPaymentFlow.SCT },
    },
    select: { id: true, settlementId: true, settlementLegId: true },
    take: DEFAULT_SETTLEMENT_WORKER_BATCH_SIZE,
  });
  for (const reversal of exhaustedReversals) {
    const changed = await db.settlementReversal.updateMany({
      where: { id: reversal.id, status: { in: [SettlementReversalStatus.PENDING, SettlementReversalStatus.FAILED] }, reversalAttemptCount: { gte: 5 } },
      data: { status: SettlementReversalStatus.NEEDS_MANUAL_REVIEW, nextReversalAttemptAt: null, reversalLockedAt: null },
    });
    if (changed.count === 1) {
      await db.settlementEvent.create({
        data: {
          settlementId: reversal.settlementId,
          settlementLegId: reversal.settlementLegId,
          eventType: SettlementEventType.POST_TRANSFER_REVERSAL_REQUIRED,
          message: "A settlement reversal reached its retry limit and requires manual review.",
          metadata: { workerType: "STALE_RECOVERY", reason: "max_attempts" },
          idempotencyKey: `settlement:reversal:${reversal.id}:manual-review:max-attempts`,
        },
      });
      await upsertOperationalAlert({
        db,
        alertType: SettlementOperationalAlertType.REVERSAL_RETRY_EXHAUSTED,
        severity: SettlementOperationalAlertSeverity.CRITICAL,
        deduplicationKey: `reversal-retry-exhausted:${reversal.id}`,
        title: "Reversal retry limit reached",
        sanitizedMessage: "This reversal requires administrator review after reaching the retry limit.",
        settlementId: reversal.settlementId,
        settlementReversalId: reversal.id,
        workerRunId: run.id,
        now,
      });
    }
  }

  const disputedReadyLegs = await db.settlementLeg.findMany({
    where: {
      status: SettlementLegStatus.READY,
      type: { in: [SettlementLegType.SELLER_PAYABLE, SettlementLegType.PARTNER_REFERRAL] },
      settlement: { paymentFlow: SettlementPaymentFlow.SCT, paymentRequest: { status: "DISPUTED" } },
    },
    select: { id: true, settlementId: true },
    take: DEFAULT_SETTLEMENT_WORKER_BATCH_SIZE,
  });
  for (const leg of disputedReadyLegs) {
    await upsertOperationalAlert({
      db,
      alertType: SettlementOperationalAlertType.DISPUTE_OPEN_WITH_READY_TRANSFER,
      severity: SettlementOperationalAlertSeverity.CRITICAL,
      deduplicationKey: `dispute-ready-transfer:${leg.id}`,
      title: "Dispute found with ready transfer",
      sanitizedMessage: "A disputed SCT payment still has a READY transfer leg.",
      settlementId: leg.settlementId,
      settlementLegId: leg.id,
      workerRunId: run.id,
      now,
    });
  }
  const longPendingBefore = new Date(now.getTime() - SETTLEMENT_LONG_PENDING_AGE_MS);
  const longPendingTransfers = await db.settlementLeg.findMany({
    where: {
      status: SettlementLegStatus.READY,
      holdUntil: { lt: longPendingBefore },
      type: { in: [SettlementLegType.SELLER_PAYABLE, SettlementLegType.PARTNER_REFERRAL] },
      settlement: { paymentFlow: SettlementPaymentFlow.SCT },
    },
    select: { id: true, settlementId: true },
    take: DEFAULT_SETTLEMENT_WORKER_BATCH_SIZE,
  });
  for (const leg of longPendingTransfers) {
    await upsertOperationalAlert({
      db,
      alertType: SettlementOperationalAlertType.LONG_PENDING_TRANSFER,
      severity: SettlementOperationalAlertSeverity.WARNING,
      deduplicationKey: `long-pending-transfer:${leg.id}`,
      title: "Transfer has been pending too long",
      sanitizedMessage: "A legacy SCT transfer leg has remained unprocessed beyond the operational age threshold.",
      settlementId: leg.settlementId,
      settlementLegId: leg.id,
      workerRunId: run.id,
      now,
    });
  }
  const longPendingReversals = await db.settlementReversal.findMany({
    where: {
      status: SettlementReversalStatus.PENDING,
      createdAt: { lt: longPendingBefore },
      settlement: { paymentFlow: SettlementPaymentFlow.SCT },
    },
    select: { id: true, settlementId: true },
    take: DEFAULT_SETTLEMENT_WORKER_BATCH_SIZE,
  });
  for (const reversal of longPendingReversals) {
    await upsertOperationalAlert({
      db,
      alertType: SettlementOperationalAlertType.LONG_PENDING_REVERSAL,
      severity: SettlementOperationalAlertSeverity.WARNING,
      deduplicationKey: `long-pending-reversal:${reversal.id}`,
      title: "Reversal has been pending too long",
      sanitizedMessage: "A legacy SCT reversal has remained pending beyond the operational age threshold.",
      settlementId: reversal.settlementId,
      settlementReversalId: reversal.id,
      workerRunId: run.id,
      now,
    });
  }
  const refundedTransferredLegs = await db.settlementLeg.findMany({
    where: {
      status: SettlementLegStatus.TRANSFERRED,
      type: { in: [SettlementLegType.SELLER_PAYABLE, SettlementLegType.PARTNER_REFERRAL] },
      settlement: {
        paymentFlow: SettlementPaymentFlow.SCT,
        paymentRequest: {
          status: { in: [PaymentRequestStatus.PARTIALLY_REFUNDED, PaymentRequestStatus.REFUNDED] },
          refundAmount: { gt: 0 },
        },
      },
    },
    select: {
      id: true,
      settlementId: true,
      settlement: { select: { paymentRequest: { select: { refundAmount: true } } } },
      reversals: { select: { successfullyReversedAmount: true } },
    },
    take: DEFAULT_SETTLEMENT_WORKER_BATCH_SIZE,
  });
  for (const leg of refundedTransferredLegs) {
    const reversedAmount = leg.reversals.reduce((sum, reversal) => sum + reversal.successfullyReversedAmount, 0);
    if (reversedAmount >= leg.settlement.paymentRequest.refundAmount) continue;
    await upsertOperationalAlert({
      db,
      alertType: SettlementOperationalAlertType.REFUND_WITH_UNREVERSED_TRANSFER,
      severity: SettlementOperationalAlertSeverity.CRITICAL,
      deduplicationKey: `refund-unreversed-transfer:${leg.id}`,
      title: "Refund has an unreversed transfer",
      sanitizedMessage: "A refunded SCT payment has a transferred leg without a matching completed reversal amount.",
      settlementId: leg.settlementId,
      settlementLegId: leg.id,
      workerRunId: run.id,
      now,
    });
  }
  const summary: WorkerRunSummary = {
    workerRunId: run.id,
    executionMode: "off",
    status: "SUCCEEDED",
    scannedCount: staleTransfers.length + staleReversals.length + exhaustedTransfers.length + exhaustedReversals.length + disputedReadyLegs.length + longPendingTransfers.length + longPendingReversals.length + refundedTransferredLegs.length + stuckRuns.length,
    claimedCount: 0,
    succeededCount: 0,
    failedCount: 0,
    skippedCount: (staleTransfers.length - recovered.transfer) + (staleReversals.length - recovered.reversal),
    manualReviewCount: exhaustedTransfers.length + exhaustedReversals.length,
    staleRecoveredCount: recovered.transfer + recovered.reversal,
  };
  await finishWorkerRun(db, run, summary, new Date());
  return { ...summary, recovered };
}

export async function inspectSettlementOperations({ db = getDb(), now = new Date(), filters = {} }: {
  db?: OperationsDb;
  now?: Date;
  filters?: { paymentFlow?: SettlementPaymentFlow; legType?: SettlementLegType; status?: SettlementLegStatus; currency?: string; retryDue?: boolean; stale?: boolean; manualReview?: boolean; seller?: string; partner?: string; disputeStatus?: string; refundStatus?: "none" | "partial" | "full"; from?: Date; to?: Date };
} = {}) {
  const paymentRequestFilter = {
    ...(filters.disputeStatus === "none"
      ? { disputes: { none: {} } }
      : filters.disputeStatus
        ? { disputes: { some: { status: filters.disputeStatus } } }
        : {}),
    ...(filters.refundStatus === "none"
      ? { refundAmount: 0 }
      : filters.refundStatus === "partial"
        ? { status: PaymentRequestStatus.PARTIALLY_REFUNDED }
        : filters.refundStatus === "full"
          ? { status: PaymentRequestStatus.REFUNDED }
          : {}),
  };
  const settlementFilter = {
    ...(filters.paymentFlow ? { paymentFlow: filters.paymentFlow } : {}),
    ...(Object.keys(paymentRequestFilter).length > 0 ? { paymentRequest: paymentRequestFilter } : {}),
  };
  const legs = await db.settlementLeg.findMany({
    where: {
      ...(Object.keys(settlementFilter).length > 0 ? { settlement: settlementFilter } : {}),
      ...(filters.legType ? { type: filters.legType } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.currency ? { currency: filters.currency.toLowerCase() } : {}),
      ...(filters.seller ? { recipientCompany: { OR: [{ legalName: { contains: filters.seller, mode: "insensitive" } }, { tradeName: { contains: filters.seller, mode: "insensitive" } }] } } : {}),
      ...(filters.partner ? { partnerProfile: { OR: [{ referralCode: { contains: filters.partner, mode: "insensitive" } }, { displayName: { contains: filters.partner, mode: "insensitive" } }] } } : {}),
      ...(filters.from || filters.to ? { createdAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } } : {}),
    },
    select: {
      id: true,
      type: true,
      status: true,
      amount: true,
      currency: true,
      stripeTransferId: true,
      transferredAt: true,
      holdUntil: true,
      transferLockedAt: true,
      nextTransferAttemptAt: true,
      manualReviewRequired: true,
      settlement: {
        select: {
          paymentFlow: true,
          status: true,
          approvedAt: true,
      paymentRequest: { select: { status: true, requiresManualReconciliation: true, refundAmount: true, currency: true, disputes: { select: { id: true } } } },
          tradeOrder: { select: { paymentStatus: true, orderStatus: true } },
        },
      },
    },
    take: 500,
  });
  const filtered = legs.filter((leg) => {
    const retryDue = Boolean(leg.nextTransferAttemptAt && leg.nextTransferAttemptAt <= now);
    const stale = Boolean(leg.transferLockedAt && now.getTime() - leg.transferLockedAt.getTime() >= SETTLEMENT_WORKER_STALE_LOCK_MS);
    if (filters.retryDue !== undefined && retryDue !== filters.retryDue) return false;
    if (filters.stale !== undefined && stale !== filters.stale) return false;
    if (filters.manualReview !== undefined && leg.manualReviewRequired !== filters.manualReview) return false;
    return true;
  });
  const reversals = await db.settlementReversal.findMany({
    where: {
      ...(Object.keys(settlementFilter).length > 0 ? { settlement: settlementFilter } : {}),
      ...(filters.currency ? { currency: filters.currency.toLowerCase() } : {}),
      ...(filters.from || filters.to ? { createdAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } } : {}),
    },
    select: {
      id: true,
      amount: true,
      successfullyReversedAmount: true,
      currency: true,
      status: true,
      reversalAttemptCount: true,
      reversalLockedAt: true,
      nextReversalAttemptAt: true,
      createdAt: true,
      settlement: {
        select: {
          paymentFlow: true,
      paymentRequest: { select: { status: true, requiresManualReconciliation: true, currency: true } },
        },
      },
      sourceType: true,
      settlementLeg: { select: { type: true, status: true, currency: true } },
    },
    take: 500,
  });
  const transferCandidates = filtered.filter((leg) => {
    const payment = leg.settlement.paymentRequest;
    const order = leg.settlement.tradeOrder;
    const staleTransferRecovery = leg.settlement.status === SettlementStatus.TRANSFER_PENDING
      && leg.status === SettlementLegStatus.TRANSFER_PENDING
      && (!leg.transferLockedAt || now.getTime() - leg.transferLockedAt.getTime() >= SETTLEMENT_WORKER_STALE_LOCK_MS);
    const readyTransfer = leg.settlement.status === SettlementStatus.READY
      && leg.status === SettlementLegStatus.READY
      && (!leg.transferLockedAt || now.getTime() - leg.transferLockedAt.getTime() >= SETTLEMENT_WORKER_STALE_LOCK_MS);
    return leg.settlement.paymentFlow === SettlementPaymentFlow.SCT
      && leg.settlement.approvedAt !== null
      && (readyTransfer || staleTransferRecovery)
      && TRANSFERABLE_LEG_TYPES.has(leg.type)
      && leg.amount > 0
      && leg.holdUntil <= now
      && leg.stripeTransferId === null
      && leg.transferredAt === null
      && leg.currency === "usd"
      && !leg.manualReviewRequired
      && payment.status === PaymentRequestStatus.PAID
      && !payment.requiresManualReconciliation
      && payment.currency === "usd"
      && payment.refundAmount === 0
      && payment.disputes.length === 0
      && order.paymentStatus === OrderPaymentStatus.PAID
      && !BLOCKED_ORDER_STATUSES.has(order.orderStatus)
      && (!leg.nextTransferAttemptAt || leg.nextTransferAttemptAt <= now);
  });
  const reversalCandidates = reversals.filter((reversal) => {
    const retryDue = !reversal.nextReversalAttemptAt || reversal.nextReversalAttemptAt <= now;
    const stale = Boolean(reversal.reversalLockedAt && now.getTime() - reversal.reversalLockedAt.getTime() >= SETTLEMENT_WORKER_STALE_LOCK_MS);
    if (reversal.settlement.paymentFlow !== SettlementPaymentFlow.SCT) return false;
    if (
      reversal.settlement.paymentRequest.status === PaymentRequestStatus.DISPUTED
      && reversal.sourceType !== "DISPUTE_LOST"
    ) return false;
    if (reversal.settlement.paymentRequest.requiresManualReconciliation) return false;
    if (reversal.settlement.paymentRequest.currency !== "usd" || reversal.settlementLeg.currency !== "usd") return false;
    if (!TRANSFERABLE_LEG_TYPES.has(reversal.settlementLeg.type)) return false;
    if (!TRANSFERABLE_LEG_STATUSES.has(reversal.settlementLeg.status)) return false;
    if (reversal.amount <= reversal.successfullyReversedAmount) return false;
    if (reversal.status !== SettlementReversalStatus.PENDING) return false;
    if (filters.retryDue !== undefined && retryDue !== filters.retryDue) return false;
    if (filters.stale !== undefined && stale !== filters.stale) return false;
    return true;
  });
  const byCurrency = new Map<string, number>();
  for (const leg of transferCandidates) byCurrency.set(leg.currency, (byCurrency.get(leg.currency) ?? 0) + leg.amount);
  for (const reversal of reversalCandidates) {
    const remaining = Math.max(0, reversal.amount - reversal.successfullyReversedAmount);
    byCurrency.set(reversal.currency, (byCurrency.get(reversal.currency) ?? 0) + remaining);
  }
  const candidateTimes = [
    ...transferCandidates.map((leg) => leg.holdUntil.getTime()),
    ...reversalCandidates.map((reversal) => reversal.createdAt.getTime()),
  ];
  const retryDueCount = filtered.filter((leg) => leg.nextTransferAttemptAt && leg.nextTransferAttemptAt <= now).length
    + reversals.filter((reversal) => reversal.nextReversalAttemptAt && reversal.nextReversalAttemptAt <= now).length;
  const staleLockCount = filtered.filter((leg) => leg.transferLockedAt && now.getTime() - leg.transferLockedAt.getTime() >= SETTLEMENT_WORKER_STALE_LOCK_MS).length
    + reversals.filter((reversal) => reversal.reversalLockedAt && now.getTime() - reversal.reversalLockedAt.getTime() >= SETTLEMENT_WORKER_STALE_LOCK_MS).length;
  return {
    transferCandidates,
    reversalCandidates,
    excludedRows: [
      ...filtered
        .filter((leg) => !transferCandidates.includes(leg))
        .map((leg) => ({
          id: leg.id,
          kind: "transfer",
          amount: leg.amount,
          currency: leg.currency,
          reason: leg.settlement.paymentFlow === SettlementPaymentFlow.DIRECT_CHARGE
            ? "direct_charge_not_supported"
            : leg.manualReviewRequired
              ? "manual_review"
              : leg.settlement.status !== SettlementStatus.READY || !leg.settlement.approvedAt
                ? "settlement_not_approved"
                : leg.type === SettlementLegType.PLATFORM_FEE
                  ? "platform_fee"
                  : leg.settlement.paymentRequest.status !== PaymentRequestStatus.PAID
                    ? "payment_not_paid"
                    : leg.settlement.paymentRequest.requiresManualReconciliation
                      ? "manual_reconciliation"
                      : leg.settlement.paymentRequest.refundAmount > 0 || leg.settlement.paymentRequest.disputes.length > 0
                        ? "refund_or_dispute"
                        : leg.settlement.tradeOrder.paymentStatus !== OrderPaymentStatus.PAID
                          ? "order_not_paid"
                          : leg.status.toLowerCase(),
        })),
      ...reversals
        .filter((reversal) => !reversalCandidates.includes(reversal))
        .map((reversal) => ({
          id: reversal.id,
          kind: "reversal",
          amount: reversal.amount,
          currency: reversal.currency,
          reason: reversal.settlement.paymentFlow === SettlementPaymentFlow.DIRECT_CHARGE
            ? "direct_charge_not_supported"
            : reversal.settlement.paymentRequest.status === PaymentRequestStatus.DISPUTED
              && reversal.sourceType !== "DISPUTE_LOST"
              ? "disputed"
              : reversal.settlement.paymentRequest.requiresManualReconciliation
                ? "manual_reconciliation"
                : reversal.settlementLeg.type === SettlementLegType.PLATFORM_FEE
                  ? "platform_fee"
                  : reversal.status.toLowerCase(),
        })),
    ],
    totalCandidateAmountByCurrency: Object.fromEntries(byCurrency),
    oldestCandidateAgeMs: candidateTimes.length ? Math.max(0, now.getTime() - Math.min(...candidateTimes)) : 0,
    retryDueCount,
    staleLockCount,
    manualReviewCount: filtered.filter((leg) => leg.manualReviewRequired).length + reversals.filter((reversal) => reversal.status === SettlementReversalStatus.NEEDS_MANUAL_REVIEW).length,
  };
}

export async function getSettlementOperationsMetrics({ db = getDb(), now = new Date() }: { db?: OperationsDb; now?: Date } = {}) {
  const staleBefore = new Date(now.getTime() - SETTLEMENT_WORKER_STALE_LOCK_MS);
  const [legMetrics, reversalMetrics, ageMetrics, heldSettlementMetrics, runs] = await Promise.all([
    db.$queryRaw<Array<{
      type: string;
      status: string;
      currency: string;
      count: number;
      amount_sum: number;
      manual_review: boolean;
      attempt_exhausted: boolean;
      retry_due: boolean;
      stale: boolean;
      attempted: boolean;
    }>>(Prisma.sql`
      SELECT leg."type"::text AS type,
        leg."status"::text AS status,
        leg."currency" AS currency,
        COUNT(*)::int AS count,
        COALESCE(SUM(leg."amount"), 0)::int AS amount_sum,
        leg."manualReviewRequired" AS manual_review,
        (leg."transferAttemptCount" >= 5) AS attempt_exhausted,
        (leg."nextTransferAttemptAt" IS NOT NULL AND leg."nextTransferAttemptAt" <= ${now}) AS retry_due,
        (leg."transferLockedAt" IS NOT NULL AND leg."transferLockedAt" < ${staleBefore}) AS stale,
        (leg."transferAttemptCount" > 0) AS attempted
      FROM "SettlementLeg" AS leg
      JOIN "Settlement" AS settlement ON settlement."id" = leg."settlementId"
      WHERE settlement."paymentFlow" = ${SettlementPaymentFlow.SCT}::"SettlementPaymentFlow"
        AND leg."type" IN ('SELLER_PAYABLE'::"SettlementLegType", 'PARTNER_REFERRAL'::"SettlementLegType")
      GROUP BY leg."type", leg."status", leg."currency", leg."manualReviewRequired",
        (leg."transferAttemptCount" >= 5),
        (leg."nextTransferAttemptAt" IS NOT NULL AND leg."nextTransferAttemptAt" <= ${now}),
        (leg."transferLockedAt" IS NOT NULL AND leg."transferLockedAt" < ${staleBefore}),
        (leg."transferAttemptCount" > 0)
    `),
    db.$queryRaw<Array<{
      type: string;
      status: string;
      currency: string;
      count: number;
      amount_sum: number;
      reversed_sum: number;
      retry_due: boolean;
      stale: boolean;
      attempt_exhausted: boolean;
      attempted: boolean;
    }>>(Prisma.sql`
      SELECT leg."type"::text AS type,
        reversal."status"::text AS status,
        reversal."currency" AS currency,
        COUNT(*)::int AS count,
        COALESCE(SUM(reversal."amount"), 0)::int AS amount_sum,
        COALESCE(SUM(reversal."successfullyReversedAmount"), 0)::int AS reversed_sum,
        (reversal."nextReversalAttemptAt" IS NULL OR reversal."nextReversalAttemptAt" <= ${now}) AS retry_due,
        (reversal."reversalLockedAt" IS NOT NULL AND reversal."reversalLockedAt" < ${staleBefore}) AS stale,
        (reversal."reversalAttemptCount" >= 5) AS attempt_exhausted,
        (reversal."reversalAttemptCount" > 0) AS attempted
      FROM "SettlementReversal" AS reversal
      JOIN "Settlement" AS settlement ON settlement."id" = reversal."settlementId"
      JOIN "SettlementLeg" AS leg ON leg."id" = reversal."settlementLegId"
        AND leg."settlementId" = reversal."settlementId"
      WHERE settlement."paymentFlow" = ${SettlementPaymentFlow.SCT}::"SettlementPaymentFlow"
        AND leg."type" IN ('SELLER_PAYABLE'::"SettlementLegType", 'PARTNER_REFERRAL'::"SettlementLegType")
      GROUP BY leg."type", reversal."status", reversal."currency",
        (reversal."nextReversalAttemptAt" IS NULL OR reversal."nextReversalAttemptAt" <= ${now}),
        (reversal."reversalLockedAt" IS NOT NULL AND reversal."reversalLockedAt" < ${staleBefore}),
        (reversal."reversalAttemptCount" >= 5),
        (reversal."reversalAttemptCount" > 0)
    `),
    db.$queryRaw<Array<{ average_attempts: number; p50_age_ms: number; p95_age_ms: number; oldest_age_ms: number }>>(Prisma.sql`
      SELECT
        COALESCE(AVG(leg."transferAttemptCount") FILTER (WHERE leg."transferAttemptCount" > 0), 0)::float8 AS average_attempts,
        COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY GREATEST(0::numeric, EXTRACT(EPOCH FROM (${now}::timestamp - leg."createdAt")) * 1000)) FILTER (WHERE leg."status" <> 'TRANSFERRED'::"SettlementLegStatus"), 0)::float8 AS p50_age_ms,
        COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY GREATEST(0::numeric, EXTRACT(EPOCH FROM (${now}::timestamp - leg."createdAt")) * 1000)) FILTER (WHERE leg."status" <> 'TRANSFERRED'::"SettlementLegStatus"), 0)::float8 AS p95_age_ms,
        COALESCE(MAX(GREATEST(0::numeric, EXTRACT(EPOCH FROM (${now}::timestamp - leg."createdAt")) * 1000)) FILTER (WHERE leg."status" <> 'TRANSFERRED'::"SettlementLegStatus"), 0)::float8 AS oldest_age_ms
      FROM "SettlementLeg" AS leg
      JOIN "Settlement" AS settlement ON settlement."id" = leg."settlementId"
      WHERE settlement."paymentFlow" = ${SettlementPaymentFlow.SCT}::"SettlementPaymentFlow"
        AND leg."type" IN ('SELLER_PAYABLE'::"SettlementLegType", 'PARTNER_REFERRAL'::"SettlementLegType")
    `),
    db.$queryRaw<Array<{ held_settlement_count: number }>>(Prisma.sql`
      SELECT COUNT(DISTINCT settlement."id")::int AS held_settlement_count
      FROM "SettlementLeg" AS leg
      JOIN "Settlement" AS settlement ON settlement."id" = leg."settlementId"
      WHERE settlement."paymentFlow" = ${SettlementPaymentFlow.SCT}::"SettlementPaymentFlow"
        AND leg."type" IN ('SELLER_PAYABLE'::"SettlementLegType", 'PARTNER_REFERRAL'::"SettlementLegType")
        AND leg."status" = 'HOLD'::"SettlementLegStatus"
    `),
    db.settlementWorkerRun.findMany({ orderBy: { startedAt: "desc" }, take: 10, select: { id: true, status: true, workerType: true, startedAt: true, completedAt: true } }),
  ]);

  const asNumber = (value: number | string | null | undefined) => Number(value ?? 0);
  const amountBy = (rows: Array<{ currency: string; amount_sum: number }>) => rows.reduce<Record<string, number>>((result, row) => {
    result[row.currency] = (result[row.currency] ?? 0) + asNumber(row.amount_sum);
    return result;
  }, {});
  const legRows = legMetrics.map((row) => ({ ...row, count: asNumber(row.count), amount_sum: asNumber(row.amount_sum) }));
  const reversalRows = reversalMetrics.map((row) => ({ ...row, count: asNumber(row.count), amount_sum: asNumber(row.amount_sum), reversed_sum: asNumber(row.reversed_sum) }));
  const rowsFor = (status: string, rows = legRows) => rows.filter((row) => row.status === status);
  const ready = rowsFor("READY");
  const held = rowsFor("HOLD");
  const transferred = rowsFor("TRANSFERRED");
  const attemptedTransfers = legRows.filter((row) => row.attempted);
  const failedTransfers = legRows.filter((row) => row.status !== "TRANSFERRED" && (row.manual_review || row.attempt_exhausted));
  const pendingReversals = reversalRows.filter((row) => row.status === "PENDING");
  const attemptedReversals = reversalRows.filter((row) => row.attempted);
  const completedReversals = reversalRows.filter((row) => row.status === "COMPLETED");
  const amountByReversalRemaining = (rows: typeof reversalRows) => rows.reduce<Record<string, number>>((result, row) => {
    result[row.currency] = (result[row.currency] ?? 0) + Math.max(0, row.amount_sum - row.reversed_sum);
    return result;
  }, {});
  const workerSuccessCount = runs.filter((run) => run.status === SettlementWorkerRunStatus.SUCCEEDED).length;
  const workerFailureCount = runs.filter((run) => run.status === SettlementWorkerRunStatus.FAILED || run.status === SettlementWorkerRunStatus.PARTIALLY_FAILED).length;
  const age = ageMetrics[0] ?? { average_attempts: 0, p50_age_ms: 0, p95_age_ms: 0, oldest_age_ms: 0 };
  const heldCount = asNumber(heldSettlementMetrics[0]?.held_settlement_count);
  const manualReviewCount = legRows.filter((row) => row.manual_review).reduce((sum, row) => sum + row.count, 0)
    + reversalRows.filter((row) => row.status === "NEEDS_MANUAL_REVIEW").reduce((sum, row) => sum + row.count, 0);
  return {
    flow: { SCT: { readyTransferCount: ready.reduce((sum, row) => sum + row.count, 0), readyTransferAmount: amountBy(ready), heldCount: held.reduce((sum, row) => sum + row.count, 0), heldAmount: amountBy(held), transferredCount: transferred.reduce((sum, row) => sum + row.count, 0), transferredAmount: amountBy(transferred), sellerPayableAmount: amountBy(legRows.filter((row) => row.type === SettlementLegType.SELLER_PAYABLE)), partnerReferralAmount: amountBy(legRows.filter((row) => row.type === SettlementLegType.PARTNER_REFERRAL)) }, DIRECT_CHARGE: { available: false } },
    readyTransferCount: ready.reduce((sum, row) => sum + row.count, 0),
    readyTransferAmount: amountBy(ready),
    heldSettlementCount: heldCount,
    heldAmount: amountBy(held),
    transferredAmount: amountBy(transferred),
    reversedAmount: amountBy(reversalRows.map((row) => ({ currency: row.currency, amount_sum: row.reversed_sum }))),
    pendingReversalCount: pendingReversals.reduce((sum, row) => sum + row.count, 0),
    pendingReversalAmount: amountByReversalRemaining(pendingReversals),
    retryDueTransferCount: legRows.filter((row) => row.status !== "TRANSFERRED" && row.retry_due).reduce((sum, row) => sum + row.count, 0),
    retryDueReversalCount: pendingReversals.filter((row) => row.retry_due).reduce((sum, row) => sum + row.count, 0),
    staleExecutionCount: legRows.filter((row) => row.stale).reduce((sum, row) => sum + row.count, 0) + reversalRows.filter((row) => row.stale).reduce((sum, row) => sum + row.count, 0),
    successfulTransferCount: transferred.reduce((sum, row) => sum + row.count, 0),
    failedTransferCount: failedTransfers.reduce((sum, row) => sum + row.count, 0),
    successfulReversalCount: completedReversals.reduce((sum, row) => sum + row.count, 0),
    transferSuccessRate: attemptedTransfers.reduce((sum, row) => sum + row.count, 0) ? Math.min(1, transferred.reduce((sum, row) => sum + row.count, 0) / attemptedTransfers.reduce((sum, row) => sum + row.count, 0)) : 0,
    reversalSuccessRate: attemptedReversals.reduce((sum, row) => sum + row.count, 0) ? Math.min(1, completedReversals.reduce((sum, row) => sum + row.count, 0) / attemptedReversals.reduce((sum, row) => sum + row.count, 0)) : 0,
    averageTransferAttempts: asNumber(age.average_attempts),
    p50ProcessingAgeMs: asNumber(age.p50_age_ms),
    p95ProcessingAgeMs: asNumber(age.p95_age_ms),
    workerSuccessCount,
    workerFailureCount,
    workerMetricsWindow: "latest_10_runs",
    oldestUnprocessedAgeMs: asNumber(age.oldest_age_ms),
    retryExhaustedTransferCount: failedTransfers.filter((row) => row.attempt_exhausted).reduce((sum, row) => sum + row.count, 0),
    retryExhaustedReversalCount: reversalRows.filter((row) => row.attempt_exhausted && row.status !== "COMPLETED").reduce((sum, row) => sum + row.count, 0),
    sellerPayableAmount: amountBy(legRows.filter((row) => row.type === SettlementLegType.SELLER_PAYABLE)),
    partnerReferralAmount: amountBy(legRows.filter((row) => row.type === SettlementLegType.PARTNER_REFERRAL)),
    manualReviewCount,
    latestSuccessfulWorkerRun: runs.find((run) => run.status === SettlementWorkerRunStatus.SUCCEEDED) ?? null,
    latestFailedWorkerRun: runs.find((run) => run.status === SettlementWorkerRunStatus.FAILED || run.status === SettlementWorkerRunStatus.PARTIALLY_FAILED) ?? null,
  };
}

export async function acknowledgeSettlementAlert({ db = getDb(), alertId, actorUserId, resolve = false, now = new Date() }: { db?: OperationsDb; alertId: string; actorUserId: string; resolve?: boolean; now?: Date }) {
  return db.$transaction(async (tx) => {
    const alert = await tx.settlementOperationalAlert.findUnique({ where: { id: alertId }, select: { id: true, settlementId: true, status: true } });
    if (!alert) return { ok: false, status: "not_found" as const };
    const status = resolve ? SettlementOperationalAlertStatus.RESOLVED : SettlementOperationalAlertStatus.ACKNOWLEDGED;
    if (alert.status === status) return { ok: true, status: resolve ? "resolved" as const : "acknowledged" as const };
    if (!resolve && alert.status === SettlementOperationalAlertStatus.RESOLVED) return { ok: false, status: "stale" as const };
    const updated = await tx.settlementOperationalAlert.updateMany({ where: { id: alertId, status: alert.status }, data: { status, ...(resolve ? { resolvedAt: now } : { acknowledgedAt: now, acknowledgedByUserId: actorUserId }) } });
    if (updated.count !== 1) return { ok: false, status: "stale" as const };
    if (alert.settlementId) {
      await tx.settlementEvent.upsert({
        where: { idempotencyKey: `settlement-alert:${alertId}:${resolve ? "resolved" : "acknowledged"}` },
        update: {},
        create: { settlementId: alert.settlementId, eventType: SettlementEventType.ADMIN_REEVALUATED, actorUserId, message: resolve ? "An administrator resolved an operational alert." : "An administrator acknowledged an operational alert.", metadata: { action: resolve ? "alert_resolved" : "alert_acknowledged", alertId }, idempotencyKey: `settlement-alert:${alertId}:${resolve ? "resolved" : "acknowledged"}` },
      });
    }
    return { ok: true, status: resolve ? "resolved" as const : "acknowledged" as const };
  });
}

export function getSettlementOperationsStripeClient() {
  return getStripe();
}
