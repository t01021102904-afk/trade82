-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('company', 'product', 'compliance', 'shipping', 'contracts', 'shared_with_buyer');

-- CreateEnum
CREATE TYPE "DocumentVisibilityStatus" AS ENUM ('private', 'internal_review', 'shared_with_buyer');

-- AlterTable
ALTER TABLE "Product" ALTER COLUMN "field_visibility" SET DEFAULT '{}';

-- CreateTable
CREATE TABLE "document_folders" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "DocumentCategory" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trade_documents" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "uploaded_by_user_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_type" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "storage_bucket" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "category" "DocumentCategory" NOT NULL,
    "folder_id" TEXT,
    "visibility_status" "DocumentVisibilityStatus" NOT NULL DEFAULT 'private',
    "shared_buyer_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trade_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_folders_company_id_category_idx" ON "document_folders"("company_id", "category");

-- CreateIndex
CREATE UNIQUE INDEX "document_folders_company_id_category_name_key" ON "document_folders"("company_id", "category", "name");

-- CreateIndex
CREATE UNIQUE INDEX "trade_documents_storage_path_key" ON "trade_documents"("storage_path");

-- CreateIndex
CREATE INDEX "trade_documents_company_id_category_created_at_idx" ON "trade_documents"("company_id", "category", "created_at");

-- CreateIndex
CREATE INDEX "trade_documents_uploaded_by_user_id_created_at_idx" ON "trade_documents"("uploaded_by_user_id", "created_at");

-- CreateIndex
CREATE INDEX "trade_documents_folder_id_idx" ON "trade_documents"("folder_id");

-- CreateIndex
CREATE INDEX "trade_documents_shared_buyer_id_idx" ON "trade_documents"("shared_buyer_id");

-- AddForeignKey
ALTER TABLE "document_folders" ADD CONSTRAINT "document_folders_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_folders" ADD CONSTRAINT "document_folders_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_documents" ADD CONSTRAINT "trade_documents_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_documents" ADD CONSTRAINT "trade_documents_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_documents" ADD CONSTRAINT "trade_documents_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "document_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_documents" ADD CONSTRAINT "trade_documents_shared_buyer_id_fkey" FOREIGN KEY ("shared_buyer_id") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
