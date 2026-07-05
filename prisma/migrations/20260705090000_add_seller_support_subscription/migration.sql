ALTER TABLE "Company"
  ADD COLUMN "sellerSupportPlan" TEXT,
  ADD COLUMN "sellerSupportStatus" TEXT,
  ADD COLUMN "sellerSupportStripeCustomerId" TEXT,
  ADD COLUMN "sellerSupportStripeSubscriptionId" TEXT,
  ADD COLUMN "sellerSupportCurrentPeriodEnd" TIMESTAMP(3),
  ADD COLUMN "sellerSupportMonthlyLimit" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "sellerSupportMonthlyUsed" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "Company_sellerSupportStripeCustomerId_key" ON "Company"("sellerSupportStripeCustomerId");
CREATE UNIQUE INDEX "Company_sellerSupportStripeSubscriptionId_key" ON "Company"("sellerSupportStripeSubscriptionId");
CREATE INDEX "Company_sellerSupportStatus_sellerSupportPlan_idx" ON "Company"("sellerSupportStatus", "sellerSupportPlan");
