-- Preserve existing ratings while allowing new B2B transaction feedback without a score.
ALTER TABLE "Review"
  ALTER COLUMN "rating" DROP NOT NULL;

ALTER TABLE "CompanyReview"
  ALTER COLUMN "rating" DROP NOT NULL;
