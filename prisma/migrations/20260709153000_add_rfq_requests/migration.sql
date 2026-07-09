-- CreateEnum
CREATE TYPE "RfqStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'MATCHING_READY', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RfqAdminStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "RfqRequest" (
    "id" TEXT NOT NULL,
    "buyerUserId" TEXT NOT NULL,
    "buyerCompanyId" TEXT,
    "productName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "sourcingType" TEXT NOT NULL,
    "sourcingPurpose" TEXT,
    "quantity" TEXT NOT NULL,
    "tradeTerms" TEXT NOT NULL,
    "destinationCountry" TEXT,
    "preferredUnitPriceAmount" DECIMAL(14,2),
    "preferredUnitPriceCurrency" TEXT,
    "shape" TEXT,
    "capacity" TEXT,
    "material" TEXT,
    "certification" TEXT,
    "feature" TEXT,
    "targetDeliveryDate" TIMESTAMP(3),
    "details" TEXT NOT NULL,
    "status" "RfqStatus" NOT NULL DEFAULT 'SUBMITTED',
    "adminStatus" "RfqAdminStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "adminNote" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RfqRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RfqRequest_buyerUserId_createdAt_idx" ON "RfqRequest"("buyerUserId", "createdAt");

-- CreateIndex
CREATE INDEX "RfqRequest_buyerCompanyId_createdAt_idx" ON "RfqRequest"("buyerCompanyId", "createdAt");

-- CreateIndex
CREATE INDEX "RfqRequest_status_createdAt_idx" ON "RfqRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "RfqRequest_adminStatus_createdAt_idx" ON "RfqRequest"("adminStatus", "createdAt");

-- AddForeignKey
ALTER TABLE "RfqRequest" ADD CONSTRAINT "RfqRequest_buyerUserId_fkey" FOREIGN KEY ("buyerUserId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqRequest" ADD CONSTRAINT "RfqRequest_buyerCompanyId_fkey" FOREIGN KEY ("buyerCompanyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqRequest" ADD CONSTRAINT "RfqRequest_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
