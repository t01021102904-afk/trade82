-- This migration is additive. It records settlement refund and dispute
-- reconciliation only; it does not create Stripe Transfers or modify existing
-- payment, manual payout, or webhook records.

ALTER TYPE "SettlementStatus" ADD VALUE IF NOT EXISTS 'REVERSAL_PENDING';
ALTER TYPE "SettlementLegStatus" ADD VALUE IF NOT EXISTS 'REVERSAL_PENDING';
ALTER TYPE "SettlementEventType" ADD VALUE IF NOT EXISTS 'REFUND_RECONCILIATION_STARTED';
ALTER TYPE "SettlementEventType" ADD VALUE IF NOT EXISTS 'PARTIAL_REFUND_RECONCILED';
ALTER TYPE "SettlementEventType" ADD VALUE IF NOT EXISTS 'FULL_REFUND_CANCELLED';
ALTER TYPE "SettlementEventType" ADD VALUE IF NOT EXISTS 'DISPUTE_OPENED';
ALTER TYPE "SettlementEventType" ADD VALUE IF NOT EXISTS 'DISPUTE_UPDATED';
ALTER TYPE "SettlementEventType" ADD VALUE IF NOT EXISTS 'DISPUTE_WON';
ALTER TYPE "SettlementEventType" ADD VALUE IF NOT EXISTS 'DISPUTE_LOST';
ALTER TYPE "SettlementEventType" ADD VALUE IF NOT EXISTS 'POST_TRANSFER_REVERSAL_REQUIRED';

CREATE TYPE "SettlementReversalStatus" AS ENUM ('ACCOUNTING_APPLIED', 'PENDING', 'COMPLETED');

ALTER TABLE "SettlementReversal"
  ADD COLUMN "status" "SettlementReversalStatus" NOT NULL DEFAULT 'ACCOUNTING_APPLIED',
  ADD COLUMN "stripeDisputeId" TEXT;

ALTER TABLE "SettlementReversal" ADD CONSTRAINT "SettlementReversal_stripeTransferReversalId_status_check"
  CHECK (
    ("status" = 'COMPLETED' AND "stripeTransferReversalId" IS NOT NULL)
    OR ("status" IN ('ACCOUNTING_APPLIED', 'PENDING') AND "stripeTransferReversalId" IS NULL)
  );

ALTER TABLE "PaymentDispute"
  ADD COLUMN "lastStripeEventCreatedAt" TIMESTAMP(3),
  ADD COLUMN "lastStripeEventId" TEXT;

UPDATE "PaymentDispute"
SET
  "lastStripeEventCreatedAt" = "createdAt",
  "lastStripeEventId" = "stripeDisputeId"
WHERE "lastStripeEventCreatedAt" IS NULL
   OR "lastStripeEventId" IS NULL;

ALTER TABLE "PaymentDispute"
  ALTER COLUMN "lastStripeEventCreatedAt" SET NOT NULL,
  ALTER COLUMN "lastStripeEventId" SET NOT NULL;

CREATE UNIQUE INDEX "SettlementReversal_stripeDisputeId_settlementLegId_key"
  ON "SettlementReversal"("stripeDisputeId", "settlementLegId");

-- Settlement reversal rows are server-only financial records, like the
-- existing ledger tables. No browser role gets Data API access.
ALTER TABLE "SettlementReversal" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "SettlementReversal" FROM anon, authenticated;
