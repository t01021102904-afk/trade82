CREATE TYPE "HomepagePromotionMediaType" AS ENUM ('IMAGE', 'PDF');

CREATE TABLE "HomepagePromotion" (
  "id" TEXT NOT NULL,
  "adminTitle" TEXT NOT NULL,
  "altTextEn" TEXT NOT NULL,
  "altTextKo" TEXT NOT NULL,
  "mediaType" "HomepagePromotionMediaType" NOT NULL,
  "thumbnailUrl" TEXT NOT NULL,
  "thumbnailStoragePath" TEXT NOT NULL,
  "pdfUrl" TEXT,
  "pdfStoragePath" TEXT,
  "destinationUrl" TEXT,
  "openInNewTab" BOOLEAN NOT NULL DEFAULT false,
  "displayOrder" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "createdByUserId" TEXT NOT NULL,
  "pendingStorageCleanupPaths" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "HomepagePromotion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HomepagePromotion_displayOrder_check" CHECK ("displayOrder" >= 0),
  CONSTRAINT "HomepagePromotion_schedule_check" CHECK (
    "startsAt" IS NULL OR "endsAt" IS NULL OR "endsAt" > "startsAt"
  ),
  CONSTRAINT "HomepagePromotion_pdf_fields_check" CHECK (
    ("mediaType" = 'IMAGE' AND "pdfUrl" IS NULL AND "pdfStoragePath" IS NULL)
    OR
    ("mediaType" = 'PDF' AND "pdfUrl" IS NOT NULL AND "pdfStoragePath" IS NOT NULL)
  )
);

CREATE INDEX "HomepagePromotion_isActive_deletedAt_startsAt_endsAt_displayOrder_idx"
  ON "HomepagePromotion"("isActive", "deletedAt", "startsAt", "endsAt", "displayOrder");

CREATE INDEX "HomepagePromotion_createdByUserId_createdAt_idx"
  ON "HomepagePromotion"("createdByUserId", "createdAt");

ALTER TABLE "HomepagePromotion"
  ADD CONSTRAINT "HomepagePromotion_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "HomepagePromotion" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "HomepagePromotion" FROM anon, authenticated;
