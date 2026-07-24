import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { createElement } from "react";
import reactDomServer from "react-dom/server";

import {
  MarketplaceResultsPresentation,
  MarketplaceResultsSummary,
} from "../src/components/marketplace-results-presentation.ts";
import {
  MARKETPLACE_SEARCH_DEBOUNCE_MS,
  MarketplaceRequestAbortManager,
  MarketplaceRequestCoordinator,
  marketplaceQueryFromUrl,
  marketplaceResultsViewState,
  marketplaceUrlWithUpdates,
  scheduleMarketplaceSearch,
  updateMarketplaceHistory,
} from "../src/lib/public-marketplace-client-state.ts";
import {
  marketplacePagination,
  marketplaceQueryState,
  marketplaceSearchParams,
} from "../src/lib/public-marketplace-query-state.ts";
import { marketplaceItemListJsonLd } from "../src/lib/seo.ts";
import type { Product } from "../src/lib/types.ts";

const repositoryRoot = process.cwd();
const { renderToStaticMarkup } = reactDomServer;

const productFixture: Product = {
  id: "product-1",
  name: "Korean Serum",
  category: "Beauty & Personal Care",
  sellerId: "seller-1",
  sellerName: "Sample Seller",
  sellerLocation: "Seoul, South Korea",
  shortDescription: "A Korean serum.",
  longDescription: "A Korean serum for wholesale buyers.",
  wholesalePrice: "USD 12.00",
  wholesalePriceValue: 12,
  moq: "100 units",
  moqUnits: 100,
  leadTime: "14 days",
  monthlyCapacity: "10,000 units",
  sampleAvailable: true,
  privateLabelAvailable: false,
  countryOfOrigin: "South Korea",
  shippingOrigin: "South Korea",
  incoterms: ["FOB"],
  hsCode: "3304.99",
  certifications: [],
  documentsAvailable: [],
  packageSize: "30 ml",
  unitsPerCarton: "24",
  cartonWeight: "8 kg",
  koreanMarketFit: "Skincare",
  suggestedSalesChannels: [],
  riskNotes: [],
  imagePlaceholder: "/products/korean-serum.png",
};

function readSource(relativePath: string) {
  return readFileSync(path.join(repositoryRoot, relativePath), "utf8");
}

function renderProductCards(products: Product[]) {
  return createElement(
    "div",
    { "data-testid": "marketplace-product-grid" },
    products.map((product) =>
      createElement(
        "article",
        { key: product.id },
        createElement("img", {
          src: product.imagePlaceholder,
          alt: product.name,
        }),
        createElement(
          "a",
          { href: `/products/${product.id}` },
          product.name,
        ),
        createElement("span", null, product.sellerName),
      ),
    ),
  );
}

test("the first marketplace page keeps 24 products and the real total for pagination", () => {
  const query = marketplaceQueryState(new URLSearchParams());
  const requestParams = marketplaceSearchParams(query);
  const pagination = marketplacePagination(1, 24, 66);

  assert.equal(requestParams.get("page"), "1");
  assert.equal(requestParams.get("pageSize"), "24");
  assert.equal(requestParams.get("resource"), "products");
  assert.equal(pagination.total, 66);
  assert.equal(pagination.totalPages, 3);
  assert.equal(pagination.hasNextPage, true);
});

test("direct server-rendered URLs consume exactly one server query and no client API request", () => {
  const baseQuery = marketplaceQueryState(new URLSearchParams());
  const filteredQuery = marketplaceQueryState(
    new URLSearchParams("category=Food+%26+Snacks"),
  );

  for (const query of [baseQuery, filteredQuery]) {
    const coordinator = new MarketplaceRequestCoordinator(query);
    const requests = { server: 0, client: 0 };
    const plan = coordinator.nextRequest(query);
    if (plan !== "none") requests[plan] += 1;

    assert.deepEqual(requests, { server: 1, client: 0 });
    assert.equal(coordinator.nextRequest(query), "none");
  }
});

test("client filter, page, and browser history changes each require one client request", () => {
  const baseQuery = marketplaceQueryState(new URLSearchParams());
  const categoryQuery = marketplaceQueryState(
    new URLSearchParams("category=Food+%26+Snacks"),
  );
  const pageQuery = marketplaceQueryState(new URLSearchParams("page=2"));
  const coordinator = new MarketplaceRequestCoordinator(baseQuery);

  assert.equal(coordinator.nextRequest(baseQuery), "server");
  assert.equal(coordinator.nextRequest(categoryQuery), "client");
  assert.equal(coordinator.nextRequest(categoryQuery), "none");
  assert.equal(coordinator.nextRequest(pageQuery), "client");
  assert.equal(coordinator.nextRequest(baseQuery), "client");
});

