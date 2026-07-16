-- This migration is additive only. It creates a future Stripe Connect
-- settlement ledger and does not modify the current payment, order, payout,
-- refund, or dispute records.

CREATE TYPE "PartnerProfileStatus" AS ENUM ('ACTIVE', 'SUSPENDED');
CREATE TYPE "ReferralAttributionStatus" AS ENUM ('LOCKED', 'VOIDED');
CREATE TYPE "StripeConnectedAccountStatus" AS ENUM ('PENDING', 'RESTRICTED', 'ENABLED', 'DISABLED');
CREATE TYPE "SettlementStatus" AS ENUM ('PENDING', 'HOLD', 'READY', 'TRANSFER_PENDING', 'TRANSFERRED', 'REVERSED', 'CANCELLED');
CREATE TYPE "SettlementLegType" AS ENUM ('SELLER_PAYABLE', 'PARTNER_REFERRAL', 'PLATFORM_FEE');
CREATE TYPE "SettlementLegStatus" AS ENUM ('PENDING', 'HOLD', 'READY', 'TRANSFER_PENDING', 'TRANSFERRED', 'REVERSED', 'CANCELLED');
CREATE TYPE "SettlementEventType" AS ENUM ('CREATED', 'LEGS_CREATED', 'HOLD_STARTED', 'HOLD_RELEASED', 'TRANSFER_PENDING', 'TRANSFERRED', 'REVERSAL_CREATED', 'REVERSED', 'CANCELLED');
CREATE TYPE "SettlementReversalReason" AS ENUM ('REFUND', 'DISPUTE', 'MANUAL');

