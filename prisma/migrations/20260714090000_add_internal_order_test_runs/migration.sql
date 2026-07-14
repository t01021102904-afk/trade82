-- Internal production test records are deliberately stored outside the real
-- payment, order, and payout tables. They are simulations only and cannot
-- satisfy any foreign key used by Stripe or manual payout workflows.
CREATE TYPE "InternalOrderTestStatus" AS ENUM (
  'CREATED',
  'SIMULATED_PAID',
  'SIMULATED_PARTIALLY_REFUNDED',
  'SIMULATED_REFUNDED',
  'CANCELLED'
);

CREATE TABLE "InternalOrderTestRun" (
  "id" TEXT NOT NULL,
  "isInternalTest" BOOLEAN NOT NULL DEFAULT true,
  "testLabel" TEXT NOT NULL DEFAULT 'INTERNAL_PRODUCTION_TEST',
  "testerClerkUserId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "testOrderReference" TEXT NOT NULL,
  "status" "InternalOrderTestStatus" NOT NULL DEFAULT 'CREATED',
  "productName" TEXT NOT NULL,
  "productAmount" INTEGER NOT NULL,
  "shippingAmount" INTEGER NOT NULL,
  "grossAmount" INTEGER NOT NULL,
  "platformFeeAmount" INTEGER NOT NULL,
  "sellerPayableAmount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'usd',
  "simulatedPaidAmount" INTEGER NOT NULL DEFAULT 0,
  "simulatedRefundAmount" INTEGER NOT NULL DEFAULT 0,
  "payoutPreviewAmount" INTEGER,
  "payoutPreviewGeneratedAt" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "InternalOrderTestRun_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InternalOrderTestRun_is_internal_test" CHECK ("isInternalTest" = true),
  CONSTRAINT "InternalOrderTestRun_label" CHECK ("testLabel" = 'INTERNAL_PRODUCTION_TEST'),
  CONSTRAINT "InternalOrderTestRun_reference" CHECK ("testOrderReference" LIKE 'TEST-%'),
  CONSTRAINT "InternalOrderTestRun_currency" CHECK ("currency" = 'usd'),
  CONSTRAINT "InternalOrderTestRun_financials" CHECK (
    "productAmount" > 0 AND
    "shippingAmount" >= 0 AND
    "grossAmount" = "productAmount" + "shippingAmount" AND
    "platformFeeAmount" >= 0 AND
    "sellerPayableAmount" = "grossAmount" - "platformFeeAmount" AND
    "sellerPayableAmount" >= 0 AND
    "simulatedPaidAmount" >= 0 AND
    "simulatedPaidAmount" <= "grossAmount" AND
    "simulatedRefundAmount" >= 0 AND
    "simulatedRefundAmount" <= "simulatedPaidAmount" AND
    (
      "payoutPreviewAmount" IS NULL OR
      (
        "payoutPreviewAmount" >= 0 AND
        "payoutPreviewAmount" <= GREATEST("sellerPayableAmount" - "simulatedRefundAmount", 0)
      )
    )
  )
);

CREATE UNIQUE INDEX "InternalOrderTestRun_idempotencyKey_key" ON "InternalOrderTestRun"("idempotencyKey");
CREATE UNIQUE INDEX "InternalOrderTestRun_testOrderReference_key" ON "InternalOrderTestRun"("testOrderReference");
CREATE INDEX "InternalOrderTestRun_testerClerkUserId_createdAt_idx" ON "InternalOrderTestRun"("testerClerkUserId", "createdAt");
CREATE INDEX "InternalOrderTestRun_isInternalTest_createdAt_idx" ON "InternalOrderTestRun"("isInternalTest", "createdAt");

-- Test simulations are server-only. Supabase Data API roles receive no direct
-- access, and no permissive RLS policy is added.
ALTER TABLE "InternalOrderTestRun" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "InternalOrderTestRun" FROM anon, authenticated;
