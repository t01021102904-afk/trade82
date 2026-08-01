-- Add the pre-approval Supplier Application domain. These tables are isolated
-- from live Company, SellerProfile, Product, Order, and payout records.
-- No existing table, column, or record is removed or rewritten.

CREATE TYPE "SupplierApplicationStatus" AS ENUM (
  'DRAFT', 'SUBMITTED', 'BUSINESS_VERIFICATION',
  'PRODUCT_AUTHENTICITY_VERIFICATION', 'OPERATIONS_VERIFICATION',
  'SETTLEMENT_VERIFICATION', 'ADDITIONAL_INFORMATION_REQUIRED',
  'ADDITIONAL_DOCUMENTS_REQUIRED', 'INVENTORY_VERIFICATION_REQUIRED',
  'TEST_ORDER_REQUIRED', 'CONDITIONALLY_APPROVED', 'APPROVED', 'ON_HOLD',
  'REJECTED', 'WITHDRAWN', 'SUSPENDED'
);

CREATE TYPE "SupplierApplicationSection" AS ENUM (
  'BASIC_INFORMATION', 'BUSINESS_VERIFICATION', 'STAKEHOLDERS',
  'WAREHOUSES', 'SUPPLY_CHAIN', 'BRANDS', 'INVENTORY_SAMPLE', 'OPERATIONS',
  'SETTLEMENT', 'DOCUMENTS', 'FINAL_REVIEW'
);

CREATE TYPE "SupplierReviewStatus" AS ENUM (
  'PENDING', 'VERIFIED', 'ADDITIONAL_INFORMATION_REQUIRED',
  'INVALID_DOCUMENT', 'EXPIRED_DOCUMENT', 'UNABLE_TO_VERIFY', 'REJECTED'
);

CREATE TYPE "SupplierBrandVerificationStatus" AS ENUM (
  'PENDING', 'VERIFIED', 'ADDITIONAL_EVIDENCE_REQUIRED', 'RESTRICTED',
  'REJECTED', 'EXPIRED'
);

CREATE TYPE "SupplierSupplyChainType" AS ENUM (
  'BRAND_DIRECT', 'OFFICIAL_DISTRIBUTOR', 'AUTHORIZED_WHOLESALER',
  'DOMESTIC_WHOLESALER', 'INTERNATIONAL_WHOLESALER', 'OWN_MANUFACTURING',
  'SOURCED_AFTER_ORDER'
);

CREATE TYPE "SupplierApplicationDocumentType" AS ENUM (
  'BUSINESS_REGISTRATION', 'COMPANY_AUTHORITY', 'TAX_DOCUMENT',
  'WAREHOUSE_EXTERIOR', 'WAREHOUSE_ENTRANCE', 'WAREHOUSE_STORAGE_AREA',
  'WAREHOUSE_PACKING_AREA', 'WAREHOUSE_DISPATCH_AREA', 'SUPPLIER_INVOICE',
  'BRAND_AUTHORIZATION', 'BANK_DOCUMENT', 'TEST_ORDER_EVIDENCE', 'OTHER'
);

CREATE TYPE "SupplierInventorySampleFormat" AS ENUM ('XLSX', 'CSV');

CREATE TYPE "SupplierLegacyClassification" AS ENUM (
  'LEGACY_CONDITIONALLY_APPROVED', 'REVERIFICATION_REQUIRED',
  'APPLICATION_REQUIRED'
);

