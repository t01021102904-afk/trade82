-- CreateEnum
CREATE TYPE "RfqSellerQuoteStatus" AS ENUM ('REQUESTED', 'SUBMITTED', 'DECLINED', 'NEGOTIATING', 'ACCEPTED', 'CLOSED');

-- CreateTable
CREATE TABLE "RfqSellerQuote" (
    "id" TEXT NOT NULL,
    "rfqRequestId" TEXT NOT NULL,
    "sellerCompanyId" TEXT NOT NULL,
    "productId" TEXT,
    "conversationId" TEXT,
    "status" "RfqSellerQuoteStatus" NOT NULL DEFAULT 'REQUESTED',
    "unitPriceAmount" DECIMAL(14,2),
    "unitPriceCurrency" TEXT,
    "moq" TEXT,
    "leadTime" TEXT,
    "incoterms" TEXT,
    "sampleAvailable" BOOLEAN,
    "privateLabelAvailable" BOOLEAN,
    "notes" TEXT,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RfqSellerQuote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RfqSellerQuote_rfqRequestId_sellerCompanyId_key" ON "RfqSellerQuote"("rfqRequestId", "sellerCompanyId");

-- CreateIndex
CREATE INDEX "RfqSellerQuote_rfqRequestId_status_idx" ON "RfqSellerQuote"("rfqRequestId", "status");

-- CreateIndex
CREATE INDEX "RfqSellerQuote_sellerCompanyId_createdAt_idx" ON "RfqSellerQuote"("sellerCompanyId", "createdAt");

-- CreateIndex
CREATE INDEX "RfqSellerQuote_productId_idx" ON "RfqSellerQuote"("productId");

-- CreateIndex
CREATE INDEX "RfqSellerQuote_conversationId_idx" ON "RfqSellerQuote"("conversationId");

-- AddForeignKey
ALTER TABLE "RfqSellerQuote" ADD CONSTRAINT "RfqSellerQuote_rfqRequestId_fkey" FOREIGN KEY ("rfqRequestId") REFERENCES "RfqRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqSellerQuote" ADD CONSTRAINT "RfqSellerQuote_sellerCompanyId_fkey" FOREIGN KEY ("sellerCompanyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqSellerQuote" ADD CONSTRAINT "RfqSellerQuote_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqSellerQuote" ADD CONSTRAINT "RfqSellerQuote_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Inquiry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
