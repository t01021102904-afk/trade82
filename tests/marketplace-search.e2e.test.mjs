import assert from "node:assert/strict";
import test from "node:test";

import { chromium, webkit } from "playwright";

const baseUrl = (process.env.MARKETPLACE_E2E_BASE_URL ?? "https://trade82.com").replace(
  /\/$/,
  "",
);
async function openMarketplace(browserType, path) {
  const browser = await browserType.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const pageErrors = [];
  const consoleErrors = [];
  const marketplaceResponses = [];

  page.on("pageerror", (error) => {
    pageErrors.push({ message: error.message, stack: error.stack });
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push({ text: message.text(), location: message.location() });
    }
  });
  page.on("response", (response) => {
    if (response.url().includes("/api/public/marketplace")) {
      marketplaceResponses.push({ status: response.status(), url: response.url() });
    }
  });

  await page.goto(`${baseUrl}${path}`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  await page.locator("article").first().waitFor({ state: "visible", timeout: 30_000 });

  return {
    browser,
    page,
    pageErrors,
    consoleErrors,
    marketplaceResponses,
  };
}

async function searchForSerum(page) {
  const input = page.getByTestId("marketplace-search-input");
  assert.equal(await input.count(), 1, "Marketplace search input must be unique");

  const responsePromise = page.waitForResponse(
    (response) => {
      const url = new URL(response.url());
      return (
        url.pathname === "/api/public/marketplace" &&
        url.searchParams.get("q") === "serum"
      );
    },
    { timeout: 10_000 },
  );

  await input.fill("");
  for (const character of "serum") {
    await input.type(character, { delay: 45 });
  }

  const response = await responsePromise;
  await page.waitForTimeout(500);
  return { input, response };
}

function assertHealthySearch(
  { page, pageErrors, consoleErrors },
  { allowExpectedMarketplaceError = false } = {},
) {
  assert.equal(pageErrors.length, 0, `Unexpected pageerror: ${JSON.stringify(pageErrors)}`);
  const unexpectedConsoleErrors = allowExpectedMarketplaceError
    ? consoleErrors.filter(({ text }) => !text.startsWith("Marketplace search request failed"))
    : consoleErrors;
  assert.equal(
    unexpectedConsoleErrors.length,
    0,
    `Unexpected browser console error: ${JSON.stringify(unexpectedConsoleErrors)}`,
  );
  return page.evaluate(() => ({
    href: window.location.href,
    hasErrorPage:
      document.body.innerText.includes("This page couldn’t load") ||
      document.body.innerText.includes("This page couldn't load"),
    articleCount: document.querySelectorAll("article").length,
    bodyText: document.body.innerText.slice(0, 1200),
  }));
}

for (const [label, path] of [
  ["English", "/marketplace"],
  ["Korean", "/ko/marketplace"],
]) {
  test(`Chromium marketplace search remains rendered for ${label}`, async () => {
    const session = await openMarketplace(chromium, path);
    try {
      const { input, response } = await searchForSerum(session.page);
      assert.equal(response.status(), 200);
      assert.equal(await input.inputValue(), "serum");
      const state = await assertHealthySearch(session);
      assert.equal(new URL(state.href).searchParams.get("q"), "serum");
      assert.equal(state.hasErrorPage, false);
      assert.ok(state.articleCount >= 0);
    } finally {
      await session.browser.close();
    }
  });
}

test("Chromium rapid marketplace typing keeps only the latest search usable", async () => {
  const session = await openMarketplace(chromium, "/marketplace");
  try {
    const input = session.page.getByTestId("marketplace-search-input");
    await input.fill("");
    for (const character of "serum") {
      await input.type(character, { delay: 10 });
    }
    await session.page.waitForTimeout(1_000);
    const state = await assertHealthySearch(session);
    assert.equal(new URL(state.href).searchParams.get("q"), "serum");
    assert.equal(state.hasErrorPage, false);
  } finally {
    await session.browser.close();
  }
});

test("Chromium marketplace API failure keeps the page and existing products alive", async () => {
  const session = await openMarketplace(chromium, "/marketplace");
  try {
    await session.page.route("**/api/public/marketplace**", async (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get("q") === "serum") {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "temporarily unavailable" }),
        });
        return;
      }
      await route.continue();
    });

    const input = session.page.getByTestId("marketplace-search-input");
    for (const character of "serum") {
      await input.type(character, { delay: 45 });
    }
    await session.page.waitForTimeout(500);
    const state = await assertHealthySearch(session, { allowExpectedMarketplaceError: true });
    assert.equal(state.hasErrorPage, false);
    assert.ok(state.articleCount > 0);
    assert.match(state.bodyText, /Products temporarily unavailable/);
  } finally {
    await session.browser.close();
  }
});

test(
  "WebKit marketplace search remains rendered",
  { skip: process.env.MARKETPLACE_E2E_WEBKIT !== "1" },
  async () => {
    const session = await openMarketplace(webkit, "/marketplace");
    try {
      const { response } = await searchForSerum(session.page);
      assert.equal(response.status(), 200);
      const state = await assertHealthySearch(session);
      assert.equal(state.hasErrorPage, false);
      assert.equal(new URL(state.href).searchParams.get("q"), "serum");
    } finally {
      await session.browser.close();
    }
  },
);