CREATE TABLE "SupplierApplication" (
  "id" TEXT NOT NULL,
  "applicationNumber" TEXT NOT NULL,
  "applicantUserId" TEXT NOT NULL,
  "legacyCompanyId" TEXT,
  "approvedCompanyId" TEXT,
  "assignedAdminUserId" TEXT,
  "status" "SupplierApplicationStatus" NOT NULL DEFAULT 'DRAFT',
  "statusReason" TEXT,
  "legalCompanyName" TEXT NOT NULL,
  "tradeName" TEXT,
  "companyWebsite" TEXT NOT NULL,
  "websiteDomain" TEXT,
  "registrationCountry" TEXT NOT NULL,
  "brandsHandled" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "annualRevenueRange" TEXT NOT NULL DEFAULT '',
  "warehouseType" TEXT NOT NULL DEFAULT '',
  "skuCountRange" TEXT NOT NULL DEFAULT '',
  "riskLevel" TEXT NOT NULL DEFAULT 'STANDARD',
  "submittedAt" TIMESTAMP(3),
  "withdrawnAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "legacyClassification" "SupplierLegacyClassification",
  "legacyBackfilledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupplierApplication_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupplierApplicationContact" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "contactType" TEXT NOT NULL DEFAULT 'PRIMARY',
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "jobTitle" TEXT NOT NULL,
  "workEmail" TEXT NOT NULL,
  "phoneNumber" TEXT NOT NULL,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupplierApplicationContact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupplierBusinessVerification" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "registrationNumber" TEXT NOT NULL DEFAULT '',
  "representativeInformation" TEXT NOT NULL DEFAULT '',
  "registeredAddress" TEXT NOT NULL DEFAULT '',
  "operatingAddress" TEXT NOT NULL DEFAULT '',
  "authorityDescription" TEXT NOT NULL DEFAULT '',
  "taxCountry" TEXT NOT NULL DEFAULT '',
  "taxNumberCiphertext" BYTEA,
  "taxNumberIv" BYTEA,
  "taxNumberAuthTag" BYTEA,
  "taxNumberKeyVersion" TEXT,
  "taxNumberLast4" TEXT,
  "websiteEmailDomainMatch" BOOLEAN,
  "reviewStatus" "SupplierReviewStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupplierBusinessVerification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SupplierBusinessVerification_tax_encryption_check" CHECK (
    ("taxNumberCiphertext" IS NULL AND "taxNumberIv" IS NULL AND "taxNumberAuthTag" IS NULL AND "taxNumberKeyVersion" IS NULL AND "taxNumberLast4" IS NULL)
    OR
    (octet_length("taxNumberCiphertext") > 0 AND octet_length("taxNumberIv") = 12 AND octet_length("taxNumberAuthTag") = 16 AND length("taxNumberKeyVersion") > 0 AND "taxNumberLast4" ~ '^[0-9A-Za-z]{4}$')
  )
);

CREATE TABLE "SupplierStakeholder" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "title" TEXT NOT NULL DEFAULT '',
  "relationship" TEXT NOT NULL DEFAULT '',
  "ownershipPercent" TEXT NOT NULL DEFAULT '',
  "country" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupplierStakeholder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupplierWarehouse" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "operator" TEXT NOT NULL DEFAULT '',
  "contactName" TEXT NOT NULL DEFAULT '',
  "contactPhone" TEXT NOT NULL DEFAULT '',
  "openingHours" TEXT NOT NULL DEFAULT '',
  "dailyOrderCapacity" INTEGER,
  "warehouseType" TEXT NOT NULL DEFAULT '',
  "reviewStatus" "SupplierReviewStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupplierWarehouse_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SupplierWarehouse_daily_order_capacity_check" CHECK ("dailyOrderCapacity" IS NULL OR "dailyOrderCapacity" >= 0)
);