CREATE TABLE "PartnerProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "referralCode" TEXT NOT NULL,
  "status" "PartnerProfileStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PartnerProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReferralAttribution" (
  "id" TEXT NOT NULL,
  "referredUserId" TEXT NOT NULL,
  "partnerProfileId" TEXT NOT NULL,
  "referralCode" TEXT NOT NULL,
  "status" "ReferralAttributionStatus" NOT NULL DEFAULT 'LOCKED',
  "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReferralAttribution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StripeConnectedAccount" (
  "id" TEXT NOT NULL,
  "companyId" TEXT,
  "partnerProfileId" TEXT,
  "stripeAccountId" TEXT NOT NULL,
  "status" "StripeConnectedAccountStatus" NOT NULL DEFAULT 'PENDING',
  "chargesEnabled" BOOLEAN NOT NULL DEFAULT false,
  "payoutsEnabled" BOOLEAN NOT NULL DEFAULT false,
  "transfersEnabled" BOOLEAN NOT NULL DEFAULT false,
  "detailsSubmitted" BOOLEAN NOT NULL DEFAULT false,
  "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StripeConnectedAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Settlement" (
  "id" TEXT NOT NULL,
  "paymentRequestId" TEXT NOT NULL,
  "tradeOrderId" TEXT NOT NULL,
  "referralAttributionId" TEXT,
  "referralPartnerProfileId" TEXT,
  "referralCodeSnapshot" TEXT,
  "grossAmount" INTEGER NOT NULL,
  "platformFeeAmount" INTEGER NOT NULL,
  "sellerPayableAmount" INTEGER NOT NULL,
  "partnerReferralAmount" INTEGER NOT NULL DEFAULT 0,
  "trade82RetainedAmountBeforeStripeFees" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'usd',
  "holdUntil" TIMESTAMP(3) NOT NULL,
  "status" "SettlementStatus" NOT NULL DEFAULT 'HOLD',
  "idempotencyKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Settlement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SettlementLeg" (
  "id" TEXT NOT NULL,
  "settlementId" TEXT NOT NULL,
  "type" "SettlementLegType" NOT NULL,
  "recipientCompanyId" TEXT,
  "recipientUserId" TEXT,
  "partnerProfileId" TEXT,
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'usd',
  "holdUntil" TIMESTAMP(3) NOT NULL,
  "status" "SettlementLegStatus" NOT NULL DEFAULT 'HOLD',
  "idempotencyKey" TEXT NOT NULL,
  "stripeTransferId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SettlementLeg_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SettlementEvent" (
  "id" TEXT NOT NULL,
  "settlementId" TEXT NOT NULL,
  "settlementLegId" TEXT,
  "eventType" "SettlementEventType" NOT NULL,
  "actorUserId" TEXT,
  "message" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "idempotencyKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SettlementEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SettlementReversal" (
  "id" TEXT NOT NULL,
  "settlementId" TEXT NOT NULL,
  "settlementLegId" TEXT,
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'usd',
  "reason" "SettlementReversalReason" NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "stripeRefundId" TEXT,
  "stripeTransferReversalId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SettlementReversal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PartnerProfile_userId_key" ON "PartnerProfile"("userId");
CREATE UNIQUE INDEX "PartnerProfile_referralCode_key" ON "PartnerProfile"("referralCode");
CREATE INDEX "PartnerProfile_status_createdAt_idx" ON "PartnerProfile"("status", "createdAt");
CREATE UNIQUE INDEX "ReferralAttribution_referredUserId_key" ON "ReferralAttribution"("referredUserId");
CREATE INDEX "ReferralAttribution_partnerProfileId_lockedAt_idx" ON "ReferralAttribution"("partnerProfileId", "lockedAt");
CREATE UNIQUE INDEX "StripeConnectedAccount_companyId_key" ON "StripeConnectedAccount"("companyId");
CREATE UNIQUE INDEX "StripeConnectedAccount_partnerProfileId_key" ON "StripeConnectedAccount"("partnerProfileId");
CREATE UNIQUE INDEX "StripeConnectedAccount_stripeAccountId_key" ON "StripeConnectedAccount"("stripeAccountId");
CREATE INDEX "StripeConnectedAccount_status_updatedAt_idx" ON "StripeConnectedAccount"("status", "updatedAt");
CREATE UNIQUE INDEX "Settlement_paymentRequestId_key" ON "Settlement"("paymentRequestId");
CREATE UNIQUE INDEX "Settlement_tradeOrderId_key" ON "Settlement"("tradeOrderId");
CREATE UNIQUE INDEX "Settlement_idempotencyKey_key" ON "Settlement"("idempotencyKey");
CREATE INDEX "Settlement_status_holdUntil_idx" ON "Settlement"("status", "holdUntil");
CREATE INDEX "Settlement_referralAttributionId_idx" ON "Settlement"("referralAttributionId");
CREATE INDEX "Settlement_referralPartnerProfileId_idx" ON "Settlement"("referralPartnerProfileId");
CREATE UNIQUE INDEX "SettlementLeg_idempotencyKey_key" ON "SettlementLeg"("idempotencyKey");
CREATE UNIQUE INDEX "SettlementLeg_stripeTransferId_key" ON "SettlementLeg"("stripeTransferId");
CREATE UNIQUE INDEX "SettlementLeg_settlementId_type_key" ON "SettlementLeg"("settlementId", "type");
CREATE INDEX "SettlementLeg_recipientCompanyId_status_holdUntil_idx" ON "SettlementLeg"("recipientCompanyId", "status", "holdUntil");
CREATE INDEX "SettlementLeg_recipientUserId_status_holdUntil_idx" ON "SettlementLeg"("recipientUserId", "status", "holdUntil");
CREATE INDEX "SettlementLeg_partnerProfileId_status_holdUntil_idx" ON "SettlementLeg"("partnerProfileId", "status", "holdUntil");
CREATE UNIQUE INDEX "SettlementEvent_idempotencyKey_key" ON "SettlementEvent"("idempotencyKey");
CREATE INDEX "SettlementEvent_settlementId_createdAt_idx" ON "SettlementEvent"("settlementId", "createdAt");
CREATE INDEX "SettlementEvent_settlementLegId_createdAt_idx" ON "SettlementEvent"("settlementLegId", "createdAt");
CREATE UNIQUE INDEX "SettlementReversal_idempotencyKey_key" ON "SettlementReversal"("idempotencyKey");
CREATE UNIQUE INDEX "SettlementReversal_stripeRefundId_settlementLegId_key" ON "SettlementReversal"("stripeRefundId", "settlementLegId");
CREATE UNIQUE INDEX "SettlementReversal_stripeTransferReversalId_key" ON "SettlementReversal"("stripeTransferReversalId");
CREATE INDEX "SettlementReversal_settlementId_createdAt_idx" ON "SettlementReversal"("settlementId", "createdAt");
CREATE INDEX "SettlementReversal_settlementLegId_createdAt_idx" ON "SettlementReversal"("settlementLegId", "createdAt");

ALTER TABLE "PartnerProfile" ADD CONSTRAINT "PartnerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReferralAttribution" ADD CONSTRAINT "ReferralAttribution_referredUserId_fkey" FOREIGN KEY ("referredUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReferralAttribution" ADD CONSTRAINT "ReferralAttribution_partnerProfileId_fkey" FOREIGN KEY ("partnerProfileId") REFERENCES "PartnerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StripeConnectedAccount" ADD CONSTRAINT "StripeConnectedAccount_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StripeConnectedAccount" ADD CONSTRAINT "StripeConnectedAccount_partnerProfileId_fkey" FOREIGN KEY ("partnerProfileId") REFERENCES "PartnerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_paymentRequestId_fkey" FOREIGN KEY ("paymentRequestId") REFERENCES "PaymentRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_tradeOrderId_fkey" FOREIGN KEY ("tradeOrderId") REFERENCES "TradeOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_referralAttributionId_fkey" FOREIGN KEY ("referralAttributionId") REFERENCES "ReferralAttribution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_referralPartnerProfileId_fkey" FOREIGN KEY ("referralPartnerProfileId") REFERENCES "PartnerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SettlementLeg" ADD CONSTRAINT "SettlementLeg_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "Settlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SettlementLeg" ADD CONSTRAINT "SettlementLeg_recipientCompanyId_fkey" FOREIGN KEY ("recipientCompanyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SettlementLeg" ADD CONSTRAINT "SettlementLeg_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SettlementLeg" ADD CONSTRAINT "SettlementLeg_partnerProfileId_fkey" FOREIGN KEY ("partnerProfileId") REFERENCES "PartnerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SettlementEvent" ADD CONSTRAINT "SettlementEvent_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "Settlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SettlementEvent" ADD CONSTRAINT "SettlementEvent_settlementLegId_fkey" FOREIGN KEY ("settlementLegId") REFERENCES "SettlementLeg"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SettlementEvent" ADD CONSTRAINT "SettlementEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SettlementReversal" ADD CONSTRAINT "SettlementReversal_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "Settlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SettlementReversal" ADD CONSTRAINT "SettlementReversal_settlementLegId_fkey" FOREIGN KEY ("settlementLegId") REFERENCES "SettlementLeg"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StripeConnectedAccount" ADD CONSTRAINT "StripeConnectedAccount_owner_xor_check"
  CHECK (("companyId" IS NOT NULL AND "partnerProfileId" IS NULL) OR ("companyId" IS NULL AND "partnerProfileId" IS NOT NULL));

ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_amount_currency_check"
  CHECK (
    "currency" = 'usd'
    AND "grossAmount" > 0
    AND "platformFeeAmount" >= 0
    AND "sellerPayableAmount" >= 0
    AND "partnerReferralAmount" >= 0
    AND "trade82RetainedAmountBeforeStripeFees" >= 0
    AND "sellerPayableAmount" + "partnerReferralAmount" + "trade82RetainedAmountBeforeStripeFees" = "grossAmount"
    AND "partnerReferralAmount" + "trade82RetainedAmountBeforeStripeFees" = "platformFeeAmount"
  );

ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_referral_snapshot_check"
  CHECK (
    ("referralAttributionId" IS NULL AND "referralPartnerProfileId" IS NULL AND "referralCodeSnapshot" IS NULL AND "partnerReferralAmount" = 0)
    OR ("referralAttributionId" IS NOT NULL AND "referralPartnerProfileId" IS NOT NULL AND "referralCodeSnapshot" IS NOT NULL AND "partnerReferralAmount" > 0)
  );

ALTER TABLE "SettlementLeg" ADD CONSTRAINT "SettlementLeg_amount_currency_recipient_check"
  CHECK (
    "amount" > 0
    AND "currency" = 'usd'
    AND (
      ("type" = 'SELLER_PAYABLE' AND "recipientCompanyId" IS NOT NULL AND "recipientUserId" IS NULL AND "partnerProfileId" IS NULL)
      OR ("type" = 'PARTNER_REFERRAL' AND "recipientCompanyId" IS NULL AND "recipientUserId" IS NOT NULL AND "partnerProfileId" IS NOT NULL)
      OR ("type" = 'PLATFORM_FEE' AND "recipientCompanyId" IS NULL AND "recipientUserId" IS NULL AND "partnerProfileId" IS NULL)
    )
  );

ALTER TABLE "SettlementReversal" ADD CONSTRAINT "SettlementReversal_amount_currency_check"
  CHECK ("amount" > 0 AND "currency" = 'usd');

-- Financial ledgers are server-only. No browser role gets Data API access.
ALTER TABLE "PartnerProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReferralAttribution" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StripeConnectedAccount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Settlement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SettlementLeg" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SettlementEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SettlementReversal" ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE "PartnerProfile" FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE "ReferralAttribution" FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE "StripeConnectedAccount" FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE "Settlement" FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE "SettlementLeg" FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE "SettlementEvent" FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE "SettlementReversal" FROM anon, authenticated;
