-- Account deletion is a lifecycle, not a physical deletion. Financial records
-- retain restrictive foreign keys for audit, while application identities and
-- public content are tombstoned only after Clerk deletion is confirmed.

CREATE TYPE "AccountDeletionStatus" AS ENUM ('ACTIVE', 'DELETION_PENDING', 'DELETED');

ALTER TABLE "UserProfile"
  ADD COLUMN "deletionStatus" "AccountDeletionStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "deletionRequestedAt" TIMESTAMP(3),
  ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "Company"
  ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "Product"
  ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "PartnerProfile"
  ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "UserProfile"
  ADD CONSTRAINT "UserProfile_deletion_lifecycle_check"
  CHECK (
    ("deletionStatus" = 'ACTIVE' AND "deletedAt" IS NULL)
    OR ("deletionStatus" = 'DELETION_PENDING' AND "deletionRequestedAt" IS NOT NULL AND "deletedAt" IS NULL)
    OR ("deletionStatus" = 'DELETED' AND "deletionRequestedAt" IS NOT NULL AND "deletedAt" IS NOT NULL)
  );

CREATE INDEX "UserProfile_deletionStatus_deletedAt_idx"
  ON "UserProfile"("deletionStatus", "deletedAt");
CREATE INDEX "Company_deletedAt_companyRole_verificationStatus_idx"
  ON "Company"("deletedAt", "companyRole", "verificationStatus");
CREATE INDEX "Product_deletedAt_sellerCompanyId_status_idx"
  ON "Product"("deletedAt", "sellerCompanyId", "status");
CREATE INDEX "PartnerProfile_deletedAt_status_idx"
  ON "PartnerProfile"("deletedAt", "status");
