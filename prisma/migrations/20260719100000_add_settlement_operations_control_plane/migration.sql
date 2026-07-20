-- Add the operational control plane around the existing SCT settlement ledger.
CREATE TYPE "SettlementPaymentFlow" AS ENUM ('SCT', 'DIRECT_CHARGE');
CREATE TYPE "SettlementWorkerType" AS ENUM ('TRANSFER', 'REVERSAL', 'STALE_RECOVERY', 'METRIC_SNAPSHOT');
CREATE TYPE "SettlementWorkerRunStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'PARTIALLY_FAILED', 'FAILED', 'SKIPPED');
CREATE TYPE "SettlementOperationalAlertType" AS ENUM (
  'TRANSFER_RETRY_EXHAUSTED',
  'REVERSAL_RETRY_EXHAUSTED',
  'TRANSFER_NEEDS_MANUAL_REVIEW',
  'REVERSAL_NEEDS_MANUAL_REVIEW',
  'STALE_TRANSFER_CLAIM',
  'STALE_REVERSAL_CLAIM',
  'WORKER_FAILED',
  'WORKER_PARTIALLY_FAILED',
  'LONG_PENDING_TRANSFER',
  'LONG_PENDING_REVERSAL',
  'DISPUTE_OPEN_WITH_READY_TRANSFER',
  'REFUND_WITH_UNREVERSED_TRANSFER'
);
CREATE TYPE "SettlementOperationalAlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');
CREATE TYPE "SettlementOperationalAlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');

ALTER TABLE "Settlement"
  ADD COLUMN "paymentFlow" "SettlementPaymentFlow" NOT NULL DEFAULT 'SCT';

ALTER TABLE "SettlementLeg"
  ADD COLUMN "manualReviewRequired" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "SettlementWorkerRun" (
  "id" TEXT NOT NULL,
  "workerType" "SettlementWorkerType" NOT NULL,
  "executionMode" TEXT NOT NULL,
  "status" "SettlementWorkerRunStatus" NOT NULL DEFAULT 'RUNNING',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "scannedCount" INTEGER NOT NULL DEFAULT 0,
  "claimedCount" INTEGER NOT NULL DEFAULT 0,
  "succeededCount" INTEGER NOT NULL DEFAULT 0,
  "failedCount" INTEGER NOT NULL DEFAULT 0,
  "skippedCount" INTEGER NOT NULL DEFAULT 0,
  "manualReviewCount" INTEGER NOT NULL DEFAULT 0,
  "staleRecoveredCount" INTEGER NOT NULL DEFAULT 0,
  "durationMs" INTEGER,
  "sanitizedErrorCode" VARCHAR(64),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SettlementWorkerRun_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SettlementWorkerRun_counts_check" CHECK (
    "scannedCount" >= 0 AND "claimedCount" >= 0 AND "succeededCount" >= 0 AND
    "failedCount" >= 0 AND "skippedCount" >= 0 AND "manualReviewCount" >= 0 AND
    "staleRecoveredCount" >= 0 AND ("durationMs" IS NULL OR "durationMs" >= 0)
  )
);

CREATE INDEX "SettlementWorkerRun_workerType_status_startedAt_idx"
  ON "SettlementWorkerRun"("workerType", "status", "startedAt");
CREATE INDEX "SettlementWorkerRun_status_startedAt_idx"
  ON "SettlementWorkerRun"("status", "startedAt");

CREATE TABLE "SettlementOperationalAlert" (
  "id" TEXT NOT NULL,
  "alertType" "SettlementOperationalAlertType" NOT NULL,
  "severity" "SettlementOperationalAlertSeverity" NOT NULL,
  "status" "SettlementOperationalAlertStatus" NOT NULL DEFAULT 'OPEN',
  "settlementId" TEXT,
  "settlementLegId" TEXT,
  "settlementReversalId" TEXT,
  "workerRunId" TEXT,
  "title" TEXT NOT NULL,
  "sanitizedMessage" VARCHAR(1000) NOT NULL,
  "occurrenceCount" INTEGER NOT NULL DEFAULT 1,
  "firstOccurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastOccurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acknowledgedAt" TIMESTAMP(3),
  "acknowledgedByUserId" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "deduplicationKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SettlementOperationalAlert_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SettlementOperationalAlert_deduplicationKey_key" UNIQUE ("deduplicationKey"),
  CONSTRAINT "SettlementOperationalAlert_occurrenceCount_check" CHECK ("occurrenceCount" > 0)
);

CREATE INDEX "SettlementOperationalAlert_status_severity_lastOccurredAt_idx"
  ON "SettlementOperationalAlert"("status", "severity", "lastOccurredAt");
CREATE INDEX "SettlementOperationalAlert_settlementId_status_idx"
  ON "SettlementOperationalAlert"("settlementId", "status");
CREATE INDEX "SettlementOperationalAlert_settlementLegId_status_idx"
  ON "SettlementOperationalAlert"("settlementLegId", "status");
CREATE INDEX "SettlementOperationalAlert_settlementReversalId_status_idx"
  ON "SettlementOperationalAlert"("settlementReversalId", "status");
CREATE INDEX "SettlementOperationalAlert_workerRunId_idx"
  ON "SettlementOperationalAlert"("workerRunId");

ALTER TABLE "SettlementOperationalAlert"
  ADD CONSTRAINT "SettlementOperationalAlert_settlementId_fkey"
  FOREIGN KEY ("settlementId") REFERENCES "Settlement"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "SettlementOperationalAlert_settlementLegId_fkey"
  FOREIGN KEY ("settlementLegId") REFERENCES "SettlementLeg"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "SettlementOperationalAlert_settlementReversalId_fkey"
  FOREIGN KEY ("settlementReversalId") REFERENCES "SettlementReversal"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "SettlementOperationalAlert_workerRunId_fkey"
  FOREIGN KEY ("workerRunId") REFERENCES "SettlementWorkerRun"("id")
  ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "SettlementOperationalAlert_acknowledgedByUserId_fkey"
  FOREIGN KEY ("acknowledgedByUserId") REFERENCES "UserProfile"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "SettlementLeg_status_nextTransferAttemptAt_transferLockedAt_idx"
  ON "SettlementLeg"("status", "nextTransferAttemptAt", "transferLockedAt");
CREATE INDEX "SettlementLeg_manualReviewRequired_status_idx"
  ON "SettlementLeg"("manualReviewRequired", "status");
CREATE INDEX "SettlementReversal_status_nextReversalAttemptAt_reversalLockedAt_idx"
  ON "SettlementReversal"("status", "nextReversalAttemptAt", "reversalLockedAt");

ALTER TABLE "SettlementWorkerRun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SettlementOperationalAlert" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "SettlementWorkerRun", "SettlementOperationalAlert" FROM anon, authenticated;