CREATE TABLE "SupplierSupplyChain" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "relationshipType" "SupplierSupplyChainType" NOT NULL,
  "supplierCompany" TEXT NOT NULL DEFAULT '',
  "countries" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "description" TEXT NOT NULL DEFAULT '',
  "reviewStatus" "SupplierReviewStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupplierSupplyChain_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupplierBrandVerification" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "brand" TEXT NOT NULL,
  "relationshipType" "SupplierSupplyChainType" NOT NULL,
  "supplierCompany" TEXT NOT NULL DEFAULT '',
  "transactionStartedAt" TIMESTAMP(3),
  "evidenceStatus" "SupplierReviewStatus" NOT NULL DEFAULT 'PENDING',
  "reviewNotes" TEXT NOT NULL DEFAULT '',
  "countryRestrictions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status" "SupplierBrandVerificationStatus" NOT NULL DEFAULT 'PENDING',
  "verifiedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupplierBrandVerification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupplierOperationsProfile" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "companyMov" TEXT NOT NULL DEFAULT '',
  "brandLevelMov" JSONB NOT NULL DEFAULT '{}',
  "defaultLeadTimeDays" INTEGER,
  "onHandStockLeadTimeDays" INTEGER,
  "sourcedAfterOrderLeadTimeDays" INTEGER,
  "allowedCountries" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "restrictedCountries" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "dailyOrderCapacity" INTEGER,
  "dailyUnitCapacity" INTEGER,
  "boxPacking" BOOLEAN NOT NULL DEFAULT false,
  "palletPacking" BOOLEAN NOT NULL DEFAULT false,
  "hazardousGoodsPacking" BOOLEAN NOT NULL DEFAULT false,
  "temperatureControlledPacking" BOOLEAN NOT NULL DEFAULT false,
  "weekendShipping" BOOLEAN NOT NULL DEFAULT false,
  "inventoryUpdateMethod" TEXT NOT NULL DEFAULT 'MANUAL_PORTAL',
  "inventoryUpdateFrequency" TEXT NOT NULL DEFAULT '',
  "reviewStatus" "SupplierReviewStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupplierOperationsProfile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SupplierOperationsProfile_nonnegative_capacity_check" CHECK (
    ("defaultLeadTimeDays" IS NULL OR "defaultLeadTimeDays" >= 0)
    AND ("onHandStockLeadTimeDays" IS NULL OR "onHandStockLeadTimeDays" >= 0)
    AND ("sourcedAfterOrderLeadTimeDays" IS NULL OR "sourcedAfterOrderLeadTimeDays" >= 0)
    AND ("dailyOrderCapacity" IS NULL OR "dailyOrderCapacity" >= 0)
    AND ("dailyUnitCapacity" IS NULL OR "dailyUnitCapacity" >= 0)
  )
);

CREATE TABLE "SupplierSettlementProfile" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "legalAccountHolder" TEXT NOT NULL DEFAULT '',
  "bankName" TEXT NOT NULL DEFAULT '',
  "bankCountry" TEXT NOT NULL DEFAULT '',
  "accountNumberCiphertext" BYTEA,
  "accountNumberIv" BYTEA,
  "accountNumberAuthTag" BYTEA,
  "accountNumberKeyVersion" TEXT,
  "accountNumberLast4" TEXT,
  "accountNumberMasked" TEXT,
  "bankCode" TEXT NOT NULL DEFAULT '',
  "swiftBic" TEXT NOT NULL DEFAULT '',
  "payoutCurrency" TEXT NOT NULL DEFAULT '',
  "taxCountry" TEXT NOT NULL DEFAULT '',
  "taxNumberCiphertext" BYTEA,
  "taxNumberIv" BYTEA,
  "taxNumberAuthTag" BYTEA,
  "taxNumberKeyVersion" TEXT,
  "taxNumberLast4" TEXT,
  "vatInformation" TEXT NOT NULL DEFAULT '',
  "invoiceMethod" TEXT NOT NULL DEFAULT '',
  "payoutPolicyAcceptedAt" TIMESTAMP(3),
  "reviewStatus" "SupplierReviewStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupplierSettlementProfile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SupplierSettlementProfile_account_encryption_check" CHECK (
    ("accountNumberCiphertext" IS NULL AND "accountNumberIv" IS NULL AND "accountNumberAuthTag" IS NULL AND "accountNumberKeyVersion" IS NULL AND "accountNumberLast4" IS NULL AND "accountNumberMasked" IS NULL)
    OR
    (octet_length("accountNumberCiphertext") > 0 AND octet_length("accountNumberIv") = 12 AND octet_length("accountNumberAuthTag") = 16 AND length("accountNumberKeyVersion") > 0 AND "accountNumberLast4" ~ '^[0-9A-Za-z]{4}$' AND "accountNumberMasked" = '•••• ' || "accountNumberLast4")
  ),
  CONSTRAINT "SupplierSettlementProfile_tax_encryption_check" CHECK (
    ("taxNumberCiphertext" IS NULL AND "taxNumberIv" IS NULL AND "taxNumberAuthTag" IS NULL AND "taxNumberKeyVersion" IS NULL AND "taxNumberLast4" IS NULL)
    OR
    (octet_length("taxNumberCiphertext") > 0 AND octet_length("taxNumberIv") = 12 AND octet_length("taxNumberAuthTag") = 16 AND length("taxNumberKeyVersion") > 0 AND "taxNumberLast4" ~ '^[0-9A-Za-z]{4}$')
  )
);

