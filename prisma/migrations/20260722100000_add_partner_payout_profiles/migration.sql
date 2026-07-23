-- Add reviewed partner applications and encrypted Korean payout profiles.
ALTER TYPE "PartnerProfileStatus" ADD VALUE 'PENDING_REVIEW' BEFORE 'ACTIVE';
ALTER TYPE "PartnerProfileStatus" ADD VALUE 'REJECTED' AFTER 'SUSPENDED';

CREATE TYPE "PartnerPayoutProfileStatus" AS ENUM (
  'DRAFT',
  'PENDING_VERIFICATION',
  'VERIFIED',
  'REJECTED',
  'DISABLED'
);

ALTER TABLE "PartnerProfile"
  ADD COLUMN "payoutTermsConsentVersion" TEXT,
  ADD COLUMN "payoutTermsConsentedAt" TIMESTAMP(3);

CREATE TABLE "PartnerPayoutProfile" (
  "id" TEXT NOT NULL,
  "partnerProfileId" TEXT NOT NULL,
  "bankDirectoryId" TEXT NOT NULL,
  "country" TEXT NOT NULL,
  "bankName" TEXT NOT NULL,
  "accountHolder" TEXT NOT NULL,
  "accountNumberCiphertext" BYTEA NOT NULL,
  "accountNumberIv" BYTEA NOT NULL,
  "accountNumberAuthTag" BYTEA NOT NULL,
  "accountNumberKeyVersion" TEXT NOT NULL,
  "accountNumberLast4" TEXT NOT NULL,
  "accountNumberMasked" TEXT NOT NULL,
  "accountType" "PayoutAccountType" NOT NULL DEFAULT 'LOCAL',
  "payoutCurrency" TEXT NOT NULL DEFAULT 'krw',
  "supportedCurrencies" TEXT[] NOT NULL DEFAULT ARRAY['krw']::TEXT[],
  "accountBelongsToPartner" BOOLEAN NOT NULL DEFAULT false,
  "status" "PartnerPayoutProfileStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
  "verifiedAt" TIMESTAMP(3),
  "verifiedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PartnerPayoutProfile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PartnerPayoutProfile_korean_account_check" CHECK (
    "country" = 'KR'
    AND "accountType" = 'LOCAL'
    AND "payoutCurrency" = 'krw'
    AND "supportedCurrencies" = ARRAY['krw']::TEXT[]
    AND "accountBelongsToPartner" = true
  ),
  CONSTRAINT "PartnerPayoutProfile_encryption_check" CHECK (
    octet_length("accountNumberCiphertext") > 0
    AND octet_length("accountNumberIv") = 12
    AND octet_length("accountNumberAuthTag") = 16
    AND length("accountNumberKeyVersion") > 0
    AND "accountNumberLast4" ~ '^[0-9]{4}$'
    AND "accountNumberMasked" = '•••• ' || "accountNumberLast4"
  ),
  CONSTRAINT "PartnerPayoutProfile_verification_check" CHECK (
    (
      "status" = 'VERIFIED'
      AND "verifiedAt" IS NOT NULL
      AND "verifiedByUserId" IS NOT NULL
    ) OR (
      "status" <> 'VERIFIED'
      AND "verifiedAt" IS NULL
      AND "verifiedByUserId" IS NULL
    )
  )
);

CREATE TABLE "PartnerPayoutProfileAuditEvent" (
  "id" TEXT NOT NULL,
  "payoutProfileId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PartnerPayoutProfileAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PartnerProfileAuditEvent" (
  "id" TEXT NOT NULL,
  "partnerProfileId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PartnerProfileAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PartnerPayoutProfile_partnerProfileId_key"
  ON "PartnerPayoutProfile"("partnerProfileId");
CREATE INDEX "PartnerPayoutProfile_status_updatedAt_idx"
  ON "PartnerPayoutProfile"("status", "updatedAt");
CREATE INDEX "PartnerPayoutProfile_bankDirectoryId_idx"
  ON "PartnerPayoutProfile"("bankDirectoryId");
CREATE INDEX "PartnerPayoutProfileAuditEvent_payoutProfileId_createdAt_idx"
  ON "PartnerPayoutProfileAuditEvent"("payoutProfileId", "createdAt");
CREATE INDEX "PartnerPayoutProfileAuditEvent_actorUserId_createdAt_idx"
  ON "PartnerPayoutProfileAuditEvent"("actorUserId", "createdAt");
CREATE INDEX "PartnerProfileAuditEvent_partnerProfileId_createdAt_idx"
  ON "PartnerProfileAuditEvent"("partnerProfileId", "createdAt");
CREATE INDEX "PartnerProfileAuditEvent_actorUserId_createdAt_idx"
  ON "PartnerProfileAuditEvent"("actorUserId", "createdAt");

ALTER TABLE "PartnerPayoutProfile"
  ADD CONSTRAINT "PartnerPayoutProfile_partnerProfileId_fkey"
  FOREIGN KEY ("partnerProfileId") REFERENCES "PartnerProfile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PartnerPayoutProfile_bankDirectoryId_fkey"
  FOREIGN KEY ("bankDirectoryId") REFERENCES "BankDirectory"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PartnerPayoutProfile_verifiedByUserId_fkey"
  FOREIGN KEY ("verifiedByUserId") REFERENCES "UserProfile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PartnerPayoutProfileAuditEvent"
  ADD CONSTRAINT "PartnerPayoutProfileAuditEvent_payoutProfileId_fkey"
  FOREIGN KEY ("payoutProfileId") REFERENCES "PartnerPayoutProfile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PartnerPayoutProfileAuditEvent_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "UserProfile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PartnerProfileAuditEvent"
  ADD CONSTRAINT "PartnerProfileAuditEvent_partnerProfileId_fkey"
  FOREIGN KEY ("partnerProfileId") REFERENCES "PartnerProfile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PartnerProfileAuditEvent_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "UserProfile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "preventPartnerAuditMutation"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  RAISE EXCEPTION 'Partner audit records are immutable';
END;
$$;

CREATE TRIGGER "PartnerPayoutProfileAuditEvent_immutable"
BEFORE UPDATE OR DELETE ON "PartnerPayoutProfileAuditEvent"
FOR EACH ROW EXECUTE FUNCTION "preventPartnerAuditMutation"();

CREATE TRIGGER "PartnerProfileAuditEvent_immutable"
BEFORE UPDATE OR DELETE ON "PartnerProfileAuditEvent"
FOR EACH ROW EXECUTE FUNCTION "preventPartnerAuditMutation"();

ALTER TABLE "PartnerPayoutProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PartnerPayoutProfileAuditEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PartnerProfileAuditEvent" ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE
  "PartnerPayoutProfile",
  "PartnerPayoutProfileAuditEvent",
  "PartnerProfileAuditEvent"
FROM anon, authenticated;
