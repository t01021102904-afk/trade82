-- CreateEnum
CREATE TYPE "TradeOrderStatus" AS ENUM ('PAYMENT_PENDING', 'PAID', 'PROCESSING', 'READY_TO_SHIP', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'REFUNDED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "OrderPaymentStatus" AS ENUM ('UNPAID', 'PENDING', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'FAILED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "OrderShipmentStatus" AS ENUM ('NOT_READY', 'READY', 'BOOKED', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'EXCEPTION', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OrderPayoutStatus" AS ENUM ('NOT_READY', 'HOLD', 'READY', 'PROCESSING', 'SENT', 'FAILED', 'RETURNED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Incoterm" AS ENUM ('EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP', 'OTHER');

-- CreateEnum
CREATE TYPE "ShippingMethod" AS ENUM ('OCEAN', 'AIR', 'EXPRESS', 'POSTAL', 'TRUCK', 'COURIER', 'OTHER');

-- CreateEnum
CREATE TYPE "SellerPayoutProfileStatus" AS ENUM ('DRAFT', 'PENDING_VERIFICATION', 'VERIFIED', 'REJECTED', 'DISABLED');

-- CreateEnum
CREATE TYPE "PayoutAccountType" AS ENUM ('LOCAL', 'FOREIGN_CURRENCY', 'IBAN', 'OTHER');

-- CreateEnum
CREATE TYPE "SellerPayoutStatus" AS ENUM ('NOT_READY', 'HOLD', 'READY', 'PROCESSING', 'SENT', 'FAILED', 'RETURNED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WireFeeBearer" AS ENUM ('OUR', 'SHA', 'BEN', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "TradeOrderEventType" AS ENUM ('ORDER_CREATED', 'PAYMENT_REQUESTED', 'CHECKOUT_STARTED', 'PAYMENT_PAID', 'PAYMENT_FAILED', 'REFUND_CREATED', 'REFUND_COMPLETED', 'DISPUTE_OPENED', 'DISPUTE_CLOSED', 'PROCESSING_STARTED', 'SHIPMENT_UPDATED', 'SHIPPED', 'DELIVERED', 'PAYOUT_HOLD', 'PAYOUT_READY', 'PAYOUT_PROCESSING', 'PAYOUT_SENT', 'PAYOUT_FAILED', 'ORDER_CANCELLED', 'ORDER_COMPLETED', 'ADMIN_NOTE');

-- CreateEnum
CREATE TYPE "SellerPayoutEventType" AS ENUM ('CREATED', 'ELIGIBILITY_CHECKED', 'READY', 'HOLD', 'PROCESSING', 'SENT', 'FAILED', 'RETURNED', 'CANCELLED', 'BANK_DETAILS_REVEALED', 'INSTRUCTIONS_EXPORTED', 'ADJUSTMENT_ADDED');

-- CreateEnum
CREATE TYPE "SellerPayoutAdjustmentType" AS ENUM ('CREDIT', 'DEBIT', 'REFUND_RECOVERY', 'BANK_FEE', 'FX_ADJUSTMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "BankDirectorySourceType" AS ENUM ('SEED', 'ADMIN', 'ADMIN_OVERRIDE');

-- AlterTable
ALTER TABLE "PaymentRequest" ADD COLUMN     "orderId" TEXT;

-- CreateTable
CREATE TABLE "OrderNumberCounter" (
    "year" INTEGER NOT NULL,
    "lastOrderSequence" INTEGER NOT NULL DEFAULT 0,
    "lastPayoutSequence" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderNumberCounter_pkey" PRIMARY KEY ("year")
);

-- CreateTable
CREATE TABLE "TradeOrder" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "inquiryId" TEXT NOT NULL,
    "paymentRequestId" TEXT NOT NULL,
    "buyerCompanyId" TEXT NOT NULL,
    "sellerCompanyId" TEXT NOT NULL,
    "orderStatus" "TradeOrderStatus" NOT NULL DEFAULT 'PAYMENT_PENDING',
    "paymentStatus" "OrderPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "shipmentStatus" "OrderShipmentStatus" NOT NULL DEFAULT 'NOT_READY',
    "payoutStatus" "OrderPayoutStatus" NOT NULL DEFAULT 'NOT_READY',
    "buyerCompanyName" TEXT NOT NULL,
    "buyerContactName" TEXT,
    "buyerEmail" TEXT NOT NULL,
    "buyerPhone" TEXT,
    "buyerCountry" TEXT NOT NULL,
    "buyerAddress" TEXT,
    "sellerCompanyName" TEXT NOT NULL,
    "sellerContactName" TEXT,
    "sellerEmail" TEXT NOT NULL,
    "sellerPhone" TEXT,
    "sellerCountry" TEXT NOT NULL,
    "sellerAddress" TEXT,
    "productAmount" INTEGER NOT NULL,
    "shippingAmount" INTEGER NOT NULL,
    "grossAmount" INTEGER NOT NULL,
    "platformFeeRateBps" INTEGER NOT NULL DEFAULT 500,
    "platformFeeAmount" INTEGER NOT NULL,
    "sellerPayableAmount" INTEGER NOT NULL,
    "stripeProcessingFeeAmount" INTEGER,
    "refundAmount" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "paidAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "disputedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradeOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeOrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "sku" TEXT,
    "hsCode" TEXT,
    "countryOfOrigin" TEXT,
    "quantity" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "unitPrice" INTEGER,
    "productAmount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "productSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradeOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeOrderShipment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "incoterm" "Incoterm" NOT NULL DEFAULT 'OTHER',
    "shippingMethod" "ShippingMethod" NOT NULL DEFAULT 'OTHER',
    "originCountry" TEXT NOT NULL,
    "originCity" TEXT,
    "destinationCountry" TEXT NOT NULL,
    "destinationCity" TEXT,
    "destinationAddress" TEXT,
    "carrierName" TEXT,
    "freightForwarderName" TEXT,
    "trackingNumber" TEXT,
    "billOfLadingNumber" TEXT,
    "airWaybillNumber" TEXT,
    "shipmentReference" TEXT,
    "shipDate" TIMESTAMP(3),
    "estimatedArrivalDate" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "shipmentStatus" "OrderShipmentStatus" NOT NULL DEFAULT 'NOT_READY',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradeOrderShipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeOrderEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "eventType" "TradeOrderEventType" NOT NULL,
    "message" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TradeOrderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankDirectory" (
    "id" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "bankNameLocal" TEXT NOT NULL,
    "bankNameEnglish" TEXT NOT NULL,
    "bankCode" TEXT,
    "defaultSwiftBic" TEXT,
    "defaultBankAddress" TEXT,
    "officialWebsite" TEXT,
    "sourceUrl" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "sourceType" "BankDirectorySourceType" NOT NULL DEFAULT 'ADMIN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankDirectory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SellerPayoutProfile" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "bankDirectoryId" TEXT,
    "country" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "branchName" TEXT,
    "accountHolder" TEXT NOT NULL,
    "accountNumberCiphertext" BYTEA,
    "accountNumberIv" BYTEA,
    "accountNumberAuthTag" BYTEA,
    "accountNumberKeyVersion" TEXT,
    "accountNumberLast4" TEXT,
    "accountNumberMasked" TEXT,
    "accountType" "PayoutAccountType" NOT NULL DEFAULT 'LOCAL',
    "bankCode" TEXT,
    "swiftBic" TEXT,
    "bankAddress" TEXT,
    "beneficiaryAddress" TEXT,
    "payoutCurrency" TEXT NOT NULL DEFAULT 'usd',
    "supportedCurrencies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "intermediaryBankName" TEXT,
    "intermediaryBankSwift" TEXT,
    "intermediaryBankAddress" TEXT,
    "payoutMemo" TEXT,
    "accountBelongsToCompany" BOOLEAN NOT NULL DEFAULT false,
    "manualBankOverride" BOOLEAN NOT NULL DEFAULT false,
    "manualOverrideReason" TEXT,
    "status" "SellerPayoutProfileStatus" NOT NULL DEFAULT 'DRAFT',
    "verifiedAt" TIMESTAMP(3),
    "verifiedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SellerPayoutProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SellerPayoutProfileAuditEvent" (
    "id" TEXT NOT NULL,
    "payoutProfileId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SellerPayoutProfileAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SellerPayout" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "sellerCompanyId" TEXT NOT NULL,
    "payoutProfileId" TEXT NOT NULL,
    "payoutNumber" TEXT NOT NULL,
    "status" "SellerPayoutStatus" NOT NULL DEFAULT 'READY',
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "grossAmount" INTEGER NOT NULL,
    "platformFeeRateBps" INTEGER NOT NULL DEFAULT 500,
    "platformFeeAmount" INTEGER NOT NULL,
    "sellerPayableAmount" INTEGER NOT NULL,
    "refundAdjustmentAmount" INTEGER NOT NULL DEFAULT 0,
    "manualAdjustmentAmount" INTEGER NOT NULL DEFAULT 0,
    "finalPayoutAmount" INTEGER NOT NULL,
    "processingFeeAmount" INTEGER,
    "exchangeRate" DECIMAL(20,8),
    "settlementCurrency" TEXT,
    "settlementAmount" INTEGER,
    "wireFeeBearer" "WireFeeBearer" NOT NULL DEFAULT 'NOT_APPLICABLE',
    "beneficiarySnapshotEncrypted" BYTEA NOT NULL,
    "beneficiarySnapshotIv" BYTEA NOT NULL,
    "beneficiarySnapshotAuthTag" BYTEA NOT NULL,
    "beneficiarySnapshotKeyVersion" TEXT NOT NULL,
    "accountNumberLast4" TEXT,
    "bankNameSnapshot" TEXT NOT NULL,
    "swiftBicSnapshot" TEXT,
    "officialBankWebsiteSnapshot" TEXT,
    "preparedAt" TIMESTAMP(3),
    "preparedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "sentAt" TIMESTAMP(3),
    "sentByUserId" TEXT,
    "failedAt" TIMESTAMP(3),
    "externalTransferReference" TEXT,
    "externalBankReference" TEXT,
    "payoutProofStoragePath" TEXT,
    "failureReason" TEXT,
    "internalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SellerPayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SellerPayoutEvent" (
    "id" TEXT NOT NULL,
    "payoutId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "eventType" "SellerPayoutEventType" NOT NULL,
    "message" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SellerPayoutEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SellerPayoutAdjustment" (
    "id" TEXT NOT NULL,
    "payoutId" TEXT NOT NULL,
    "adjustmentType" "SellerPayoutAdjustmentType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "reason" TEXT NOT NULL,
    "internalNote" TEXT,
    "requiresManualReconciliation" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SellerPayoutAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TradeOrder_orderNumber_key" ON "TradeOrder"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "TradeOrder_paymentRequestId_key" ON "TradeOrder"("paymentRequestId");

-- CreateIndex
CREATE INDEX "TradeOrder_buyerCompanyId_createdAt_idx" ON "TradeOrder"("buyerCompanyId", "createdAt");

-- CreateIndex
CREATE INDEX "TradeOrder_sellerCompanyId_createdAt_idx" ON "TradeOrder"("sellerCompanyId", "createdAt");

-- CreateIndex
CREATE INDEX "TradeOrder_orderStatus_createdAt_idx" ON "TradeOrder"("orderStatus", "createdAt");

-- CreateIndex
CREATE INDEX "TradeOrder_paymentStatus_createdAt_idx" ON "TradeOrder"("paymentStatus", "createdAt");

-- CreateIndex
CREATE INDEX "TradeOrder_payoutStatus_createdAt_idx" ON "TradeOrder"("payoutStatus", "createdAt");

-- CreateIndex
CREATE INDEX "TradeOrderItem_orderId_createdAt_idx" ON "TradeOrderItem"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "TradeOrderItem_productId_idx" ON "TradeOrderItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "TradeOrderShipment_orderId_key" ON "TradeOrderShipment"("orderId");

-- CreateIndex
CREATE INDEX "TradeOrderShipment_shipmentStatus_updatedAt_idx" ON "TradeOrderShipment"("shipmentStatus", "updatedAt");

-- CreateIndex
CREATE INDEX "TradeOrderShipment_destinationCountry_idx" ON "TradeOrderShipment"("destinationCountry");

-- CreateIndex
CREATE INDEX "TradeOrderEvent_orderId_createdAt_idx" ON "TradeOrderEvent"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "TradeOrderEvent_eventType_createdAt_idx" ON "TradeOrderEvent"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "BankDirectory_countryCode_isActive_idx" ON "BankDirectory"("countryCode", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "BankDirectory_countryCode_bankNameEnglish_key" ON "BankDirectory"("countryCode", "bankNameEnglish");

-- CreateIndex
CREATE UNIQUE INDEX "SellerPayoutProfile_companyId_key" ON "SellerPayoutProfile"("companyId");

-- CreateIndex
CREATE INDEX "SellerPayoutProfile_status_updatedAt_idx" ON "SellerPayoutProfile"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "SellerPayoutProfile_bankDirectoryId_idx" ON "SellerPayoutProfile"("bankDirectoryId");

-- CreateIndex
CREATE INDEX "SellerPayoutProfileAuditEvent_payoutProfileId_createdAt_idx" ON "SellerPayoutProfileAuditEvent"("payoutProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "SellerPayoutProfileAuditEvent_actorUserId_createdAt_idx" ON "SellerPayoutProfileAuditEvent"("actorUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SellerPayout_orderId_key" ON "SellerPayout"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "SellerPayout_payoutNumber_key" ON "SellerPayout"("payoutNumber");

-- CreateIndex
CREATE INDEX "SellerPayout_sellerCompanyId_createdAt_idx" ON "SellerPayout"("sellerCompanyId", "createdAt");

-- CreateIndex
CREATE INDEX "SellerPayout_status_createdAt_idx" ON "SellerPayout"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SellerPayout_payoutProfileId_idx" ON "SellerPayout"("payoutProfileId");

-- CreateIndex
CREATE INDEX "SellerPayoutEvent_payoutId_createdAt_idx" ON "SellerPayoutEvent"("payoutId", "createdAt");

-- CreateIndex
CREATE INDEX "SellerPayoutEvent_eventType_createdAt_idx" ON "SellerPayoutEvent"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "SellerPayoutAdjustment_payoutId_createdAt_idx" ON "SellerPayoutAdjustment"("payoutId", "createdAt");

-- CreateIndex
CREATE INDEX "SellerPayoutAdjustment_createdByUserId_createdAt_idx" ON "SellerPayoutAdjustment"("createdByUserId", "createdAt");

-- Payout adjustments are an append-only accounting ledger. Application code
-- creates them only through the audited admin workflow; PostgreSQL rejects any
-- later rewrite or removal, including accidental privileged ORM mutations.
CREATE FUNCTION "preventSellerPayoutAdjustmentMutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'SellerPayoutAdjustment records are immutable';
END;
$$;

CREATE TRIGGER "SellerPayoutAdjustment_immutable"
BEFORE UPDATE OR DELETE ON "SellerPayoutAdjustment"
FOR EACH ROW
EXECUTE FUNCTION "preventSellerPayoutAdjustmentMutation"();

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRequest_orderId_key" ON "PaymentRequest"("orderId");

-- AddForeignKey
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "TradeOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeOrder" ADD CONSTRAINT "TradeOrder_inquiryId_fkey" FOREIGN KEY ("inquiryId") REFERENCES "Inquiry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeOrder" ADD CONSTRAINT "TradeOrder_paymentRequestId_fkey" FOREIGN KEY ("paymentRequestId") REFERENCES "PaymentRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeOrder" ADD CONSTRAINT "TradeOrder_buyerCompanyId_fkey" FOREIGN KEY ("buyerCompanyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeOrder" ADD CONSTRAINT "TradeOrder_sellerCompanyId_fkey" FOREIGN KEY ("sellerCompanyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeOrderItem" ADD CONSTRAINT "TradeOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "TradeOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeOrderItem" ADD CONSTRAINT "TradeOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeOrderShipment" ADD CONSTRAINT "TradeOrderShipment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "TradeOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeOrderEvent" ADD CONSTRAINT "TradeOrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "TradeOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeOrderEvent" ADD CONSTRAINT "TradeOrderEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerPayoutProfile" ADD CONSTRAINT "SellerPayoutProfile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerPayoutProfile" ADD CONSTRAINT "SellerPayoutProfile_bankDirectoryId_fkey" FOREIGN KEY ("bankDirectoryId") REFERENCES "BankDirectory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerPayoutProfile" ADD CONSTRAINT "SellerPayoutProfile_verifiedByUserId_fkey" FOREIGN KEY ("verifiedByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerPayoutProfileAuditEvent" ADD CONSTRAINT "SellerPayoutProfileAuditEvent_payoutProfileId_fkey" FOREIGN KEY ("payoutProfileId") REFERENCES "SellerPayoutProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerPayoutProfileAuditEvent" ADD CONSTRAINT "SellerPayoutProfileAuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerPayout" ADD CONSTRAINT "SellerPayout_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "TradeOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerPayout" ADD CONSTRAINT "SellerPayout_sellerCompanyId_fkey" FOREIGN KEY ("sellerCompanyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerPayout" ADD CONSTRAINT "SellerPayout_payoutProfileId_fkey" FOREIGN KEY ("payoutProfileId") REFERENCES "SellerPayoutProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerPayout" ADD CONSTRAINT "SellerPayout_preparedByUserId_fkey" FOREIGN KEY ("preparedByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerPayout" ADD CONSTRAINT "SellerPayout_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerPayout" ADD CONSTRAINT "SellerPayout_sentByUserId_fkey" FOREIGN KEY ("sentByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerPayoutEvent" ADD CONSTRAINT "SellerPayoutEvent_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "SellerPayout"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerPayoutEvent" ADD CONSTRAINT "SellerPayoutEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerPayoutAdjustment" ADD CONSTRAINT "SellerPayoutAdjustment_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "SellerPayout"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerPayoutAdjustment" ADD CONSTRAINT "SellerPayoutAdjustment_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Supabase exposes the public schema through its Data API. Financial order and
-- payout tables are accessed exclusively through authenticated server routes
-- using Prisma, so deny direct anon/authenticated access by default. The table
-- owner used by Prisma retains server-side access; no permissive RLS policy is
-- introduced for browser clients.
ALTER TABLE "OrderNumberCounter" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TradeOrder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TradeOrderItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TradeOrderShipment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TradeOrderEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BankDirectory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SellerPayoutProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SellerPayoutProfileAuditEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SellerPayout" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SellerPayoutEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SellerPayoutAdjustment" ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE "OrderNumberCounter" FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE "TradeOrder" FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE "TradeOrderItem" FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE "TradeOrderShipment" FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE "TradeOrderEvent" FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE "BankDirectory" FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE "SellerPayoutProfile" FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE "SellerPayoutProfileAuditEvent" FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE "SellerPayout" FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE "SellerPayoutEvent" FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE "SellerPayoutAdjustment" FROM anon, authenticated;
