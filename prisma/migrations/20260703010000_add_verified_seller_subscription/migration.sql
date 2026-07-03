-- Add Stripe subscription metadata for the seller Verified Seller plan.
ALTER TABLE "Company"
  ADD COLUMN "stripeCustomerId" TEXT,
  ADD COLUMN "stripeSubscriptionId" TEXT,
  ADD COLUMN "subscriptionStatus" TEXT,
  ADD COLUMN "subscriptionPlan" TEXT,
  ADD COLUMN "subscriptionCurrentPeriodEnd" TIMESTAMP(3),
  ADD COLUMN "verifiedSellerSince" TIMESTAMP(3);

CREATE UNIQUE INDEX "Company_stripeCustomerId_key" ON "Company"("stripeCustomerId");
CREATE UNIQUE INDEX "Company_stripeSubscriptionId_key" ON "Company"("stripeSubscriptionId");
CREATE INDEX "Company_subscriptionStatus_subscriptionPlan_idx" ON "Company"("subscriptionStatus", "subscriptionPlan");