CREATE TABLE "SupplierApplicationDocument" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "uploadedByUserId" TEXT NOT NULL,
  "documentType" "SupplierApplicationDocumentType" NOT NULL,
  "warehouseId" TEXT,
  "brandVerificationId" TEXT,
  "originalFilename" TEXT NOT NULL,
  "storedFilename" TEXT NOT NULL,
  "storageBucket" TEXT NOT NULL,
  "storagePath" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "sha256Hash" TEXT NOT NULL,
  "reviewStatus" "SupplierReviewStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupplierApplicationDocument_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SupplierApplicationDocument_size_check" CHECK ("sizeBytes" > 0)
);

CREATE TABLE "SupplierInventorySample" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "format" "SupplierInventorySampleFormat" NOT NULL,
  "originalFilename" TEXT NOT NULL,
  "storageBucket" TEXT NOT NULL,
  "storagePath" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "sha256Hash" TEXT NOT NULL,
  "totalRows" INTEGER NOT NULL DEFAULT 0,
  "validRows" INTEGER NOT NULL DEFAULT 0,
  "invalidRows" INTEGER NOT NULL DEFAULT 0,
  "duplicateGtins" INTEGER NOT NULL DEFAULT 0,
  "validationSummary" JSONB NOT NULL DEFAULT '{}',
  "reviewStatus" "SupplierReviewStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupplierInventorySample_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SupplierInventorySample_counts_check" CHECK (
    "sizeBytes" > 0 AND "totalRows" >= 0 AND "validRows" >= 0
    AND "invalidRows" >= 0 AND "duplicateGtins" >= 0
    AND "validRows" + "invalidRows" <= "totalRows"
  )
);

CREATE TABLE "SupplierApplicationReview" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "section" "SupplierApplicationSection" NOT NULL,
  "status" "SupplierReviewStatus" NOT NULL,
  "notes" TEXT NOT NULL DEFAULT '',
  "reviewedByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupplierApplicationReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupplierApplicationStatusHistory" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "fromStatus" "SupplierApplicationStatus",
  "toStatus" "SupplierApplicationStatus" NOT NULL,
  "reason" TEXT,
  "actorUserId" TEXT,
  "actorType" TEXT NOT NULL DEFAULT 'SYSTEM',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupplierApplicationStatusHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupplierInformationRequest" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "section" "SupplierApplicationSection" NOT NULL,
  "message" TEXT NOT NULL,
  "requestedByUserId" TEXT NOT NULL,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupplierInformationRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupplierDuplicateFlag" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "signal" TEXT NOT NULL,
  "matchedEntityType" TEXT NOT NULL,
  "matchedEntityId" TEXT,
  "matchedValueHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "resolutionNote" TEXT,
  CONSTRAINT "SupplierDuplicateFlag_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupplierApplicationAuditEvent" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "action" TEXT NOT NULL,
  "before" JSONB NOT NULL DEFAULT '{}',
  "after" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupplierApplicationAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupplierApplication_applicationNumber_key" ON "SupplierApplication"("applicationNumber");
