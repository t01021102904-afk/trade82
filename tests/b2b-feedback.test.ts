import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("B2B feedback removes rating input, display, aggregates, and public API fields", async () => {
  const [companyApi, dealApi, publicApi, companyFeedback, dealFeedback, detail, sellerCard, dashboard, admin, presenter] = await Promise.all([
    readFile(new URL("../src/app/api/company-reviews/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/deals/[id]/reviews/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/public/marketplace/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/components/company-reviews.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/deal-review-form.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/database-public-detail.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/seller-card.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/dashboard-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/admin-verifications.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/public-marketplace-presenters.ts", import.meta.url), "utf8"),
  ]);

  for (const source of [companyApi, dealApi]) {
    assert.match(source, /rating: null/);
    assert.doesNotMatch(source, /Rating must be between 1 and 5/);
  }
  for (const source of [companyFeedback, dealFeedback, detail, sellerCard, dashboard, admin, presenter]) {
    assert.doesNotMatch(source, /review\.rating|seller\.rating|averageRating|ratingValue|reviewRating|aggregateRating|★/);
  }
  assert.doesNotMatch(publicApi, /rating: true/);
  assert.match(detail, /reviewTitle/);
  assert.match(detail, /reviewText/);
  assert.match(detail, /reviewerCompany/);
  assert.match(detail, /formatContract/);
  assert.match(detail, /formatFeedbackDate/);
});

test("review ratings are nullable without altering historic data", async () => {
  const [schema, migration] = await Promise.all([
    readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8"),
    readFile(new URL("../prisma/migrations/20260727210000_make_review_ratings_nullable/migration.sql", import.meta.url), "utf8"),
  ]);

  assert.match(schema, /model Review \{[\s\S]*?rating\s+Int\?/);
  assert.match(schema, /model CompanyReview \{[\s\S]*?rating\s+Int\?/);
  assert.match(migration, /ALTER TABLE "Review"[\s\S]*?ALTER COLUMN "rating" DROP NOT NULL/);
  assert.match(migration, /ALTER TABLE "CompanyReview"[\s\S]*?ALTER COLUMN "rating" DROP NOT NULL/);
  assert.doesNotMatch(migration, /DELETE|UPDATE|DROP TABLE/i);
});

test("feedback terminology keeps English and Korean locale parity", async () => {
  const [en, ko] = await Promise.all([
    readFile(new URL("../messages/en.json", import.meta.url), "utf8"),
    readFile(new URL("../messages/ko.json", import.meta.url), "utf8"),
  ]);

  for (const messages of [en, ko]) {
    assert.match(messages, /"completedDealFeedback"/);
    assert.match(messages, /"buyerFeedback"/);
    assert.match(messages, /"writeFeedback"/);
    assert.match(messages, /"submitFeedback"/);
    assert.doesNotMatch(messages, /"averageRating"|"rating"/);
  }
});
