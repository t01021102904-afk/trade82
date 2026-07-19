-- Add the separate seller merchant account record used for future Direct Charges.
CREATE TYPE "SellerStripeMerchantAccountStatus" AS ENUM (
  'ONBOARDING_INCOMPLETE',
  'UNDER_REVIEW',
  'ENABLED',
  'RESTRICTED',
  'DISABLED'
);

CREATE TABLE "SellerStripeMerchantAccount" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "stripeAccountId" TEXT NOT NULL,
  "country" TEXT NOT NULL,
  "status" "SellerStripeMerchantAccountStatus" NOT NULL DEFAULT 'ONBOARDING_INCOMPLETE',
  "chargesEnabled" BOOLEAN NOT NULL DEFAULT false,
  "payoutsEnabled" BOOLEAN NOT NULL DEFAULT false,
  "cardPaymentsEnabled" BOOLEAN NOT NULL DEFAULT false,
  "transfersEnabled" BOOLEAN NOT NULL DEFAULT false,
  "detailsSubmitted" BOOLEAN NOT NULL DEFAULT false,
  "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
  "requirementsOutstanding" BOOLEAN NOT NULL DEFAULT false,
  "controllerFeesPayer" TEXT NOT NULL DEFAULT 'account',
  "controllerLossesPayments" TEXT NOT NULL DEFAULT 'stripe',
  "dashboardType" TEXT NOT NULL DEFAULT 'full',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SellerStripeMerchantAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SellerStripeMerchantAccount_companyId_key"
  ON "SellerStripeMerchantAccount"("companyId");

CREATE UNIQUE INDEX "SellerStripeMerchantAccount_stripeAccountId_key"
  ON "SellerStripeMerchantAccount"("stripeAccountId");

CREATE INDEX "SellerStripeMerchantAccount_status_updatedAt_idx"
  ON "SellerStripeMerchantAccount"("status", "updatedAt");

ALTER TABLE "SellerStripeMerchantAccount"
  ADD CONSTRAINT "SellerStripeMerchantAccount_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SellerStripeMerchantAccount" ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE "SellerStripeMerchantAccount" FROM anon, authenticated;
