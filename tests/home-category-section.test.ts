import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import type { HomeProductCategory } from "@/lib/home-product-categories";
import type { MarketplaceCategory } from "@/lib/marketplace";

const categoriesModule = await import(
  new URL("../src/lib/home-product-categories.ts", import.meta.url).href,
) as {
  homeProductCategories: readonly HomeProductCategory[];
  homeProductCategoryHref: (category: MarketplaceCategory, locale: "en" | "ko") => string;
};
const marketplaceModule = (await import(new URL("../src/lib/marketplace.ts", import.meta.url).href)) as {
  marketplaceCategories: readonly MarketplaceCategory[];
};

const homeComponent = await readFile(
  new URL("../src/components/home-category-scroller.tsx", import.meta.url),
  "utf8",
);
const homeExperience = await readFile(
  new URL("../src/components/home-experience.tsx", import.meta.url),
  "utf8",
);
const globalCss = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");
const dictionaries = {
  en: JSON.parse(await readFile(new URL("../messages/en.json", import.meta.url), "utf8")),
  ko: JSON.parse(await readFile(new URL("../messages/ko.json", import.meta.url), "utf8")),
};

const emojiPattern = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

test("homepage category configuration covers every marketplace category exactly once", () => {
  const categories = categoriesModule.homeProductCategories;
  assert.equal(categories.length, 14);
  assert.equal(new Set(categories.map((item: HomeProductCategory) => item.category)).size, 14);
  assert.deepEqual(
    categories.map((item: HomeProductCategory) => item.category),
    marketplaceModule.marketplaceCategories,
  );
});

test("homepage category links retain the existing marketplace category query", () => {
  for (const item of categoriesModule.homeProductCategories) {
    const englishHref = categoriesModule.homeProductCategoryHref(item.category, "en");
    const koreanHref = categoriesModule.homeProductCategoryHref(item.category, "ko");
    assert.equal(englishHref, `/marketplace?category=${encodeURIComponent(item.category)}`);
    assert.equal(koreanHref, `/ko/marketplace?category=${encodeURIComponent(item.category)}`);
  }
});

test("category section uses translated labels and accessible previous and next controls", () => {
  for (const dictionary of Object.values(dictionaries)) {
    const section = dictionary.home.categorySection;
    assert.equal(typeof section.title, "string");
    assert.equal(typeof section.previous, "string");
    assert.equal(typeof section.next, "string");
    for (const item of categoriesModule.homeProductCategories) {
      const label = section.items[item.id];
      assert.equal(typeof label, "string");
      assert.notEqual(label, `home.categorySection.items.${item.id}`);
    }
  }
  assert.match(homeComponent, /aria-label=\{t\("home\.categorySection\.previous"\)\}/);
  assert.match(homeComponent, /aria-label=\{t\("home\.categorySection\.next"\)\}/);
  assert.match(homeComponent, /focus-visible:ring-2/);
  assert.match(globalCss, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.home-category-scroll/);
});

test("category cards render once from local non-emoji SVG illustrations and replace the technology strip", async () => {
  assert.equal((homeComponent.match(/homeProductCategories\.map/g) ?? []).length, 1);
  assert.doesNotMatch(homeExperience, /BuiltWithMarquee|builtWithLogos|ChatGPT logo|Vercel logo/);

  for (const item of categoriesModule.homeProductCategories) {
    assert.doesNotMatch(item.imageSrc, emojiPattern);
    const asset = await readFile(new URL(`../public${item.imageSrc}`, import.meta.url), "utf8");
    assert.match(asset, /^<svg[\s>]/);
    assert.doesNotMatch(asset, emojiPattern);
  }
});
