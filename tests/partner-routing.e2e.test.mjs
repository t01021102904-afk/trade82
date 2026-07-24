import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import test from "node:test";

import { chromium, webkit } from "playwright";

const baseUrl = (process.env.PARTNER_ROUTING_E2E_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const partnerStorageState = process.env.PARTNER_ROUTING_E2E_PARTNER_STATE;
const onboardingStorageState = process.env.PARTNER_ROUTING_E2E_ONBOARDING_STATE;

async function hasFile(path) {
  if (!path) return false;
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function openPage(browserType, path, storageState) {
  const browser = await browserType.launch({ headless: true });
  const context = await browser.newContext({
    storageState,
    viewport: { width: 1536, height: 1024 },
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push({ message: error.message, stack: error.stack }));
  await page.goto(`${baseUrl}${path}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  return { browser, context, page, pageErrors };
}

async function assertNoPageErrors(session) {
  await session.page.waitForTimeout(250);
  assert.deepEqual(session.pageErrors, [], `Unexpected page errors: ${JSON.stringify(session.pageErrors)}`);
}

const partnerTestOptions = {
  skip: !(await hasFile(partnerStorageState)),
};

test("authenticated partner routes resolve to the partner dashboard and refresh the header", partnerTestOptions, async () => {
  const session = await openPage(chromium, "/dashboard", partnerStorageState);
  try {
    await session.page.waitForURL(/\/partner\/dashboard(?:\?|$)/, { timeout: 15_000 });
    await assertNoPageErrors(session);
    await assert.equal(await session.page.getByText("Partner dashboard", { exact: true }).count(), 1);
    assert.equal(await session.page.getByText("Dashboard", { exact: true }).count(), 0);
    assert.equal(await session.page.getByText("Messages", { exact: true }).count(), 0);

    for (const path of ["/onboarding/role", "/onboarding/buyer", "/onboarding/seller"]) {
      await session.page.goto(`${baseUrl}${path}`, { waitUntil: "domcontentloaded" });
      await session.page.waitForURL(/\/partner\/dashboard(?:\?|$)/, { timeout: 15_000 });
    }
    await assertNoPageErrors(session);
  } finally {
    await session.browser.close();
  }
});

test("authenticated onboarding cards and stepper stay within the viewport", { skip: !(await hasFile(onboardingStorageState)) }, async () => {
  for (const [browserName, browserType] of [["Chromium", chromium], ["WebKit", webkit]]) {
    if (browserName === "WebKit" && process.env.PARTNER_ROUTING_E2E_WEBKIT !== "1") continue;
    const session = await openPage(browserType, "/onboarding/role", onboardingStorageState);
    try {
      await session.page.getByText("Choose your account type", { exact: true }).waitFor({ timeout: 15_000 });
      await assertNoPageErrors(session);
      const desktop = await session.page.evaluate(() => ({
        documentOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        cards: [...document.querySelectorAll("button")].filter((button) => /seller|supplier|buyer/i.test(button.textContent ?? "")).map((button) => {
          const rect = button.getBoundingClientRect();
          return { left: rect.left, right: rect.right, width: rect.width, scrollWidth: button.scrollWidth, clientWidth: button.clientWidth };
        }),
        hasUntruncatedSourcing: document.body.innerText.includes("Sourcing Preferences"),
      }));
      assert.equal(desktop.documentOverflow, false);
      assert.ok(desktop.cards.length >= 2);
      assert.equal(desktop.cards.some((card) => card.scrollWidth > card.clientWidth), false);
      assert.equal(desktop.hasUntruncatedSourcing, true);

      await session.page.setViewportSize({ width: 390, height: 844 });
      const mobile = await session.page.evaluate(() => ({
        documentOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        cardLefts: [...document.querySelectorAll("button")].filter((button) => /seller|supplier|buyer/i.test(button.textContent ?? "")).map((button) => Math.round(button.getBoundingClientRect().left)),
      }));
      assert.equal(mobile.documentOverflow, false);
      assert.ok(new Set(mobile.cardLefts).size <= 2);
    } finally {
      await session.browser.close();
    }
  }
});