test("server prop synchronization consumes new server data without a duplicate API request", () => {
  const baseQuery = marketplaceQueryState(new URLSearchParams());
  const filteredQuery = marketplaceQueryState(
    new URLSearchParams("category=Food+%26+Snacks"),
  );
  const initialCoordinator = new MarketplaceRequestCoordinator(baseQuery);
  const serverNavigationCoordinator = new MarketplaceRequestCoordinator(filteredQuery);

  assert.equal(initialCoordinator.nextRequest(baseQuery), "server");
  assert.equal(serverNavigationCoordinator.nextRequest(filteredQuery), "server");
  assert.equal(serverNavigationCoordinator.nextRequest(filteredQuery), "none");
});

test("search URL updates are debounced and the latest request cancels the previous one", () => {
  assert.equal(MARKETPLACE_SEARCH_DEBOUNCE_MS, 300);

  let nextTimerId = 1;
  const timers = new Map<number, () => void>();
  const timerApi = {
    setTimeout(callback: () => void) {
      const id = nextTimerId++;
      timers.set(id, callback);
      return id as unknown as ReturnType<typeof setTimeout>;
    },
    clearTimeout(timer: ReturnType<typeof setTimeout>) {
      timers.delete(timer as unknown as number);
    },
  };
  const committedQueries: string[] = [];
  const cancelFirst = scheduleMarketplaceSearch({
    value: "Korean",
    onCommit: (value) => committedQueries.push(value),
    timerApi,
  });
  cancelFirst();
  scheduleMarketplaceSearch({
    value: "Korean Serum",
    onCommit: (value) => committedQueries.push(value),
    timerApi,
  });

  for (const callback of timers.values()) callback();
  assert.deepEqual(committedQueries, ["Korean Serum"]);

  const abortManager = new MarketplaceRequestAbortManager();
  const firstRequest = abortManager.begin();
  const latestRequest = abortManager.begin();
  assert.equal(firstRequest.controller.signal.aborted, true);
  assert.equal(abortManager.isCurrent(firstRequest), false);
  assert.equal(abortManager.isCurrent(latestRequest), true);
});

test("History API URL updates preserve filter values and reset pagination safely", () => {
  const url = marketplaceUrlWithUpdates({
    pathname: "/marketplace",
    currentSearch: "?category=Food+%26+Snacks&page=3",
    updates: { q: "serum" },
  });

  assert.equal(url, "/marketplace?category=Food+%26+Snacks&q=serum");
  assert.deepEqual(marketplaceQueryFromUrl(url), {
    q: "serum",
    category: "Food & Snacks",
    price: "all",
    moq: "all",
    certification: "all",
    shipping: "all",
    page: 1,
  });
});

test("History updates use the native prototype method with the live history object", () => {
  const calls: Array<{ mode: string; context: unknown; url: string }> = [];
  const history = {
    state: { __next: true },
    replaceState() {
      throw new Error("patched replaceState should not be used");
    },
    pushState() {
      throw new Error("patched pushState should not be used");
    },
  };
  const historyPrototype = {
    replaceState(this: unknown, _state: unknown, _title: string, url: string) {
      calls.push({ mode: "replace", context: this, url });
    },
    pushState(this: unknown, _state: unknown, _title: string, url: string) {
      calls.push({ mode: "push", context: this, url });
    },
  };

  updateMarketplaceHistory(history, "/marketplace?q=serum", "replace", historyPrototype);
  updateMarketplaceHistory(history, "/marketplace?page=2", "push", historyPrototype);

  assert.deepEqual(calls, [
    { mode: "replace", context: history, url: "/marketplace?q=serum" },
    { mode: "push", context: history, url: "/marketplace?page=2" },
  ]);
});

test("History updates do not require a global History constructor", () => {
  const calls: string[] = [];
  const historyPrototype = {
    replaceState(this: unknown, _state: unknown, _title: string, url: string) {
      calls.push(url);
    },
    pushState(this: unknown, _state: unknown, _title: string, url: string) {
      calls.push(url);
    },
  };
  const history = Object.assign(Object.create(historyPrototype), { state: null });

  updateMarketplaceHistory(history, "/marketplace?q=serum", "replace");

  assert.deepEqual(calls, ["/marketplace?q=serum"]);
});

