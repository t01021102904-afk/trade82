-- Additive integrity fields for immutable partner payout preparation and
-- idempotent audit events. Existing payout records remain unchanged.
ALTER TABLE "PartnerPayout"
  ADD COLUMN "snapshotCapturedAt" TIMESTAMP(3);

ALTER TABLE "PartnerPayoutEvent"
  ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "PartnerPayoutEvent_idempotencyKey_key"
  ON "PartnerPayoutEvent"("idempotencyKey");
