import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import type { Locale } from "../src/lib/i18n";
import type { HomeProductCategory } from "../src/lib/home-product-categories";
import type { MarketplaceCategory } from "../src/lib/marketplace";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const rootDirectory = path.resolve(testDirectory, "..");
const categoryModule = await import(pathToFileURL(path.join(rootDirectory, "src/lib/home-product-categories.ts")).href);
const marketplaceModule = await import(pathToFileURL(path.join(rootDirectory, "src/lib/marketplace.ts")).href);

const { homeCategoryHref, homeProductCategories } = categoryModule as {
  homeCategoryHref: (category: MarketplaceCategory, locale: Locale) => string;
  homeProductCategories: readonly HomeProductCategory[];
};
const { marketplaceCategories } = marketplaceModule as {
  marketplaceCategories: readonly MarketplaceCategory[];
};

const expectedCategories = [
  "Beauty & Personal Care",
  "Food & Snacks",
  "Household Goods",
  "Fashion & Apparel",
  "Baby & Kids",
  "Pet Products",
  "Health & Wellness",
  "Electronics Accessories",
  "Kitchenware",
  "K-Pop & Character Goods",
  "Stationery & Lifestyle",
  "Packaging",
  "Industrial / B2B Supplies",
  "Other",
];

test("renders exactly the existing marketplace category values", () => {
  assert.equal(homeProductCategories.length, 14);
  assert.deepEqual(homeProductCategories.map((item) => item.category), expectedCategories);
  assert.deepEqual([...marketplaceCategories], expectedCategories);
});

test("creates locale-aware marketplace links with safely encoded category values", () => {
  assert.equal(
    homeCategoryHref("Beauty & Personal Care", "en"),
    "/marketplace?category=Beauty%20%26%20Personal%20Care",
  );
  assert.equal(
    homeCategoryHref("Beauty & Personal Care", "ko"),
    "/ko/marketplace?category=Beauty%20%26%20Personal%20Care",
  );
  assert.equal(
    homeCategoryHref("Industrial / B2B Supplies", "ko"),
    "/ko/marketplace?category=Industrial%20%2F%20B2B%20Supplies",
  );
});

test("uses a local PNG asset for every category", async () => {
  for (const item of homeProductCategories) {
    assert.match(item.imageSrc, /^\/categories\/[a-z]+\.png$/);
    const source = await readFile(path.join(rootDirectory, "public", item.imageSrc));
    assert.deepEqual([...source.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  }
});

test("replaces the technology logo marquee without changing Trending Products", async () => {
  const homeExperience = await readFile(path.join(rootDirectory, "src/components/home-experience.tsx"), "utf8");
  const scroller = await readFile(path.join(rootDirectory, "src/components/home-category-visual-scroller.tsx"), "utf8");
  const styles = await readFile(path.join(rootDirectory, "src/app/globals.css"), "utf8");

  assert.match(homeExperience, /<HomeCategoryVisualScroller\s*\/>/);
  assert.match(homeExperience, /<HomeMarketingExposureStrip\s*\/>/);
  assert.ok(homeExperience.indexOf("<HomeCategoryVisualScroller") < homeExperience.indexOf("<HomeMarketingExposureStrip"));
  assert.doesNotMatch(homeExperience, /BuiltWithMarquee|builtWithLogos|home-marquee-mask|\/logo\/(chatgpt|codex|vercel|supabase|stripe|clerk|resend|github)/i);
  assert.doesNotMatch(styles, /\.home-marquee-mask|\.home-marquee-track/);
  assert.match(scroller, /ChevronLeft/);
  assert.match(scroller, /ChevronRight/);
  assert.match(scroller, /aria-label=\{t\("home\.categorySection\.previous"\)\}/);
  assert.match(scroller, /aria-label=\{t\("home\.categorySection\.next"\)\}/);
  assert.match(scroller, /onWheel=\{handleWheel\}/);
  assert.match(styles, /scroll-snap-type:\s*x proximity/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
});

test("includes complete English and Korean category labels", async () => {
  const english = JSON.parse(await readFile(path.join(rootDirectory, "messages/en.json"), "utf8"));
  const korean = JSON.parse(await readFile(path.join(rootDirectory, "messages/ko.json"), "utf8"));

  assert.equal(english.home.categorySection.title, "Explore Categories");
  assert.equal(korean.home.categorySection.title, "상품 카테고리 둘러보기");

  for (const item of homeProductCategories) {
    assert.equal(typeof english.home.categorySection.items[item.id], "string");
    assert.equal(typeof korean.home.categorySection.items[item.id], "string");
  }
});
