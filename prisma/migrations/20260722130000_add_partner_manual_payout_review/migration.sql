CREATE TYPE "PartnerPayoutStatus" AS ENUM (
  'NOT_READY',
  'HOLD',
  'READY',
  'PROCESSING',
  'SENT',
  'FAILED',
  'RETURNED',
  'CANCELLED'
);

CREATE TYPE "PartnerPayoutEventType" AS ENUM (
  'CREATED',
  'READY',
  'HOLD',
  'PROCESSING',
  'SENT',
  'FAILED',
  'RETURNED',
  'CANCELLED',
  'ACCOUNT_REVEALED',
  'RECONCILIATION_REQUIRED'
);

CREATE TABLE "PartnerPayout" (
  "id" TEXT NOT NULL,
  "settlementId" TEXT NOT NULL,
  "settlementLegId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "partnerProfileId" TEXT NOT NULL,
  "payoutProfileId" TEXT,
  "payoutNumber" TEXT NOT NULL,
  "status" "PartnerPayoutStatus" NOT NULL DEFAULT 'NOT_READY',
  "currency" TEXT NOT NULL DEFAULT 'usd',
  "originalCommissionAmount" INTEGER NOT NULL,
  "reversalAdjustmentAmount" INTEGER NOT NULL DEFAULT 0,
  "finalPayoutAmount" INTEGER NOT NULL,
  "holdUntil" TIMESTAMP(3) NOT NULL,
  "accountCountrySnapshot" TEXT,
  "accountTypeSnapshot" "PayoutAccountType",
  "payoutCurrencySnapshot" TEXT,
  "supportedCurrenciesSnapshot" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "bankNameSnapshot" TEXT,
  "accountHolderSnapshot" TEXT,
  "accountNumberSnapshotEncrypted" BYTEA,
  "accountNumberSnapshotIv" BYTEA,
  "accountNumberSnapshotAuthTag" BYTEA,
  "accountNumberSnapshotKeyVersion" TEXT,
  "accountNumberLast4" TEXT,
  "accountNumberMasked" TEXT,
  "partnerLegalNameSnapshot" TEXT,
  "partnerDisplayNameSnapshot" TEXT,
  "partnerOrganizationSnapshot" TEXT,
  "partnerEmailSnapshot" TEXT,
  "partnerPhoneSnapshot" TEXT,
  "partnerResidenceCountrySnapshot" TEXT,
  "preparedAt" TIMESTAMP(3),
  "preparedByUserId" TEXT,
  "sentAt" TIMESTAMP(3),
  "sentByUserId" TEXT,
  "failedAt" TIMESTAMP(3),
  "externalTransferReference" TEXT,
  "externalBankReference" TEXT,
  "failureReason" TEXT,
  "internalNote" TEXT,
  "requiresManualReconciliation" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PartnerPayout_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PartnerPayout_amounts_check" CHECK (
    "originalCommissionAmount" >= 0
    AND "reversalAdjustmentAmount" >= 0
    AND "finalPayoutAmount" >= 0
  ),
  CONSTRAINT "PartnerPayout_sent_reference_check" CHECK (
    "status" <> 'SENT'
    OR ("sentAt" IS NOT NULL AND "externalTransferReference" IS NOT NULL)
  )
);

CREATE TABLE "PartnerPayoutEvent" (
  "id" TEXT NOT NULL,
  "payoutId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "eventType" "PartnerPayoutEventType" NOT NULL,
  "message" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PartnerPayoutEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PartnerPayout_settlementId_key" ON "PartnerPayout"("settlementId");
CREATE UNIQUE INDEX "PartnerPayout_settlementLegId_key" ON "PartnerPayout"("settlementLegId");
CREATE UNIQUE INDEX "PartnerPayout_payoutNumber_key" ON "PartnerPayout"("payoutNumber");
CREATE INDEX "PartnerPayout_partnerProfileId_createdAt_idx" ON "PartnerPayout"("partnerProfileId", "createdAt");
CREATE INDEX "PartnerPayout_status_createdAt_idx" ON "PartnerPayout"("status", "createdAt");
CREATE INDEX "PartnerPayout_payoutProfileId_idx" ON "PartnerPayout"("payoutProfileId");
CREATE INDEX "PartnerPayout_orderId_idx" ON "PartnerPayout"("orderId");
CREATE INDEX "PartnerPayoutEvent_payoutId_createdAt_idx" ON "PartnerPayoutEvent"("payoutId", "createdAt");
CREATE INDEX "PartnerPayoutEvent_eventType_createdAt_idx" ON "PartnerPayoutEvent"("eventType", "createdAt");

ALTER TABLE "PartnerPayout"
  ADD CONSTRAINT "PartnerPayout_settlementId_fkey"
  FOREIGN KEY ("settlementId") REFERENCES "Settlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PartnerPayout"
  ADD CONSTRAINT "PartnerPayout_settlementLegId_fkey"
  FOREIGN KEY ("settlementLegId") REFERENCES "SettlementLeg"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PartnerPayout"
  ADD CONSTRAINT "PartnerPayout_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "TradeOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PartnerPayout"
  ADD CONSTRAINT "PartnerPayout_partnerProfileId_fkey"
  FOREIGN KEY ("partnerProfileId") REFERENCES "PartnerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PartnerPayout"
  ADD CONSTRAINT "PartnerPayout_payoutProfileId_fkey"
  FOREIGN KEY ("payoutProfileId") REFERENCES "PartnerPayoutProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PartnerPayout"
  ADD CONSTRAINT "PartnerPayout_preparedByUserId_fkey"
  FOREIGN KEY ("preparedByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PartnerPayout"
  ADD CONSTRAINT "PartnerPayout_sentByUserId_fkey"
  FOREIGN KEY ("sentByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PartnerPayoutEvent"
  ADD CONSTRAINT "PartnerPayoutEvent_payoutId_fkey"
  FOREIGN KEY ("payoutId") REFERENCES "PartnerPayout"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PartnerPayoutEvent"
  ADD CONSTRAINT "PartnerPayoutEvent_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PartnerPayout" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PartnerPayoutEvent" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "PartnerPayout" FROM anon, authenticated;
REVOKE ALL ON TABLE "PartnerPayoutEvent" FROM anon, authenticated;
