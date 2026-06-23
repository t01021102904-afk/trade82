ALTER TABLE "VerificationRequest"
ADD COLUMN "documentPath" TEXT;

ALTER TABLE "Deal"
ADD COLUMN "contractFilePath" TEXT,
ADD COLUMN "contractFileName" TEXT;
