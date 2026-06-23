ALTER TABLE "UserProfile"
ADD COLUMN "avatarOriginalUrl" TEXT,
ADD COLUMN "avatarUrl" TEXT;

ALTER TABLE "Company"
ADD COLUMN "logoOriginalUrl" TEXT,
ADD COLUMN "logoThumbnailUrl" TEXT;

ALTER TABLE "Product"
ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE TABLE "ProductImage" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "originalUrl" TEXT NOT NULL,
    "cardUrl" TEXT NOT NULL,
    "mainUrl" TEXT NOT NULL,
    "detailUrl" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "altText" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductImage_productId_position_key" ON "ProductImage"("productId", "position");
CREATE INDEX "ProductImage_productId_position_idx" ON "ProductImage"("productId", "position");
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

ALTER TABLE "ProductImage"
ADD CONSTRAINT "ProductImage_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "Category" ("id", "name", "slug", "sortOrder", "active", "updatedAt")
VALUES
  ('category-beauty-skincare', 'Beauty & Skincare', 'beauty-skincare', 1, true, CURRENT_TIMESTAMP),
  ('category-food-beverage', 'Food & Beverage', 'food-beverage', 2, true, CURRENT_TIMESTAMP),
  ('category-apparel', 'Apparel', 'apparel', 3, true, CURRENT_TIMESTAMP),
  ('category-supplements', 'Supplements', 'supplements', 4, true, CURRENT_TIMESTAMP),
  ('category-home-goods', 'Home Goods', 'home-goods', 5, true, CURRENT_TIMESTAMP),
  ('category-pet-products', 'Pet Products', 'pet-products', 6, true, CURRENT_TIMESTAMP),
  ('category-health-wellness', 'Health & Wellness', 'health-wellness', 7, true, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;
