-- This migration is additive. It adds ledger-only release eligibility, approval,
-- and future retry metadata. It does not call Stripe or modify payment, order,
-- manual payout, refund, or dispute records.

ALTER TYPE "SettlementEventType" ADD VALUE IF NOT EXISTS 'ADMIN_APPROVED';
ALTER TYPE "SettlementEventType" ADD VALUE IF NOT EXISTS 'ADMIN_HELD';
ALTER TYPE "SettlementEventType" ADD VALUE IF NOT EXISTS 'ADMIN_REEVALUATED';

ALTER TABLE "Settlement"
  ADD COLUMN "approvedAt" TIMESTAMP(3),
  ADD COLUMN "approvedByUserId" TEXT,
  ADD COLUMN "holdReason" VARCHAR(1000);

ALTER TABLE "SettlementLeg"
  ADD COLUMN "transferAttemptCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "nextTransferAttemptAt" TIMESTAMP(3),
  ADD COLUMN "transferLastError" VARCHAR(1000),
  ADD COLUMN "transferLockedAt" TIMESTAMP(3),
  ADD COLUMN "transferredAt" TIMESTAMP(3);

ALTER TABLE "SettlementReversal"
  ADD COLUMN "reversalAttemptCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "nextReversalAttemptAt" TIMESTAMP(3),
  ADD COLUMN "reversalLastError" VARCHAR(1000),
  ADD COLUMN "reversalLockedAt" TIMESTAMP(3),
  ADD COLUMN "completedAt" TIMESTAMP(3);

ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_approval_hold_reason_check"
  CHECK ("holdReason" IS NULL OR char_length(btrim("holdReason")) BETWEEN 3 AND 1000);

ALTER TABLE "SettlementLeg" ADD CONSTRAINT "SettlementLeg_transfer_retry_check"
  CHECK (
    "transferAttemptCount" >= 0
    AND ("transferLastError" IS NULL OR char_length("transferLastError") <= 1000)
  );

ALTER TABLE "SettlementReversal" ADD CONSTRAINT "SettlementReversal_retry_check"
  CHECK (
    "reversalAttemptCount" >= 0
    AND ("reversalLastError" IS NULL OR char_length("reversalLastError") <= 1000)
  );

ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_approvedByUserId_fkey"
  FOREIGN KEY ("approvedByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Settlement_approvedByUserId_idx" ON "Settlement"("approvedByUserId");
CREATE INDEX "SettlementLeg_status_holdUntil_idx" ON "SettlementLeg"("status", "holdUntil");
CREATE INDEX "SettlementLeg_status_nextTransferAttemptAt_idx" ON "SettlementLeg"("status", "nextTransferAttemptAt");
CREATE INDEX "SettlementReversal_status_nextReversalAttemptAt_idx" ON "SettlementReversal"("status", "nextReversalAttemptAt");
