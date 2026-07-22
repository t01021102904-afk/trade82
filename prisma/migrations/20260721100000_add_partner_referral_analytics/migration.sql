-- Add privacy-preserving partner referral analytics and immutable conversions.
CREATE TABLE "ReferralClickDailyVisitor" (
  "id" TEXT NOT NULL,
  "partnerProfileId" TEXT NOT NULL,
  "visitorHash" TEXT NOT NULL,
  "day" DATE NOT NULL,
  "clickCount" INTEGER NOT NULL DEFAULT 1,
  "firstClickedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastClickedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReferralClickDailyVisitor_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReferralClickDailyVisitor_clickCount_check" CHECK ("clickCount" > 0),
  CONSTRAINT "ReferralClickDailyVisitor_partnerProfileId_fkey"
    FOREIGN KEY ("partnerProfileId") REFERENCES "PartnerProfile"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ReferralClickDailyVisitor_partnerProfileId_visitorHash_day_key"
  ON "ReferralClickDailyVisitor"("partnerProfileId", "visitorHash", "day");
CREATE INDEX "ReferralClickDailyVisitor_partnerProfileId_day_idx"
  ON "ReferralClickDailyVisitor"("partnerProfileId", "day");

CREATE TABLE "ReferralConversion" (
  "id" TEXT NOT NULL,
  "partnerProfileId" TEXT NOT NULL,
  "referralAttributionId" TEXT NOT NULL,
  "subjectType" "ReferralSubjectType" NOT NULL,
  "convertedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReferralConversion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReferralConversion_partnerProfileId_fkey"
    FOREIGN KEY ("partnerProfileId") REFERENCES "PartnerProfile"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ReferralConversion_referralAttributionId_fkey"
    FOREIGN KEY ("referralAttributionId") REFERENCES "ReferralAttribution"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ReferralConversion_referralAttributionId_subjectType_key"
  ON "ReferralConversion"("referralAttributionId", "subjectType");
CREATE INDEX "ReferralConversion_partnerProfileId_convertedAt_idx"
  ON "ReferralConversion"("partnerProfileId", "convertedAt");

INSERT INTO "ReferralConversion" (
  "id", "partnerProfileId", "referralAttributionId", "subjectType", "convertedAt", "createdAt"
)
SELECT
  'referral-conversion-' || md5(ra."id" || ':' || c."companyRole"::text),
  ra."partnerProfileId",
  ra."id",
  CASE
    WHEN c."companyRole" = 'seller'::"CompanyRole" THEN 'SELLER'::"ReferralSubjectType"
    ELSE 'BUYER'::"ReferralSubjectType"
  END,
  c."createdAt",
  CURRENT_TIMESTAMP
FROM "ReferralAttribution" ra
JOIN "Company" c ON c."ownerUserId" = ra."referredUserId"
WHERE c."companyRole" IN ('seller'::"CompanyRole", 'buyer'::"CompanyRole")
ON CONFLICT ("referralAttributionId", "subjectType") DO NOTHING;

ALTER TABLE "ReferralClickDailyVisitor" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReferralConversion" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "ReferralClickDailyVisitor", "ReferralConversion" FROM anon, authenticated;
