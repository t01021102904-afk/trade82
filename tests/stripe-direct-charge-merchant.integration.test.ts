import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, test } from "node:test";

import type { PrismaClient } from "../src/generated/prisma/client.ts";

function assertDisposableDatabase() {
  const value = process.env.DATABASE_URL;
  assert.ok(value, "DATABASE_URL is required for the disposable integration suite.");
  const url = new URL(value);
  assert.ok(
    ["127.0.0.1", "localhost"].includes(url.hostname),
    "The integration database must be localhost only.",
  );
  assert.match(
    url.pathname.slice(1),
    /^trade82_order_payout_test_/,
    "The integration database name is not disposable.",
  );
  assert.ok(
    !/(supabase|neon|aws|vercel|render|railway|fly)/i.test(url.hostname),
    "A remote database is never valid for this suite.",
  );
}

assertDisposableDatabase();
process.env.DATABASE_POOL_MAX = "8";

const { getDb } = await import(new URL("../src/lib/db.ts", import.meta.url).href);
const merchant = await import(
  new URL("../src/lib/stripe-direct-charge-merchant.ts", import.meta.url).href,
);
const { processStripeConnectWebhookEvent } = await import(
  new URL("../src/lib/stripe-connect-onboarding-webhook.ts", import.meta.url).href,
);
const db = getDb() as PrismaClient;

after(async () => {
  await db.$disconnect();
});

function suffix() {
  return randomBytes(8).toString("hex");
}

function incompleteAccount(id: string) {
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
  };
}

function enabledAccount(id: string) {
  return {
    ...incompleteAccount(id),
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
  };
}

