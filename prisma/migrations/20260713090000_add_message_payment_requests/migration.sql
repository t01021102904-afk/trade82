-- Phase 1 message payment requests. This migration is intentionally not applied by this change.
CREATE TYPE "PaymentRequestStatus" AS ENUM (
  'PENDING',
  'PAID',
  'RELEASED',
  'CANCELLED',
  'PARTIALLY_REFUNDED',
  'REFUNDED',
  'DISPUTED'
);

CREATE TYPE "PaymentRequestEventType" AS ENUM (
  'CREATED',
  'CHECKOUT_STARTED',
  'PAID',
  'RELEASED',
  'CANCELLED',
  'PARTIALLY_REFUNDED',
  'REFUNDED',
  'DISPUTE_OPENED',
  'DISPUTE_UPDATED',
  'DISPUTE_CLOSED',
  'RECONCILIATION_REQUIRED'
);

CREATE TYPE "StripeFeeSyncStatus" AS ENUM ('PENDING', 'SYNCED', 'FAILED');

CREATE TABLE "PaymentRequest" (
  "id" TEXT NOT NULL,
  "inquiryId" TEXT NOT NULL,
  "buyerCompanyId" TEXT NOT NULL,
  "sellerCompanyId" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "productName" TEXT NOT NULL,
  "quantity" TEXT NOT NULL,
  "unit" TEXT NOT NULL,
  "productAmount" INTEGER NOT NULL,
  "shippingAmount" INTEGER NOT NULL,
  "grossAmount" INTEGER NOT NULL,
  "platformFeeAmount" INTEGER NOT NULL,
  "sellerPayableAmount" INTEGER NOT NULL,
  "stripeProcessingFeeAmount" INTEGER,
  "stripeFeeSyncStatus" "StripeFeeSyncStatus" NOT NULL DEFAULT 'PENDING',
  "stripeFeeSyncError" TEXT,
  "stripeFeeSyncedAt" TIMESTAMP(3),
  "refundAmount" INTEGER NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'usd',
  "paymentDueDate" TIMESTAMP(3) NOT NULL,
  "orderTerms" TEXT NOT NULL,
  "status" "PaymentRequestStatus" NOT NULL DEFAULT 'PENDING',
  "stripeCheckoutSessionId" TEXT,
  "stripePaymentIntentId" TEXT,
  "stripeChargeId" TEXT,
  "checkoutAttempt" INTEGER NOT NULL DEFAULT 0,
  "checkoutLockToken" TEXT,
  "checkoutLockExpiresAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "releasedAt" TIMESTAMP(3),
  "manualPayoutReference" TEXT,
  "manualPayoutDate" TIMESTAMP(3),
  "manualPayoutNote" TEXT,
  "sellerReleasedAmount" INTEGER,
  "releasedByUserId" TEXT,
  "requiresManualReconciliation" BOOLEAN NOT NULL DEFAULT false,
  "reconciliationNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PaymentRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentRequestEvent" (
  "id" TEXT NOT NULL,
  "paymentRequestId" TEXT NOT NULL,
  "eventType" "PaymentRequestEventType" NOT NULL,
  "actorUserId" TEXT,
  "stripeEventId" TEXT,
  "message" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PaymentRequestEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentRequestWebhookEvent" (
  "id" TEXT NOT NULL,
  "paymentRequestId" TEXT NOT NULL,
  "stripeEventId" TEXT NOT NULL,
  "stripeEventType" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PaymentRequestWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentRefund" (
  "id" TEXT NOT NULL,
  "paymentRequestId" TEXT NOT NULL,
  "stripeRefundId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "status" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PaymentRefund_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentDispute" (
  "id" TEXT NOT NULL,
  "paymentRequestId" TEXT NOT NULL,
  "stripeDisputeId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "status" TEXT NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PaymentDispute_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentRequest_stripeCheckoutSessionId_key" ON "PaymentRequest"("stripeCheckoutSessionId");
CREATE UNIQUE INDEX "PaymentRequest_stripePaymentIntentId_key" ON "PaymentRequest"("stripePaymentIntentId");
CREATE UNIQUE INDEX "PaymentRequest_stripeChargeId_key" ON "PaymentRequest"("stripeChargeId");
CREATE INDEX "PaymentRequest_inquiryId_createdAt_idx" ON "PaymentRequest"("inquiryId", "createdAt");
CREATE INDEX "PaymentRequest_buyerCompanyId_status_idx" ON "PaymentRequest"("buyerCompanyId", "status");
CREATE INDEX "PaymentRequest_sellerCompanyId_status_idx" ON "PaymentRequest"("sellerCompanyId", "status");
CREATE INDEX "PaymentRequest_status_paymentDueDate_idx" ON "PaymentRequest"("status", "paymentDueDate");
CREATE INDEX "PaymentRequest_status_checkoutLockExpiresAt_idx" ON "PaymentRequest"("status", "checkoutLockExpiresAt");
CREATE UNIQUE INDEX "PaymentRefund_stripeRefundId_key" ON "PaymentRefund"("stripeRefundId");
CREATE INDEX "PaymentRefund_paymentRequestId_createdAt_idx" ON "PaymentRefund"("paymentRequestId", "createdAt");
CREATE UNIQUE INDEX "PaymentDispute_stripeDisputeId_key" ON "PaymentDispute"("stripeDisputeId");
CREATE INDEX "PaymentDispute_paymentRequestId_createdAt_idx" ON "PaymentDispute"("paymentRequestId", "createdAt");
CREATE UNIQUE INDEX "PaymentRequestEvent_stripeEventId_key" ON "PaymentRequestEvent"("stripeEventId");
CREATE INDEX "PaymentRequestEvent_paymentRequestId_createdAt_idx" ON "PaymentRequestEvent"("paymentRequestId", "createdAt");
CREATE INDEX "PaymentRequestEvent_eventType_createdAt_idx" ON "PaymentRequestEvent"("eventType", "createdAt");
CREATE UNIQUE INDEX "PaymentRequestWebhookEvent_stripeEventId_key" ON "PaymentRequestWebhookEvent"("stripeEventId");
CREATE INDEX "PaymentRequestWebhookEvent_paymentRequestId_createdAt_idx" ON "PaymentRequestWebhookEvent"("paymentRequestId", "createdAt");

ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_inquiryId_fkey"
  FOREIGN KEY ("inquiryId") REFERENCES "Inquiry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_buyerCompanyId_fkey"
  FOREIGN KEY ("buyerCompanyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_sellerCompanyId_fkey"
  FOREIGN KEY ("sellerCompanyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentRefund" ADD CONSTRAINT "PaymentRefund_paymentRequestId_fkey"
  FOREIGN KEY ("paymentRequestId") REFERENCES "PaymentRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentDispute" ADD CONSTRAINT "PaymentDispute_paymentRequestId_fkey"
  FOREIGN KEY ("paymentRequestId") REFERENCES "PaymentRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_releasedByUserId_fkey"
  FOREIGN KEY ("releasedByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentRequestEvent" ADD CONSTRAINT "PaymentRequestEvent_paymentRequestId_fkey"
  FOREIGN KEY ("paymentRequestId") REFERENCES "PaymentRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentRequestEvent" ADD CONSTRAINT "PaymentRequestEvent_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentRequestWebhookEvent" ADD CONSTRAINT "PaymentRequestWebhookEvent_paymentRequestId_fkey"
  FOREIGN KEY ("paymentRequestId") REFERENCES "PaymentRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
