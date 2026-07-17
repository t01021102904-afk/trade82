-- This migration is additive. Referral claims are server-only evidence used to
-- lock the first valid partner attribution at UserProfile creation time.

CREATE TABLE "ReferralClaimToken" (
  "id" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "partnerProfileId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "consumedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReferralClaimToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReferralClaimToken_tokenHash_key" ON "ReferralClaimToken"("tokenHash");
CREATE INDEX "ReferralClaimToken_partnerProfileId_expiresAt_idx"
  ON "ReferralClaimToken"("partnerProfileId", "expiresAt");
CREATE INDEX "ReferralClaimToken_consumedByUserId_createdAt_idx"
  ON "ReferralClaimToken"("consumedByUserId", "createdAt");

ALTER TABLE "ReferralClaimToken"
  ADD CONSTRAINT "ReferralClaimToken_partnerProfileId_fkey"
  FOREIGN KEY ("partnerProfileId") REFERENCES "PartnerProfile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReferralClaimToken"
  ADD CONSTRAINT "ReferralClaimToken_consumedByUserId_fkey"
  FOREIGN KEY ("consumedByUserId") REFERENCES "UserProfile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Referral evidence is only read and written through trusted server routes.
ALTER TABLE "ReferralClaimToken" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "ReferralClaimToken" FROM anon, authenticated;
