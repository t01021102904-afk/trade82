CREATE TYPE "MessageAttachmentFileType" AS ENUM ('image', 'pdf', 'document');
CREATE TYPE "MessageAttachmentStatus" AS ENUM ('active', 'hidden', 'restricted', 'flagged');

ALTER TABLE "Message"
ADD COLUMN "contentHash" TEXT NOT NULL DEFAULT '';

CREATE TABLE "MessageAttachment" (
  "id" TEXT NOT NULL,
  "messageId" TEXT,
  "inquiryId" TEXT NOT NULL,
  "uploadedByUserId" TEXT NOT NULL,
  "uploadedByCompanyId" TEXT NOT NULL,
  "originalFilename" TEXT NOT NULL,
  "storedFilename" TEXT NOT NULL,
  "storageBucket" TEXT NOT NULL,
  "storagePath" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "fileType" "MessageAttachmentFileType" NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "sha256Hash" TEXT NOT NULL,
  "status" "MessageAttachmentStatus" NOT NULL DEFAULT 'restricted',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MessageAttachment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MessageAttachment_storagePath_key" ON "MessageAttachment"("storagePath");
CREATE INDEX "MessageAttachment_inquiryId_createdAt_idx" ON "MessageAttachment"("inquiryId", "createdAt");
CREATE INDEX "MessageAttachment_messageId_idx" ON "MessageAttachment"("messageId");
CREATE INDEX "MessageAttachment_uploadedByUserId_createdAt_idx" ON "MessageAttachment"("uploadedByUserId", "createdAt");
CREATE INDEX "MessageAttachment_status_createdAt_idx" ON "MessageAttachment"("status", "createdAt");

ALTER TABLE "MessageAttachment"
ADD CONSTRAINT "MessageAttachment_messageId_fkey"
FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MessageAttachment"
ADD CONSTRAINT "MessageAttachment_inquiryId_fkey"
FOREIGN KEY ("inquiryId") REFERENCES "Inquiry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MessageAttachment"
ADD CONSTRAINT "MessageAttachment_uploadedByUserId_fkey"
FOREIGN KEY ("uploadedByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MessageAttachment"
ADD CONSTRAINT "MessageAttachment_uploadedByCompanyId_fkey"
FOREIGN KEY ("uploadedByCompanyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
