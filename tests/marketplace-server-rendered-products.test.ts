import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  marketplacePagination,
  marketplaceQueryState,
  marketplaceSearchParams,
  shouldFetchMarketplaceProducts,
} from "../src/lib/public-marketplace-query-state.ts";
import { marketplaceItemListJsonLd } from "../src/lib/seo.ts";

const repositoryRoot = process.cwd();

function readSource(relativePath: string) {
  return readFileSync(path.join(repositoryRoot, relativePath), "utf8");
}

test("the first marketplace page keeps 24 products and the real total for pagination", () => {
  const query = marketplaceQueryState(new URLSearchParams());
  const requestParams = marketplaceSearchParams(query);
  const pagination = marketplacePagination(1, 24, 66);

  assert.equal(requestParams.get("page"), "1");
  assert.equal(requestParams.get("pageSize"), "24");
  assert.equal(pagination.total, 66);
  assert.equal(pagination.totalPages, 3);
  assert.equal(pagination.hasNextPage, true);
});

test("initial marketplace data skips an identical client request but fetches filtered and paginated changes", () => {
  const initialQuery = marketplaceQueryState(new URLSearchParams());

  assert.equal(
    shouldFetchMarketplaceProducts({
      isInitialRender: true,
      initialQueryState: initialQuery,
      currentQueryState: initialQuery,
    }),
    false,
  );
  assert.equal(
    shouldFetchMarketplaceProducts({
      isInitialRender: false,
      initialQueryState: initialQuery,
      currentQueryState: initialQuery,
    }),
    true,
  );
  assert.equal(
    shouldFetchMarketplaceProducts({
      isInitialRender: true,
      initialQueryState: initialQuery,
      currentQueryState: marketplaceQueryState(
        new URLSearchParams("category=Food+%26+Snacks"),
      ),
    }),
    true,
  );
  assert.equal(
    shouldFetchMarketplaceProducts({
      isInitialRender: true,
      initialQueryState: initialQuery,
      currentQueryState: marketplaceQueryState(new URLSearchParams("page=2")),
    }),
    true,
  );
});

test("marketplace ItemList JSON-LD contains only actual locale-specific product URLs", () => {
  const products = [
    { id: "product-1", name: "Korean Snack" },
    { id: "product-2", name: "Korean Serum" },
  ];
  const english = marketplaceItemListJsonLd(products, "en");
  const korean = marketplaceItemListJsonLd(products, "ko");
  const englishItems = english.itemListElement as Array<Record<string, unknown>>;
  const koreanItems = korean.itemListElement as Array<Record<string, unknown>>;

  assert.equal(english["@type"], "ItemList");
  assert.deepEqual(englishItems[0], {
    "@type": "ListItem",
    position: 1,
    name: "Korean Snack",
    url: "https://trade82.com/products/product-1",
  });
  assert.equal(
    koreanItems[1]?.url,
    "https://trade82.com/ko/products/product-2",
  );
  assert.equal(JSON.stringify(english).includes("offers"), false);
  assert.equal(JSON.stringify(english).includes("aggregateRating"), false);
});

test("Marketplace pages pass server data to the client and only add ItemList for real products", () => {
  for (const pagePath of [
    "src/app/marketplace/page.tsx",
    "src/app/ko/marketplace/page.tsx",
  ]) {
    const source = readSource(pagePath);
    assert.match(source, /export const dynamic = "force-dynamic"/);
    assert.match(source, /getInitialMarketplaceData/);
    assert.match(source, /initialProducts=\{initialData\?\.products\}/);
    assert.match(source, /initialPagination=\{initialData\?\.pagination\}/);
    assert.match(source, /initialFilterOptions=\{initialData\?\.filterOptions\}/);
    assert.match(source, /initialData\?\.products\.length/);
    assert.match(source, /marketplaceItemListJsonLd/);
  }

  const englishPage = readSource("src/app/marketplace/page.tsx");
  const koreanPage = readSource("src/app/ko/marketplace/page.tsx");
  assert.match(englishPage, /marketplaceItemListJsonLd\(initialData\.products, "en"\)/);
  assert.match(koreanPage, /marketplaceItemListJsonLd\(initialData\.products, "ko"\)/);
});

test("initial server products render through product cards with real names, links, and image alt text", () => {
  const clientSource = readSource("src/components/marketplace-client.tsx");
  const cardSource = readSource("src/components/product-card.tsx");

  assert.match(clientSource, /databaseProducts\.map\(\(product\) => \(/);
  assert.match(clientSource, /<ProductCard key=\{product\.id\} product=\{product\} \/>/);
  assert.match(cardSource, /withLocale\(`\/products\/\$\{product\.id\}`, locale\)/);
  assert.match(cardSource, /alt=\{product\.name\}/);
  assert.match(cardSource, /\{product\.name\}/);
});

test("the API and client reuse the shared product query and keep errors distinct from genuine emptiness", () => {
  const apiSource = readSource("src/app/api/public/marketplace/route.ts");
  const clientSource = readSource("src/components/marketplace-client.tsx");
  const dataSource = readSource("src/lib/public-marketplace-data.ts");

  assert.match(apiSource, /getPublicMarketplaceProducts/);
  assert.match(dataSource, /p\."status" = 'active'/);
  assert.match(dataSource, /c\."verificationStatus" = 'verified'/);
  assert.match(clientSource, /initialProducts/);
  assert.match(clientSource, /shouldFetchMarketplaceProducts/);
  assert.match(clientSource, /setRequestError\(true\)/);
  assert.match(clientSource, /MarketplaceUnavailable/);
  assert.doesNotMatch(clientSource, /products: \[\], pagination: DEFAULT_PAGINATION/);
});