CREATE UNIQUE INDEX "SupplierApplication_legacyCompanyId_key" ON "SupplierApplication"("legacyCompanyId");
CREATE UNIQUE INDEX "SupplierApplication_approvedCompanyId_key" ON "SupplierApplication"("approvedCompanyId");
CREATE UNIQUE INDEX "SupplierApplicationContact_applicationId_workEmail_key" ON "SupplierApplicationContact"("applicationId", "workEmail");
CREATE UNIQUE INDEX "SupplierBusinessVerification_applicationId_key" ON "SupplierBusinessVerification"("applicationId");
CREATE UNIQUE INDEX "SupplierBrandVerification_applicationId_brand_key" ON "SupplierBrandVerification"("applicationId", "brand");
CREATE UNIQUE INDEX "SupplierOperationsProfile_applicationId_key" ON "SupplierOperationsProfile"("applicationId");
CREATE UNIQUE INDEX "SupplierSettlementProfile_applicationId_key" ON "SupplierSettlementProfile"("applicationId");
CREATE UNIQUE INDEX "SupplierApplicationDocument_storagePath_key" ON "SupplierApplicationDocument"("storagePath");
CREATE UNIQUE INDEX "SupplierInventorySample_storagePath_key" ON "SupplierInventorySample"("storagePath");
CREATE UNIQUE INDEX "SupplierDuplicateFlag_applicationId_signal_matchedValueHash_key" ON "SupplierDuplicateFlag"("applicationId", "signal", "matchedValueHash");
CREATE INDEX "SupplierApplication_applicantUserId_status_idx" ON "SupplierApplication"("applicantUserId", "status");
CREATE INDEX "SupplierApplication_status_submittedAt_idx" ON "SupplierApplication"("status", "submittedAt");
CREATE INDEX "SupplierApplication_assignedAdminUserId_status_idx" ON "SupplierApplication"("assignedAdminUserId", "status");
CREATE INDEX "SupplierApplication_registrationCountry_status_idx" ON "SupplierApplication"("registrationCountry", "status");
CREATE INDEX "SupplierApplicationContact_applicationId_isPrimary_idx" ON "SupplierApplicationContact"("applicationId", "isPrimary");
CREATE INDEX "SupplierStakeholder_applicationId_idx" ON "SupplierStakeholder"("applicationId");
CREATE INDEX "SupplierWarehouse_applicationId_reviewStatus_idx" ON "SupplierWarehouse"("applicationId", "reviewStatus");
CREATE INDEX "SupplierSupplyChain_applicationId_relationshipType_idx" ON "SupplierSupplyChain"("applicationId", "relationshipType");
CREATE INDEX "SupplierBrandVerification_applicationId_status_idx" ON "SupplierBrandVerification"("applicationId", "status");
CREATE INDEX "SupplierBrandVerification_brand_status_idx" ON "SupplierBrandVerification"("brand", "status");
CREATE INDEX "SupplierApplicationDocument_applicationId_documentType_createdAt_idx" ON "SupplierApplicationDocument"("applicationId", "documentType", "createdAt");
CREATE INDEX "SupplierApplicationDocument_warehouseId_idx" ON "SupplierApplicationDocument"("warehouseId");
CREATE INDEX "SupplierApplicationDocument_brandVerificationId_idx" ON "SupplierApplicationDocument"("brandVerificationId");
CREATE INDEX "SupplierInventorySample_applicationId_createdAt_idx" ON "SupplierInventorySample"("applicationId", "createdAt");
CREATE INDEX "SupplierInventorySample_applicationId_reviewStatus_idx" ON "SupplierInventorySample"("applicationId", "reviewStatus");
CREATE INDEX "SupplierApplicationReview_applicationId_section_createdAt_idx" ON "SupplierApplicationReview"("applicationId", "section", "createdAt");
CREATE INDEX "SupplierApplicationReview_reviewedByUserId_createdAt_idx" ON "SupplierApplicationReview"("reviewedByUserId", "createdAt");
CREATE INDEX "SupplierApplicationStatusHistory_applicationId_createdAt_idx" ON "SupplierApplicationStatusHistory"("applicationId", "createdAt");
CREATE INDEX "SupplierApplicationStatusHistory_toStatus_createdAt_idx" ON "SupplierApplicationStatusHistory"("toStatus", "createdAt");
CREATE INDEX "SupplierInformationRequest_applicationId_resolvedAt_createdAt_idx" ON "SupplierInformationRequest"("applicationId", "resolvedAt", "createdAt");
CREATE INDEX "SupplierDuplicateFlag_applicationId_resolvedAt_idx" ON "SupplierDuplicateFlag"("applicationId", "resolvedAt");
CREATE INDEX "SupplierApplicationAuditEvent_applicationId_createdAt_idx" ON "SupplierApplicationAuditEvent"("applicationId", "createdAt");
CREATE INDEX "SupplierApplicationAuditEvent_actorUserId_createdAt_idx" ON "SupplierApplicationAuditEvent"("actorUserId", "createdAt");