test("disposable PostgreSQL reuses one direct-charge merchant account and refreshes links", async () => {
  const id = suffix();
  const user = await db.userProfile.create({
    data: {
      clerkUserId: `merchant-seller-${id}`,
      email: `merchant-seller-${id}@example.test`,
      displayName: "Merchant seller",
      country: "KR",
      role: "seller",
    },
  });
  const company = await db.company.create({
    data: {
      ownerUserId: user.id,
      companyRole: "seller",
      legalName: `Merchant seller ${id}`,
      country: "KR",
      city: "Seoul",
      businessAddress: "Seoul",
    },
  });

  const envKeys = [
    "STRIPE_DIRECT_CHARGE_MERCHANT_ONBOARDING_MODE",
    "STRIPE_CONNECT_ONBOARDING_MODE",
    "STRIPE_CONNECT_RUNTIME_MODE",
    "STRIPE_SECRET_KEY",
    "NEXT_PUBLIC_APP_URL",
  ] as const;
  const previous = Object.fromEntries(
    envKeys.map((key) => [key, process.env[key]]),
  ) as Record<(typeof envKeys)[number], string | undefined>;
  Object.assign(process.env, {
    STRIPE_DIRECT_CHARGE_MERCHANT_ONBOARDING_MODE: "on",
    STRIPE_CONNECT_ONBOARDING_MODE: "on",
    STRIPE_CONNECT_RUNTIME_MODE: "test",
    STRIPE_SECRET_KEY: "sk_test_merchant_integration",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  });

  let accountCreateCount = 0;
  const accountLinkRequests: Record<string, unknown>[] = [];
  const stripe = {
    accounts: {
      create: async (params: Record<string, unknown>, options: { idempotencyKey?: string }) => {
        accountCreateCount += 1;
        assert.equal(params.country, "KR");
        assert.equal(
          options.idempotencyKey,
          `trade82-direct-charge-merchant:${company.id}:v1`,
        );
        return incompleteAccount(`acct_merchant_${id}`);
      },
      retrieve: async () => enabledAccount(`acct_merchant_${id}`),
    },
    accountLinks: {
      create: async (params: Record<string, unknown>) => {
        accountLinkRequests.push(params);
        assert.deepEqual(params.collection_options, { fields: "eventually_due" });
        return { url: `https://connect.stripe.test/${accountLinkRequests.length}` };
      },
    },
  };

  try {
    const [first, second] = await Promise.all([
      merchant.startSellerStripeMerchantOnboarding({
        userId: user.id,
        db,
        stripe,
      }),
      merchant.startSellerStripeMerchantOnboarding({
        userId: user.id,
        db,
        stripe,
      }),
    ]);

    const stored = await db.sellerStripeMerchantAccount.findUniqueOrThrow({
      where: { companyId: company.id },
    });
    assert.equal(accountCreateCount, 1);
    assert.equal(stored.stripeAccountId, `acct_merchant_${id}`);
    assert.equal(first.account.exists, true);
    assert.equal(second.account.exists, true);
    assert.equal(accountLinkRequests.length, 2);
    assert.deepEqual(
      accountLinkRequests.map((request) => request.account),
      [stored.stripeAccountId, stored.stripeAccountId],
    );
    assert.equal(
      await db.stripeConnectedAccount.count({ where: { companyId: company.id } }),
      0,
    );

    const synced = await merchant.syncSellerStripeMerchantAccount({
      db,
      account: enabledAccount(stored.stripeAccountId) as never,
    });
    assert.equal(synced.updated, true);
    const refreshed = await db.sellerStripeMerchantAccount.findUniqueOrThrow({
      where: { companyId: company.id },
    });
    assert.equal(refreshed.status, "ENABLED");
    assert.equal(refreshed.cardPaymentsEnabled, true);
    assert.equal(refreshed.payoutsEnabled, true);
    assert.equal(refreshed.transfersEnabled, true);
    assert.equal(refreshed.onboardingComplete, true);
    assert.equal(refreshed.requirementsOutstanding, false);
  } finally {
    for (const key of envKeys) {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await db.sellerStripeMerchantAccount.deleteMany({ where: { companyId: company.id } });
    await db.company.delete({ where: { id: company.id } });
    await db.userProfile.delete({ where: { id: user.id } });
  }
});

test("merchant table keeps restrictive database security and empty initial state", async () => {
  const [security] = (await db.$queryRawUnsafe(`
    SELECT
      (
        SELECT relrowsecurity
        FROM pg_class
        JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
        WHERE pg_namespace.nspname = 'public'
          AND pg_class.relname = 'SellerStripeMerchantAccount'
      ) AS rls_enabled,
      (
        SELECT count(*) = 17
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'SellerStripeMerchantAccount'
      ) AS exact_column_count,
      (
        SELECT count(*) = 0
        FROM "SellerStripeMerchantAccount"
      ) AS empty_table,
      NOT has_table_privilege('anon', 'public."SellerStripeMerchantAccount"', 'SELECT')
        AND NOT has_table_privilege('anon', 'public."SellerStripeMerchantAccount"', 'INSERT')
        AND NOT has_table_privilege('anon', 'public."SellerStripeMerchantAccount"', 'UPDATE')
        AND NOT has_table_privilege('anon', 'public."SellerStripeMerchantAccount"', 'DELETE')
        AND NOT has_table_privilege('anon', 'public."SellerStripeMerchantAccount"', 'TRUNCATE')
        AND NOT has_table_privilege('anon', 'public."SellerStripeMerchantAccount"', 'REFERENCES')
        AND NOT has_table_privilege('anon', 'public."SellerStripeMerchantAccount"', 'TRIGGER')
        AND NOT has_table_privilege('authenticated', 'public."SellerStripeMerchantAccount"', 'SELECT')
        AND NOT has_table_privilege('authenticated', 'public."SellerStripeMerchantAccount"', 'INSERT')
        AND NOT has_table_privilege('authenticated', 'public."SellerStripeMerchantAccount"', 'UPDATE')
        AND NOT has_table_privilege('authenticated', 'public."SellerStripeMerchantAccount"', 'DELETE')
        AND NOT has_table_privilege('authenticated', 'public."SellerStripeMerchantAccount"', 'TRUNCATE')
        AND NOT has_table_privilege('authenticated', 'public."SellerStripeMerchantAccount"', 'REFERENCES')
        AND NOT has_table_privilege('authenticated', 'public."SellerStripeMerchantAccount"', 'TRIGGER')
        AS public_access_revoked,
      EXISTS (
        SELECT 1
        FROM pg_constraint
        JOIN pg_class ON pg_class.oid = pg_constraint.conrelid
        JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
        WHERE pg_namespace.nspname = 'public'
          AND pg_class.relname = 'SellerStripeMerchantAccount'
          AND pg_constraint.conname = 'SellerStripeMerchantAccount_companyId_fkey'
          AND pg_constraint.confdeltype = 'r'
      ) AS restrictive_fk,
      EXISTS (
        SELECT 1 FROM pg_class
        JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
        WHERE pg_namespace.nspname = 'public'
          AND pg_class.relname = 'SellerStripeMerchantAccount_status_updatedAt_idx'
          AND pg_class.relkind = 'i'
      ) AS status_index
  `)) as Array<Record<string, boolean>>;

  assert.equal(security.rls_enabled, true);
  assert.equal(security.exact_column_count, true);
  assert.equal(security.empty_table, true);
  assert.equal(security.public_access_revoked, true);
  assert.equal(security.restrictive_fk, true);
  assert.equal(security.status_index, true);
});

test("seller-facing status is company-owner scoped and merchant webhooks ignore unrelated accounts", async () => {
  const id = suffix();
  const sellerA = await db.userProfile.create({
    data: {
      clerkUserId: `merchant-owner-a-${id}`,
      email: `merchant-owner-a-${id}@example.test`,
      displayName: "Merchant owner A",
      country: "KR",
      role: "seller",
    },
  });
  const sellerB = await db.userProfile.create({
    data: {
      clerkUserId: `merchant-owner-b-${id}`,
      email: `merchant-owner-b-${id}@example.test`,
      displayName: "Merchant owner B",
      country: "KR",
      role: "seller",
    },
  });
  const buyer = await db.userProfile.create({
    data: {
      clerkUserId: `merchant-buyer-${id}`,
      email: `merchant-buyer-${id}@example.test`,
      displayName: "Merchant buyer",
      country: "KR",
      role: "buyer",
    },
  });
  const companyA = await db.company.create({
    data: {
      ownerUserId: sellerA.id,
      companyRole: "seller",
      legalName: `Merchant company A ${id}`,
      country: "KR",
      city: "Seoul",
      businessAddress: "Seoul",
    },
  });
  const companyB = await db.company.create({
    data: {
      ownerUserId: sellerB.id,
      companyRole: "seller",
      legalName: `Merchant company B ${id}`,
      country: "KR",
      city: "Busan",
      businessAddress: "Busan",
    },
  });

  try {
    await db.sellerStripeMerchantAccount.create({
      data: {
        companyId: companyA.id,
        stripeAccountId: `acct_merchant_a_${id}`,
        country: "KR",
      },
    });
    await db.sellerStripeMerchantAccount.create({
      data: {
        companyId: companyB.id,
        stripeAccountId: `acct_merchant_b_${id}`,
        country: "KR",
      },
    });

    const statusA = await merchant.getSellerStripeMerchantAccountStatus({ userId: sellerA.id, db });
    const statusB = await merchant.getSellerStripeMerchantAccountStatus({ userId: sellerB.id, db });
    assert.equal(statusA.exists, true);
    assert.equal(statusB.exists, true);
    assert.equal(statusA.country, "KR");
    assert.equal(statusB.country, "KR");
    await assert.rejects(
      () => merchant.getSellerStripeMerchantAccountStatus({ userId: buyer.id, db }),
      /seller company/,
    );

    const settlementAccountCount = await db.stripeConnectedAccount.count();
    const synced = await processStripeConnectWebhookEvent({
      id: `evt_merchant_${id}`,
      type: "account.updated",
      livemode: false,
      data: { object: enabledAccount(`acct_merchant_a_${id}`) },
    } as never, { db });
    assert.deepEqual(synced, { handled: true, found: true, updated: true });
    const refreshedA = await db.sellerStripeMerchantAccount.findUniqueOrThrow({
      where: { companyId: companyA.id },
    });
    assert.equal(refreshedA.status, "ENABLED");
    assert.equal(await db.stripeConnectedAccount.count(), settlementAccountCount);

    const ignored = await processStripeConnectWebhookEvent({
      id: `evt_unrelated_${id}`,
      type: "account.updated",
      livemode: false,
      data: { object: enabledAccount(`acct_unrelated_${id}`) },
    } as never, { db });
    assert.deepEqual(ignored, { handled: true, found: false, updated: false });
    const unchangedB = await db.sellerStripeMerchantAccount.findUniqueOrThrow({
      where: { companyId: companyB.id },
    });
    assert.equal(unchangedB.status, "ONBOARDING_INCOMPLETE");
    assert.equal(await db.stripeConnectedAccount.count(), settlementAccountCount);
  } finally {
    await db.sellerStripeMerchantAccount.deleteMany({
      where: { companyId: { in: [companyA.id, companyB.id] } },
    });
    await db.company.deleteMany({ where: { id: { in: [companyA.id, companyB.id] } } });
    await db.userProfile.deleteMany({ where: { id: { in: [sellerA.id, sellerB.id, buyer.id] } } });
  }
});
