-- Add seller SKU support and server-side staging for product bulk-import previews.
ALTER TABLE "Product" ADD COLUMN "sellerSku" TEXT;

CREATE UNIQUE INDEX "Product_sellerCompanyId_sellerSku_key"
  ON "Product"("sellerCompanyId", "sellerSku");

CREATE TYPE "ProductBulkImportStatus" AS ENUM ('PREVIEWED', 'COMPLETED');
CREATE TYPE "ProductBulkImportRowStatus" AS ENUM ('VALID', 'ERROR', 'CREATED', 'UPDATED', 'SKIPPED');
CREATE TYPE "ProductBulkImportDuplicateMode" AS ENUM ('SKIP', 'UPDATE');

CREATE TABLE "ProductBulkImport" (
  "id" TEXT NOT NULL,
  "sellerCompanyId" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "sourceFilename" TEXT NOT NULL,
  "sourceFormat" TEXT NOT NULL,
  "duplicateMode" "ProductBulkImportDuplicateMode" NOT NULL DEFAULT 'SKIP',
  "status" "ProductBulkImportStatus" NOT NULL DEFAULT 'PREVIEWED',
  "committedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProductBulkImport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductBulkImportRow" (
  "id" TEXT NOT NULL,
  "importId" TEXT NOT NULL,
  "rowNumber" INTEGER NOT NULL,
  "sellerSku" TEXT NOT NULL,
  "productName" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "rawData" JSONB NOT NULL,
  "normalizedData" JSONB,
  "status" "ProductBulkImportRowStatus" NOT NULL,
  "errorMessages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "resultProductId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProductBulkImportRow_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductBulkImportRow_importId_rowNumber_key"
  ON "ProductBulkImportRow"("importId", "rowNumber");
CREATE INDEX "ProductBulkImport_sellerCompanyId_createdAt_idx"
  ON "ProductBulkImport"("sellerCompanyId", "createdAt");
CREATE INDEX "ProductBulkImport_createdByUserId_createdAt_idx"
  ON "ProductBulkImport"("createdByUserId", "createdAt");
CREATE INDEX "ProductBulkImportRow_importId_status_idx"
  ON "ProductBulkImportRow"("importId", "status");
CREATE INDEX "ProductBulkImportRow_resultProductId_idx"
  ON "ProductBulkImportRow"("resultProductId");

ALTER TABLE "ProductBulkImport"
  ADD CONSTRAINT "ProductBulkImport_sellerCompanyId_fkey"
  FOREIGN KEY ("sellerCompanyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductBulkImport"
  ADD CONSTRAINT "ProductBulkImport_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductBulkImportRow"
  ADD CONSTRAINT "ProductBulkImportRow_importId_fkey"
  FOREIGN KEY ("importId") REFERENCES "ProductBulkImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductBulkImport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProductBulkImportRow" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "ProductBulkImport" FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE "ProductBulkImportRow" FROM anon, authenticated;
