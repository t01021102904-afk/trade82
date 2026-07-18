-- This migration is additive. It extends the existing per-leg reversal ledger
-- with immutable Stripe source and amount snapshots for later manual reversal
-- execution. It does not call Stripe or modify payment/order records.

CREATE TYPE "SettlementReversalSourceType" AS ENUM ('REFUND', 'DISPUTE_LOST', 'PAYMENT_FAILURE');

ALTER TABLE "SettlementReversal"
  ADD COLUMN "requestedAmount" INTEGER,
  ADD COLUMN "successfullyReversedAmount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "sourceType" "SettlementReversalSourceType",
  ADD COLUMN "stripeSourceObjectId" TEXT,
  ADD COLUMN "originalStripeTransferId" TEXT;

UPDATE "SettlementReversal" AS reversal
SET
  "requestedAmount" = reversal."amount",
  "successfullyReversedAmount" = CASE
    WHEN reversal."status" = 'COMPLETED' THEN reversal."amount"
    ELSE 0
  END,
  "sourceType" = CASE
    WHEN reversal."reason" = 'REFUND' THEN 'REFUND'::"SettlementReversalSourceType"
    WHEN reversal."reason" = 'DISPUTE' THEN 'DISPUTE_LOST'::"SettlementReversalSourceType"
    ELSE NULL
  END,
  "stripeSourceObjectId" = COALESCE(reversal."stripeRefundId", reversal."stripeDisputeId"),
  "originalStripeTransferId" = leg."stripeTransferId"
FROM "SettlementLeg" AS leg
WHERE leg."id" = reversal."settlementLegId"
  AND leg."settlementId" = reversal."settlementId";

ALTER TABLE "SettlementReversal"
  ADD CONSTRAINT "SettlementReversal_requested_amount_check"
    CHECK ("requestedAmount" IS NULL OR "requestedAmount" >= 0),
  ADD CONSTRAINT "SettlementReversal_successfully_reversed_amount_check"
    CHECK (
      "successfullyReversedAmount" >= 0
      AND "successfullyReversedAmount" <= COALESCE("requestedAmount", "amount")
    );

CREATE INDEX "SettlementReversal_sourceType_stripeSourceObjectId_settlementLegId_idx"
  ON "SettlementReversal"("sourceType", "stripeSourceObjectId", "settlementLegId");

ALTER TABLE "SettlementReversal" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "SettlementReversal" FROM anon, authenticated;
