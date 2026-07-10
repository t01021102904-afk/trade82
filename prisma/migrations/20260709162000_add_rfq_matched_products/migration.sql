-- CreateTable
CREATE TABLE "RfqMatchedProduct" (
    "id" TEXT NOT NULL,
    "rfqRequestId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "reasons" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RfqMatchedProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RfqMatchedProduct_rfqRequestId_productId_key" ON "RfqMatchedProduct"("rfqRequestId", "productId");

-- CreateIndex
CREATE INDEX "RfqMatchedProduct_rfqRequestId_rank_idx" ON "RfqMatchedProduct"("rfqRequestId", "rank");

-- CreateIndex
CREATE INDEX "RfqMatchedProduct_productId_idx" ON "RfqMatchedProduct"("productId");

-- AddForeignKey
ALTER TABLE "RfqMatchedProduct" ADD CONSTRAINT "RfqMatchedProduct_rfqRequestId_fkey" FOREIGN KEY ("rfqRequestId") REFERENCES "RfqRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqMatchedProduct" ADD CONSTRAINT "RfqMatchedProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
