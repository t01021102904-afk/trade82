import assert from "node:assert/strict";
import { test } from "node:test";

import {
  canContinueSellerMerchantOnboarding,
  getStripeDirectChargeMerchantOnboardingMode,
  mapSellerStripeMerchantAccount,
  merchantAccountIdempotencyKey,
  startSellerStripeMerchantOnboarding,
} from "../src/lib/stripe-direct-charge-merchant.ts";

type Row = Record<string, unknown>;

function stripeAccount(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    object: "account",
    country: "KR",
    charges_enabled: false,
    payouts_enabled: false,
    details_submitted: false,
    capabilities: { card_payments: "inactive", transfers: "inactive" },
    requirements: {
      currently_due: ["external_account"],
      past_due: [],
      pending_verification: [],
      disabled_reason: null,
    },
    ...overrides,
  };
}

function readyAccount(id: string) {
  return stripeAccount(id, {
    charges_enabled: true,
    payouts_enabled: true,
    details_submitted: true,
    capabilities: { card_payments: "active", transfers: "active" },
    requirements: {
      currently_due: [],
      past_due: [],
      pending_verification: [],
      disabled_reason: null,
    },
  });
}

function createFakeDb() {
  const rows: Row[] = [];
  let nextId = 0;
  const lookup = (where: Row) =>
    rows.find((row) => Object.entries(where).every(([key, value]) => row[key] === value)) ?? null;
  const model = {
    findUnique: async ({ where }: { where: Row }) => lookup(where),
    create: async ({ data }: { data: Row }) => {
      const row = { id: `merchant-${++nextId}`, ...data };
      rows.push(row);
      return row;
    },
    update: async ({ where, data }: { where: Row; data: Row }) => {
      const row = lookup(where);
      if (!row) throw new Error("not found");
      Object.assign(row, data);
      return row;
    },
  };
  const db = {
    company: {
      findFirst: async ({ where }: { where: Row }) =>
        where.ownerUserId === "seller-owner" && where.companyRole === "seller"
          ? { id: "seller-company", country: "South Korea" }
          : null,
    },
    sellerStripeMerchantAccount: model,
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({ ...db, $executeRaw: async () => 1 }),
  };
  return { db, rows };
}

