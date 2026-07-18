-- This migration adds explicit terminal/manual-review reversal states and
-- records explicit administrator requeue operations. It does not call Stripe
-- or modify payment, order, or payout records.

ALTER TYPE "SettlementReversalStatus" ADD VALUE IF NOT EXISTS 'FAILED';
ALTER TYPE "SettlementReversalStatus" ADD VALUE IF NOT EXISTS 'NEEDS_MANUAL_REVIEW';

ALTER TABLE "SettlementReversal"
  DROP CONSTRAINT "SettlementReversal_stripeTransferReversalId_status_check";

ALTER TABLE "SettlementReversal"
  ADD CONSTRAINT "SettlementReversal_stripeTransferReversalId_status_check"
  CHECK (
    ("status" = 'COMPLETED' AND "stripeTransferReversalId" IS NOT NULL)
    OR ("status" IN ('ACCOUNTING_APPLIED', 'PENDING', 'FAILED', 'NEEDS_MANUAL_REVIEW') AND "stripeTransferReversalId" IS NULL)
  );

ALTER TABLE "SettlementReversal"
  ADD COLUMN "manualRequeueCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "SettlementReversal"
  ADD CONSTRAINT "SettlementReversal_manual_requeue_count_check"
    CHECK ("manualRequeueCount" >= 0);

CREATE INDEX "SettlementReversal_status_reversalLockedAt_idx"
  ON "SettlementReversal"("status", "reversalLockedAt");

ALTER TABLE "SettlementReversal" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "SettlementReversal" FROM anon, authenticated;
