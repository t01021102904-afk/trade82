CREATE TABLE "CompanyReview" (
    "id" TEXT NOT NULL,
    "reviewerCompanyId" TEXT NOT NULL,
    "reviewedCompanyId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyReview_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CompanyReview_reviewedCompanyId_isPublic_createdAt_idx" ON "CompanyReview"("reviewedCompanyId", "isPublic", "createdAt");
CREATE INDEX "CompanyReview_reviewerCompanyId_createdAt_idx" ON "CompanyReview"("reviewerCompanyId", "createdAt");

ALTER TABLE "CompanyReview" ADD CONSTRAINT "CompanyReview_reviewerCompanyId_fkey" FOREIGN KEY ("reviewerCompanyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyReview" ADD CONSTRAINT "CompanyReview_reviewedCompanyId_fkey" FOREIGN KEY ("reviewedCompanyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