test("actual static marketplace results HTML contains product content and the real total", () => {
  const state = marketplaceResultsViewState({
    loading: false,
    requestError: false,
    productCount: 1,
  });
  const html = renderToStaticMarkup(
    createElement(
      "section",
      null,
      createElement(MarketplaceResultsSummary, {
        locale: "en",
        state,
        total: 66,
        productsFoundLabel: "products found",
      }),
      createElement(MarketplaceResultsPresentation, {
        state,
        products: [productFixture],
        renderLoading: () => createElement("p", null, "Loading products"),
        renderProducts: renderProductCards,
        renderEmpty: () => createElement("p", null, "No products found"),
        renderError: () =>
          createElement("p", null, "Products temporarily unavailable"),
      }),
    ),
  );

  assert.match(html, /Korean Serum/);
  assert.match(html, /href="\/products\/product-1"/);
  assert.match(html, /Sample Seller/);
  assert.match(html, /alt="Korean Serum"/);
  assert.match(html, /66 products found/);
  assert.doesNotMatch(html, /0 products found/);
  assert.doesNotMatch(html, /No products found/);
});

test("request errors never render an empty-results count or empty-state copy", () => {
  const state = marketplaceResultsViewState({
    loading: false,
    requestError: true,
    productCount: 0,
  });
  const html = renderToStaticMarkup(
    createElement(
      "section",
      null,
      createElement(MarketplaceResultsSummary, {
        locale: "en",
        state,
        total: 0,
        productsFoundLabel: "products found",
      }),
      createElement(MarketplaceResultsPresentation, {
        state,
        products: [],
        renderLoading: () => createElement("p", null, "Loading products"),
        renderProducts: renderProductCards,
        renderEmpty: () => createElement("p", null, "No products found"),
        renderError: () =>
          createElement("p", null, "Product listings are temporarily unavailable."),
      }),
    ),
  );

  assert.match(html, /Products temporarily unavailable/);
  assert.doesNotMatch(html, /0 products found/);
  assert.doesNotMatch(html, /No products found/);
});

test("only genuinely empty results render the zero count and empty-state copy", () => {
  const state = marketplaceResultsViewState({
    loading: false,
    requestError: false,
    productCount: 0,
  });
  const html = renderToStaticMarkup(
    createElement(
      "section",
      null,
      createElement(MarketplaceResultsSummary, {
        locale: "en",
        state,
        total: 0,
        productsFoundLabel: "products found",
      }),
      createElement(MarketplaceResultsPresentation, {
        state,
        products: [],
        renderLoading: () => createElement("p", null, "Loading products"),
        renderProducts: renderProductCards,
        renderEmpty: () => createElement("p", null, "No products found"),
        renderError: () =>
          createElement("p", null, "Products temporarily unavailable"),
      }),
    ),
  );

  assert.match(html, /0 products found/);
  assert.match(html, /No products found/);
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

test("Marketplace pages preserve server data, locale ItemList JSON-LD, and client-only URL updates", () => {
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
  const clientSource = readSource("src/components/marketplace-client.tsx");
  const clientStateSource = readSource("src/lib/public-marketplace-client-state.ts");
  const productCardSource = readSource("src/components/product-card.tsx");
  assert.match(englishPage, /marketplaceItemListJsonLd\(initialData\.products, "en"\)/);
  assert.match(koreanPage, /marketplaceItemListJsonLd\(initialData\.products, "ko"\)/);
  assert.match(clientSource, /MarketplaceRequestCoordinator/);
  assert.match(clientSource, /updateMarketplaceHistory/);
  assert.match(clientStateSource, /Object\.getPrototypeOf\(history\)/);
  assert.match(clientStateSource, /prototype\.replaceState/);
  assert.match(clientStateSource, /prototype\.pushState/);
  assert.match(clientSource, /setRequestError\(true\)/);
  assert.match(clientSource, /scheduleMarketplaceSearch/);
  assert.match(clientSource, /key=\{initialDataSignature\(props\)\}/);
  assert.match(clientSource, /<ProductCard key=\{product\.id\} product=\{product\} \/>/);
  assert.match(productCardSource, /withLocale\(`\/products\/\$\{product\.id\}`, locale\)/);
  assert.match(productCardSource, /alt=\{product\.name\}/);
  assert.match(clientStateSource, /AbortController/);
  assert.doesNotMatch(clientSource, /useSearchParams/);
  assert.doesNotMatch(clientSource, /router\.replace/);
});

test("the API and client reuse the shared product query and keep errors distinct from genuine emptiness", () => {
  const apiSource = readSource("src/app/api/public/marketplace/route.ts");
  const clientSource = readSource("src/components/marketplace-client.tsx");
  const dataSource = readSource("src/lib/public-marketplace-data.ts");

  assert.match(apiSource, /getPublicMarketplaceProducts/);
  assert.match(dataSource, /p\."status" = 'active'/);
  assert.match(dataSource, /c\."verificationStatus" = 'verified'/);
  assert.match(clientSource, /initialProducts/);
  assert.match(clientSource, /MarketplaceResultsSummary/);
  assert.match(clientSource, /MarketplaceUnavailable/);
  assert.doesNotMatch(clientSource, /products: \[\], pagination: DEFAULT_PAGINATION/);
});
