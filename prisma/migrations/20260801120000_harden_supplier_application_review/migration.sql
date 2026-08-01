-- Additive hardening for staged Supplier Application rollout.
ALTER TABLE "SupplierApplication"
  ADD COLUMN "riskOverrideReason" TEXT,
  ADD COLUMN "riskOverrideByUserId" TEXT;

ALTER TABLE "SupplierBrandVerification"
  ADD COLUMN "normalizedBrand" TEXT,
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "removedAt" TIMESTAMP(3);

UPDATE "SupplierBrandVerification"
SET "normalizedBrand" = lower(regexp_replace(trim("brand"), '\s+', ' ', 'g'));

-- Historical rows may contain case/whitespace variants. Keep the earliest row
-- active and retain later evidence rows as inactive provenance records while
-- giving them collision-safe internal normalized keys.
WITH ranked AS (
  SELECT
    "id",
    row_number() OVER (
      PARTITION BY "applicationId", "normalizedBrand"
      ORDER BY "createdAt", "id"
    ) AS duplicate_rank
  FROM "SupplierBrandVerification"
)
UPDATE "SupplierBrandVerification" AS brand
SET
  "normalizedBrand" = brand."normalizedBrand" || '__duplicate__' || brand."id",
  "isActive" = false,
  "removedAt" = COALESCE(brand."removedAt", NOW())
FROM ranked
WHERE ranked."id" = brand."id" AND ranked.duplicate_rank > 1;

ALTER TABLE "SupplierBrandVerification"
  ALTER COLUMN "normalizedBrand" SET NOT NULL;

ALTER TABLE "SupplierInformationRequest"
  ADD COLUMN "applicantResponse" TEXT,
  ADD COLUMN "respondedAt" TIMESTAMP(3),
  ADD COLUMN "resolvedByUserId" TEXT,
  ADD COLUMN "resolutionNote" TEXT;

ALTER TABLE "SupplierDuplicateFlag"
  ADD COLUMN "severity" TEXT NOT NULL DEFAULT 'REVIEW';

DROP INDEX IF EXISTS "SupplierBrandVerification_applicationId_brand_key";

CREATE UNIQUE INDEX "SupplierBrandVerification_applicationId_normalizedBrand_key"
  ON "SupplierBrandVerification"("applicationId", "normalizedBrand");
CREATE INDEX "SupplierBrandVerification_applicationId_isActive_status_idx"
  ON "SupplierBrandVerification"("applicationId", "isActive", "status");
CREATE INDEX "SupplierInformationRequest_resolvedByUserId_idx"
  ON "SupplierInformationRequest"("resolvedByUserId");
CREATE INDEX "SupplierApplication_riskOverrideByUserId_idx"
  ON "SupplierApplication"("riskOverrideByUserId");

ALTER TABLE "SupplierApplication"
  ADD CONSTRAINT "SupplierApplication_riskOverrideByUserId_fkey"
  FOREIGN KEY ("riskOverrideByUserId") REFERENCES "UserProfile"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupplierInformationRequest"
  ADD CONSTRAINT "SupplierInformationRequest_resolvedByUserId_fkey"
  FOREIGN KEY ("resolvedByUserId") REFERENCES "UserProfile"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupplierBrandVerification"
  ADD CONSTRAINT "SupplierBrandVerification_normalizedBrand_nonempty_check"
  CHECK (length(trim("normalizedBrand")) > 0);

ALTER TABLE "SupplierDuplicateFlag"
  ADD CONSTRAINT "SupplierDuplicateFlag_severity_check"
  CHECK ("severity" IN ('REVIEW', 'CRITICAL'));
