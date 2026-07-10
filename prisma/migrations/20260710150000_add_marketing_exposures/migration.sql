CREATE TYPE "MarketingExposurePlan" AS ENUM ('LANDING_7D', 'LANDING_30D', 'LANDING_90D');

CREATE TYPE "MarketingExposureStatus" AS ENUM ('PENDING', 'ACTIVE', 'EXPIRED', 'CANCELLED');

CREATE TABLE "MarketingExposure" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "plan" "MarketingExposurePlan" NOT NULL,
  "status" "MarketingExposureStatus" NOT NULL DEFAULT 'PENDING',
  "stripeCustomerId" TEXT,
  "stripeCheckoutSessionId" TEXT,
  "stripePaymentIntentId" TEXT,
  "priceId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'usd',
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MarketingExposure_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketingExposure_stripeCheckoutSessionId_key" ON "MarketingExposure"("stripeCheckoutSessionId");
CREATE INDEX "MarketingExposure_companyId_status_idx" ON "MarketingExposure"("companyId", "status");
CREATE INDEX "MarketingExposure_productId_status_idx" ON "MarketingExposure"("productId", "status");
CREATE INDEX "MarketingExposure_status_startsAt_endsAt_idx" ON "MarketingExposure"("status", "startsAt", "endsAt");

ALTER TABLE "MarketingExposure" ADD CONSTRAINT "MarketingExposure_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingExposure" ADD CONSTRAINT "MarketingExposure_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingExposure" ADD CONSTRAINT "MarketingExposure_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
