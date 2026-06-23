-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AccountRole" AS ENUM ('seller', 'buyer', 'both', 'admin');

-- CreateEnum
CREATE TYPE "PreferredLanguage" AS ENUM ('en', 'ko');

-- CreateEnum
CREATE TYPE "CompanyRole" AS ENUM ('seller', 'buyer');

-- CreateEnum
CREATE TYPE "CompanyVerificationStatus" AS ENUM ('unverified', 'email_verified', 'pending_review', 'verified', 'rejected', 'needs_reverification');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('active', 'inactive', 'draft');

-- CreateEnum
CREATE TYPE "VerificationRequestStatus" AS ENUM ('pending_review', 'verified', 'rejected');

-- CreateEnum
CREATE TYPE "InquiryStatus" AS ENUM ('sent', 'replied', 'closed');

-- CreateEnum
CREATE TYPE "SavedItemType" AS ENUM ('product', 'company');

-- CreateEnum
CREATE TYPE "DealStatus" AS ENUM ('proposed', 'completed', 'cancelled', 'disputed');

-- CreateEnum
CREATE TYPE "PublicValueDisplay" AS ENUM ('hidden', 'exact', 'range');

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" "AccountRole" NOT NULL,
    "preferredLanguage" "PreferredLanguage" NOT NULL DEFAULT 'en',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "companyRole" "CompanyRole" NOT NULL,
    "legalName" TEXT NOT NULL,
    "tradeName" TEXT,
    "logoUrl" TEXT,
    "useDefaultLogo" BOOLEAN NOT NULL DEFAULT true,
    "website" TEXT NOT NULL DEFAULT '',
    "country" TEXT NOT NULL,
    "city" TEXT NOT NULL DEFAULT '',
    "stateOrProvince" TEXT NOT NULL DEFAULT '',
    "businessAddress" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "verificationStatus" "CompanyVerificationStatus" NOT NULL DEFAULT 'unverified',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SellerProfile" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "koreanBusinessRegistrationNumber" TEXT NOT NULL,
    "representativeName" TEXT NOT NULL,
    "exportExperience" TEXT NOT NULL,
    "exportCountries" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "productCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "minimumOrderQuantity" TEXT NOT NULL,
    "leadTime" TEXT NOT NULL,
    "certifications" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "shippingTerms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "paymentTerms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "factoryOrDistributorStatus" TEXT NOT NULL,

    CONSTRAINT "SellerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuyerProfile" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "buyerType" TEXT NOT NULL,
    "purchasingCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "targetOrderSize" TEXT NOT NULL,
    "monthlyImportVolume" TEXT NOT NULL,
    "importExperience" TEXT NOT NULL,
    "purchaseTimeline" TEXT NOT NULL,
    "salesChannels" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "BuyerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "sellerCompanyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "imageUrl" TEXT,
    "category" TEXT NOT NULL,
    "shortDescription" TEXT NOT NULL,
    "detailedDescription" TEXT NOT NULL,
    "priceMin" DECIMAL(14,2),
    "priceMax" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "moq" TEXT NOT NULL,
    "leadTime" TEXT NOT NULL,
    "origin" TEXT NOT NULL DEFAULT 'South Korea',
    "certifications" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ingredientsOrMaterials" TEXT NOT NULL,
    "packaging" TEXT NOT NULL,
    "exportReadiness" BOOLEAN NOT NULL DEFAULT false,
    "status" "ProductStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationRequest" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "status" "VerificationRequestStatus" NOT NULL DEFAULT 'pending_review',
    "documentUrl" TEXT,
    "documentFilename" TEXT,
    "adminNote" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inquiry" (
    "id" TEXT NOT NULL,
    "buyerCompanyId" TEXT NOT NULL,
    "sellerCompanyId" TEXT NOT NULL,
    "productId" TEXT,
    "senderUserId" TEXT NOT NULL,
    "recipientCompanyId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "quantity" TEXT,
    "targetDate" TIMESTAMP(3),
    "status" "InquiryStatus" NOT NULL DEFAULT 'sent',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT,
    "companyId" TEXT,
    "type" "SavedItemType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "inquiryId" TEXT,
    "senderUserId" TEXT NOT NULL,
    "receiverUserId" TEXT,
    "senderCompanyId" TEXT,
    "receiverCompanyId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "inquiryId" TEXT,
    "buyerCompanyId" TEXT NOT NULL,
    "sellerCompanyId" TEXT NOT NULL,
    "productId" TEXT,
    "contractTitle" TEXT NOT NULL,
    "contractValue" DECIMAL(16,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "dealStatus" "DealStatus" NOT NULL DEFAULT 'proposed',
    "completedAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "confirmedByBuyer" BOOLEAN NOT NULL DEFAULT false,
    "confirmedBySeller" BOOLEAN NOT NULL DEFAULT false,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "publicValueDisplay" "PublicValueDisplay" NOT NULL DEFAULT 'hidden',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "reviewerCompanyId" TEXT NOT NULL,
    "reviewedCompanyId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "reviewTitle" TEXT,
    "reviewText" TEXT NOT NULL,
    "contractValue" DECIMAL(16,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "isVerifiedDealReview" BOOLEAN NOT NULL DEFAULT true,
    "publicValueDisplay" "PublicValueDisplay" NOT NULL DEFAULT 'hidden',
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "adminApproved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_clerkUserId_key" ON "UserProfile"("clerkUserId");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_email_key" ON "UserProfile"("email");

-- CreateIndex
CREATE INDEX "Company_companyRole_verificationStatus_idx" ON "Company"("companyRole", "verificationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Company_ownerUserId_companyRole_key" ON "Company"("ownerUserId", "companyRole");

-- CreateIndex
CREATE UNIQUE INDEX "SellerProfile_companyId_key" ON "SellerProfile"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "BuyerProfile_companyId_key" ON "BuyerProfile"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

-- CreateIndex
CREATE INDEX "Product_sellerCompanyId_status_idx" ON "Product"("sellerCompanyId", "status");

-- CreateIndex
CREATE INDEX "Product_category_idx" ON "Product"("category");

-- CreateIndex
CREATE INDEX "VerificationRequest_status_createdAt_idx" ON "VerificationRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Inquiry_buyerCompanyId_sellerCompanyId_idx" ON "Inquiry"("buyerCompanyId", "sellerCompanyId");

-- CreateIndex
CREATE INDEX "Inquiry_recipientCompanyId_status_idx" ON "Inquiry"("recipientCompanyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SavedItem_userId_productId_key" ON "SavedItem"("userId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedItem_userId_companyId_key" ON "SavedItem"("userId", "companyId");

-- CreateIndex
CREATE INDEX "Message_inquiryId_createdAt_idx" ON "Message"("inquiryId", "createdAt");

-- CreateIndex
CREATE INDEX "Deal_buyerCompanyId_sellerCompanyId_dealStatus_idx" ON "Deal"("buyerCompanyId", "sellerCompanyId", "dealStatus");

-- CreateIndex
CREATE INDEX "Review_reviewedCompanyId_isPublic_adminApproved_idx" ON "Review"("reviewedCompanyId", "isPublic", "adminApproved");

-- CreateIndex
CREATE UNIQUE INDEX "Review_dealId_reviewerCompanyId_key" ON "Review"("dealId", "reviewerCompanyId");

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerProfile" ADD CONSTRAINT "SellerProfile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyerProfile" ADD CONSTRAINT "BuyerProfile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_sellerCompanyId_fkey" FOREIGN KEY ("sellerCompanyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationRequest" ADD CONSTRAINT "VerificationRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationRequest" ADD CONSTRAINT "VerificationRequest_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationRequest" ADD CONSTRAINT "VerificationRequest_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_buyerCompanyId_fkey" FOREIGN KEY ("buyerCompanyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_sellerCompanyId_fkey" FOREIGN KEY ("sellerCompanyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_recipientCompanyId_fkey" FOREIGN KEY ("recipientCompanyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedItem" ADD CONSTRAINT "SavedItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedItem" ADD CONSTRAINT "SavedItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedItem" ADD CONSTRAINT "SavedItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_inquiryId_fkey" FOREIGN KEY ("inquiryId") REFERENCES "Inquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_receiverUserId_fkey" FOREIGN KEY ("receiverUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderCompanyId_fkey" FOREIGN KEY ("senderCompanyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_receiverCompanyId_fkey" FOREIGN KEY ("receiverCompanyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_inquiryId_fkey" FOREIGN KEY ("inquiryId") REFERENCES "Inquiry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_buyerCompanyId_fkey" FOREIGN KEY ("buyerCompanyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_sellerCompanyId_fkey" FOREIGN KEY ("sellerCompanyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_reviewerCompanyId_fkey" FOREIGN KEY ("reviewerCompanyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_reviewedCompanyId_fkey" FOREIGN KEY ("reviewedCompanyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