async function withMerchantMode<T>(run: () => Promise<T>) {
  const envKeys = [
    "STRIPE_CONNECT_ONBOARDING_MODE",
    "STRIPE_CONNECT_RUNTIME_MODE",
    "STRIPE_SECRET_KEY",
    "NEXT_PUBLIC_APP_URL",
  ] as const;
  const previous = Object.fromEntries(
    envKeys.map((key) => [key, process.env[key]]),
  ) as Record<(typeof envKeys)[number], string | undefined>;
  const next = {
    STRIPE_CONNECT_ONBOARDING_MODE: "on",
    STRIPE_CONNECT_RUNTIME_MODE: "test",
    STRIPE_SECRET_KEY: "sk_test_merchant_unit",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  };
  Object.assign(process.env, next);
  try {
    return await run();
  } finally {
    for (const key of envKeys) {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("merchant onboarding mode and idempotency are fail-closed and deterministic", () => {
  assert.equal(getStripeDirectChargeMerchantOnboardingMode(undefined), "off");
  assert.equal(getStripeDirectChargeMerchantOnboardingMode("anything"), "off");
  assert.equal(getStripeDirectChargeMerchantOnboardingMode("on"), "on");
  assert.equal(merchantAccountIdempotencyKey("company-1"), "trade82-direct-charge-merchant:company-1:v1");
  assert.equal(merchantAccountIdempotencyKey("company-1"), merchantAccountIdempotencyKey("company-1"));
});

test("merchant account creation requests Direct Charge capabilities and reuses the account", async () => {
  const { db } = createFakeDb();
  const calls = { accounts: 0, links: 0 };
  const accountKeys: string[] = [];
  const linkRequests: Row[] = [];
  const stripe = {
    accounts: {
      create: async (params: Row, options: Row) => {
        calls.accounts += 1;
        accountKeys.push(String(options.idempotencyKey));
        assert.equal(params.country, "KR");
        assert.deepEqual(params.controller, {
          fees: { payer: "account" },
          losses: { payments: "stripe" },
          requirement_collection: "stripe",
          stripe_dashboard: { type: "full" },
        });
        assert.deepEqual(params.capabilities, {
          card_payments: { requested: true },
          transfers: { requested: true },
        });
        assert.deepEqual(params.metadata, {
          trade82_account_purpose: "seller_direct_charge_merchant",
          trade82_company_id: "seller-company",
        });
        return stripeAccount("acct_merchant");
      },
    },
    accountLinks: {
      create: async (params: Row) => {
        calls.links += 1;
        linkRequests.push(params);
        assert.deepEqual(params.collection_options, { fields: "eventually_due" });
        return { url: `https://connect.stripe.test/link-${calls.links}` };
      },
    },
  };

  await withMerchantMode(async () => {
    const first = await startSellerStripeMerchantOnboarding({
      userId: "seller-owner",
      locale: "ko",
      db: db as never,
      stripe: stripe as never,
    });
    const second = await startSellerStripeMerchantOnboarding({
      userId: "seller-owner",
      locale: "ko",
      db: db as never,
      stripe: stripe as never,
    });
    assert.equal(first.url, "https://connect.stripe.test/link-1");
    assert.equal(second.url, "https://connect.stripe.test/link-2");
  });

  assert.equal(calls.accounts, 1);
  assert.equal(calls.links, 2);
  assert.deepEqual(accountKeys, ["trade82-direct-charge-merchant:seller-company:v1"]);
  assert.equal(linkRequests[0]?.account, "acct_merchant");
  assert.match(String(linkRequests[0]?.return_url), /locale=ko/);
});

test("merchant onboarding is seller-owner only and does not reuse settlement accounts", async () => {
  const { db } = createFakeDb();
  let stripeCalls = 0;
  const stripe = {
    accounts: { create: async () => { stripeCalls += 1; return stripeAccount("acct_merchant"); } },
    accountLinks: { create: async () => ({ url: "https://connect.stripe.test/link" }) },
  };

  await withMerchantMode(async () => {
    await assert.rejects(
      () => startSellerStripeMerchantOnboarding({ userId: "buyer-owner", db: db as never, stripe: stripe as never }),
      /seller company/,
    );
  });
  assert.equal(stripeCalls, 0);
});

test("merchant readiness requires both card payments and transfers and maps safe states", () => {
  assert.equal(mapSellerStripeMerchantAccount(readyAccount("acct_ready") as never).status, "ENABLED");
  assert.equal(mapSellerStripeMerchantAccount(stripeAccount("acct_new") as never).status, "ONBOARDING_INCOMPLETE");
  assert.equal(mapSellerStripeMerchantAccount(stripeAccount("acct_review", {
    details_submitted: true,
    requirements: { currently_due: [], past_due: [], pending_verification: ["person.verification"], disabled_reason: null },
  }) as never).status, "UNDER_REVIEW");
  assert.equal(mapSellerStripeMerchantAccount(stripeAccount("acct_restricted", {
    details_submitted: true,
    requirements: { currently_due: [], past_due: [], pending_verification: [], disabled_reason: "platform_new_reason" },
  }) as never).status, "RESTRICTED");
  assert.equal(mapSellerStripeMerchantAccount(stripeAccount("acct_disabled", {
    requirements: { currently_due: [], past_due: [], pending_verification: [], disabled_reason: "rejected.fraud" },
  }) as never).status, "DISABLED");
  assert.equal(canContinueSellerMerchantOnboarding({ status: "DISABLED", onboardingComplete: false }), false);
});
