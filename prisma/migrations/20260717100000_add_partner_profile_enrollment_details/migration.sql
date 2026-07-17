-- Partner enrollment stores private contact and consent evidence separately
-- from public referral activity. Existing partner profiles remain valid and
-- can complete these fields later without interrupting referral accounting.
ALTER TABLE "PartnerProfile"
  ADD COLUMN "legalName" TEXT,
  ADD COLUMN "displayName" TEXT,
  ADD COLUMN "contactEmail" TEXT,
  ADD COLUMN "contactPhone" TEXT,
  ADD COLUMN "country" TEXT,
  ADD COLUMN "preferredLanguage" "PreferredLanguage",
  ADD COLUMN "organizationName" TEXT,
  ADD COLUMN "websiteOrSocialUrl" TEXT,
  ADD COLUMN "promotionDescription" TEXT,
  ADD COLUMN "termsConsentVersion" TEXT,
  ADD COLUMN "termsConsentedAt" TIMESTAMP(3),
  ADD COLUMN "privacyConsentVersion" TEXT,
  ADD COLUMN "privacyConsentedAt" TIMESTAMP(3);

ALTER TABLE "PartnerProfile"
  ADD CONSTRAINT "PartnerProfile_contactEmail_length"
  CHECK ("contactEmail" IS NULL OR char_length("contactEmail") <= 320),
  ADD CONSTRAINT "PartnerProfile_contactPhone_length"
  CHECK ("contactPhone" IS NULL OR char_length("contactPhone") <= 32),
  ADD CONSTRAINT "PartnerProfile_country_length"
  CHECK ("country" IS NULL OR char_length("country") <= 100);