ALTER TABLE "SupplierApplication"
  ADD CONSTRAINT "SupplierApplication_applicantUserId_fkey" FOREIGN KEY ("applicantUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "SupplierApplication_legacyCompanyId_fkey" FOREIGN KEY ("legacyCompanyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "SupplierApplication_approvedCompanyId_fkey" FOREIGN KEY ("approvedCompanyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "SupplierApplication_assignedAdminUserId_fkey" FOREIGN KEY ("assignedAdminUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupplierApplicationContact" ADD CONSTRAINT "SupplierApplicationContact_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "SupplierApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierBusinessVerification" ADD CONSTRAINT "SupplierBusinessVerification_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "SupplierApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierStakeholder" ADD CONSTRAINT "SupplierStakeholder_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "SupplierApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierWarehouse" ADD CONSTRAINT "SupplierWarehouse_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "SupplierApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierSupplyChain" ADD CONSTRAINT "SupplierSupplyChain_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "SupplierApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierBrandVerification" ADD CONSTRAINT "SupplierBrandVerification_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "SupplierApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierOperationsProfile" ADD CONSTRAINT "SupplierOperationsProfile_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "SupplierApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierSettlementProfile" ADD CONSTRAINT "SupplierSettlementProfile_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "SupplierApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierApplicationDocument"
  ADD CONSTRAINT "SupplierApplicationDocument_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "SupplierApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "SupplierApplicationDocument_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "SupplierApplicationDocument_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "SupplierWarehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "SupplierApplicationDocument_brandVerificationId_fkey" FOREIGN KEY ("brandVerificationId") REFERENCES "SupplierBrandVerification"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupplierInventorySample" ADD CONSTRAINT "SupplierInventorySample_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "SupplierApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierApplicationReview"
  ADD CONSTRAINT "SupplierApplicationReview_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "SupplierApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "SupplierApplicationReview_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierApplicationStatusHistory"
  ADD CONSTRAINT "SupplierApplicationStatusHistory_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "SupplierApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "SupplierApplicationStatusHistory_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupplierInformationRequest"
  ADD CONSTRAINT "SupplierInformationRequest_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "SupplierApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "SupplierInformationRequest_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierDuplicateFlag" ADD CONSTRAINT "SupplierDuplicateFlag_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "SupplierApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierApplicationAuditEvent"
  ADD CONSTRAINT "SupplierApplicationAuditEvent_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "SupplierApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "SupplierApplicationAuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE FUNCTION "preventSupplierApplicationAuditMutation"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  RAISE EXCEPTION 'Supplier application audit records are immutable';
END;
$$;

CREATE TRIGGER "SupplierApplicationStatusHistory_immutable"
BEFORE UPDATE OR DELETE ON "SupplierApplicationStatusHistory"
FOR EACH ROW EXECUTE FUNCTION "preventSupplierApplicationAuditMutation"();
CREATE TRIGGER "SupplierApplicationAuditEvent_immutable"
BEFORE UPDATE OR DELETE ON "SupplierApplicationAuditEvent"
FOR EACH ROW EXECUTE FUNCTION "preventSupplierApplicationAuditMutation"();

ALTER TABLE "SupplierApplication" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SupplierApplicationContact" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SupplierBusinessVerification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SupplierStakeholder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SupplierWarehouse" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SupplierSupplyChain" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SupplierBrandVerification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SupplierOperationsProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SupplierSettlementProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SupplierApplicationDocument" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SupplierInventorySample" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SupplierApplicationReview" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SupplierApplicationStatusHistory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SupplierInformationRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SupplierDuplicateFlag" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SupplierApplicationAuditEvent" ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE
  "SupplierApplication",
  "SupplierApplicationContact",
  "SupplierBusinessVerification",
  "SupplierStakeholder",
  "SupplierWarehouse",
  "SupplierSupplyChain",
  "SupplierBrandVerification",
  "SupplierOperationsProfile",
  "SupplierSettlementProfile",
  "SupplierApplicationDocument",
  "SupplierInventorySample",
  "SupplierApplicationReview",
  "SupplierApplicationStatusHistory",
  "SupplierInformationRequest",
  "SupplierDuplicateFlag",
  "SupplierApplicationAuditEvent"
FROM anon, authenticated;
