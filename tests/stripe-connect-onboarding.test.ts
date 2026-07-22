import assert from "node:assert/strict";
import { test } from "node:test";

import {
  assertStripeConnectCountry,
  canContinueStripeConnectOnboarding,
  classifyStripeConnectDisabledReason,
  getApprovedStripeConnectAccountCountries,
  getStripeConnectOnboardingStatus,
  mapStripeConnectedAccount,
  normalizeStripeConnectCountry,
  returnFromStripeConnectOnboarding,
  startStripeConnectOnboarding,
} from "../src/lib/stripe-connect-onboarding.ts";
import { getStripeConnectOnboardingMode } from "../src/lib/stripe-connect-onboarding-feature.ts";
import {
  handleStripeConnectWebhookRequest,
  processStripeConnectWebhookEvent,
} from "../src/lib/stripe-connect-onboarding-webhook.ts";
import {
  assertStripeConnectRuntimeMode,
  assertStripeCredentialMatchesRuntime,
  getStripeConnectRuntimeMode,
} from "../src/lib/stripe-connect-runtime-mode.ts";

type Row = Record<string, unknown>;

function fakeAccount(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    object: "account",
    charges_enabled: false,
    payouts_enabled: false,
    details_submitted: false,
    capabilities: { transfers: "inactive" },
    requirements: { currently_due: ["external_account"], past_due: [], pending_verification: [], disabled_reason: null },
    ...overrides,
  };
}

function createFakeDb({ ownerType = "seller", activePartner = true }: { ownerType?: "seller" | "partner"; activePartner?: boolean } = {}) {
  const rows: Row[] = [];
  let nextId = 0;
  const lookup = (where: Row) => rows.find((row) => Object.entries(where).every(([key, value]) => row[key] === value)) ?? null;
  const db = {
    company: {
      findFirst: async () => ownerType === "seller" ? { id: "seller-company", country: "KR" } : null,
    },
    partnerProfile: {
      findFirst: async () => ownerType === "partner" ? {
        id: "partner-profile",
        status: activePartner ? "ACTIVE" : "SUSPENDED",
        country: null,
        user: { country: "US" },
      } : null,
      findUnique: async () => ownerType === "partner" ? {
        id: "partner-profile",
        status: activePartner ? "ACTIVE" : "SUSPENDED",
        user: { country: "US" },
      } : null,
    },
    stripeConnectedAccount: {
      findUnique: async ({ where }: { where: Row }) => lookup(where),
      create: async ({ data }: { data: Row }) => {
        const row = { id: `sca-${++nextId}`, ...data };
        rows.push(row);
        return row;
      },
      update: async ({ where, data }: { where: Row; data: Row }) => {
        const row = lookup(where);
        if (!row) throw new Error("not found");
        Object.assign(row, data);
        return row;
      },
    },
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback({
      ...db,
      $executeRaw: async () => 1,
    }),
  };
  return { db, rows };
}

async function withOnboardingMode<T>(
  value: string | undefined,
  run: () => Promise<T> | T,
  approvedCountries: string | null = "KR",
  runtimeMode: string | null = "test",
  stripeSecretKey: string | null = "sk_test_connect_unit",
) {
  const previous = process.env.STRIPE_CONNECT_ONBOARDING_MODE;
  const previousApprovedCountries = process.env.STRIPE_CONNECT_APPROVED_ACCOUNT_COUNTRIES;
  const previousRuntimeMode = process.env.STRIPE_CONNECT_RUNTIME_MODE;
  const previousStripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (value === undefined) delete process.env.STRIPE_CONNECT_ONBOARDING_MODE;
  else process.env.STRIPE_CONNECT_ONBOARDING_MODE = value;
  if (approvedCountries === null) delete process.env.STRIPE_CONNECT_APPROVED_ACCOUNT_COUNTRIES;
  else process.env.STRIPE_CONNECT_APPROVED_ACCOUNT_COUNTRIES = approvedCountries;
  if (runtimeMode === null) delete process.env.STRIPE_CONNECT_RUNTIME_MODE;
  else process.env.STRIPE_CONNECT_RUNTIME_MODE = runtimeMode;
  if (stripeSecretKey === null) delete process.env.STRIPE_SECRET_KEY;
  else process.env.STRIPE_SECRET_KEY = stripeSecretKey;
  try {
    return await run();
  } finally {
    if (previous === undefined) delete process.env.STRIPE_CONNECT_ONBOARDING_MODE;
    else process.env.STRIPE_CONNECT_ONBOARDING_MODE = previous;
    if (previousApprovedCountries === undefined) delete process.env.STRIPE_CONNECT_APPROVED_ACCOUNT_COUNTRIES;
    else process.env.STRIPE_CONNECT_APPROVED_ACCOUNT_COUNTRIES = previousApprovedCountries;
    if (previousRuntimeMode === undefined) delete process.env.STRIPE_CONNECT_RUNTIME_MODE;
    else process.env.STRIPE_CONNECT_RUNTIME_MODE = previousRuntimeMode;
    if (previousStripeSecretKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = previousStripeSecretKey;
  }
}

test("Connect onboarding mode is fail-closed unless its raw value is exactly on", () => {
  assert.equal(getStripeConnectOnboardingMode(undefined), "off");
  assert.equal(getStripeConnectOnboardingMode("ON"), "off");
  assert.equal(getStripeConnectOnboardingMode(" on "), "off");
  assert.equal(getStripeConnectOnboardingMode("on"), "on");
});

test("Stripe Connect runtime mode is exact and fails closed", () => {
  assert.equal(getStripeConnectRuntimeMode(" live "), "live");
  assert.equal(getStripeConnectRuntimeMode(" test "), "test");
  for (const value of [undefined, "", "   ", "LIVE", "production", "sandbox", "on"]) {
    assert.equal(getStripeConnectRuntimeMode(value), null);
    assert.throws(() => assertStripeConnectRuntimeMode(value));
  }
});

test("Stripe Connect credential mode validation is exact and never includes key fragments in errors", () => {
  assert.equal(assertStripeCredentialMatchesRuntime({ runtimeMode: "live", secretKey: "sk_live_example" }), "live");
  assert.equal(assertStripeCredentialMatchesRuntime({ runtimeMode: "live", secretKey: "rk_live_example" }), "live");
  assert.equal(assertStripeCredentialMatchesRuntime({ runtimeMode: "test", secretKey: "sk_test_example" }), "test");
  assert.equal(assertStripeCredentialMatchesRuntime({ runtimeMode: "test", secretKey: "rk_test_example" }), "test");

  for (const [runtimeMode, secretKey] of [
    ["live", "sk_test_secret_fragment"],
    ["live", "rk_test_secret_fragment"],
    ["test", "sk_live_secret_fragment"],
    ["test", "rk_live_secret_fragment"],
    ["live", "pk_live_secret_fragment"],
    ["test", ""],
  ] as const) {
    assert.throws(
      () => assertStripeCredentialMatchesRuntime({ runtimeMode, secretKey }),
      (error: unknown) => {
        assert.equal(error instanceof Error ? error.message : "", "Stripe Connect runtime configuration is invalid.");
        assert.doesNotMatch(error instanceof Error ? error.message : "", /secret_fragment|sk_|rk_/);
        return true;
      },
    );
  }

  const previousStripeSecretKey = process.env.STRIPE_SECRET_KEY;
  try {
    delete process.env.STRIPE_SECRET_KEY;
    assert.throws(() => assertStripeCredentialMatchesRuntime({ runtimeMode: "test" }));
  } finally {
    if (previousStripeSecretKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = previousStripeSecretKey;
  }
});

test("country normalization is centralized and unsupported country values fail closed", () => {
  assert.equal(normalizeStripeConnectCountry("South Korea"), "KR");
  assert.equal(normalizeStripeConnectCountry("us"), "US");
  assert.equal(normalizeStripeConnectCountry("not-a-country"), null);
  assert.equal(assertStripeConnectCountry("KR"), "KR");
  assert.throws(() => assertStripeConnectCountry("not-a-country"));
});

test("approved account-country configuration is explicit, normalized, and fail-closed", () => {
  assert.deepEqual([...getApprovedStripeConnectAccountCountries(" us , kr ")].sort(), ["KR", "US"]);
  assert.deepEqual([...getApprovedStripeConnectAccountCountries(undefined)], []);
  assert.throws(() => getApprovedStripeConnectAccountCountries("KR, not-a-country"));
  assert.throws(() => getApprovedStripeConnectAccountCountries("KR, "));
});

test("seller onboarding creates one configured Connect account and never invokes money movement APIs", async () => {
  const { db, rows } = createFakeDb();
  const calls = { accounts: 0, links: 0, transfers: 0, payouts: 0, reversals: 0 };
  const idempotencyKeys: string[] = [];
  const accountLinkRequests: Record<string, unknown>[] = [];
  const stripe = {
    accounts: {
      create: async (params: Record<string, unknown>, options: Record<string, unknown>) => {
        calls.accounts += 1;
        idempotencyKeys.push(String(options.idempotencyKey));
        assert.deepEqual(params.controller, {
          fees: { payer: "application" },
          losses: { payments: "application" },
          requirement_collection: "stripe",
          stripe_dashboard: { type: "express" },
        });
        assert.deepEqual(params.capabilities, { transfers: { requested: true } });
        assert.equal(options.idempotencyKey, "trade82-connect-onboarding:seller:seller-company:v2");
        return fakeAccount("acct_seller");
      },
      retrieve: async () => fakeAccount("acct_seller"),
    },
    accountLinks: {
      create: async (params: Record<string, unknown>) => {
        calls.links += 1;
        accountLinkRequests.push(params);
        assert.equal(params.type, "account_onboarding");
        assert.equal(params.account, "acct_seller");
        assert.deepEqual(params.collection_options, { fields: "eventually_due" });
        return { url: "https://connect.stripe.test/link" };
      },
    },
    transfers: { create: () => { calls.transfers += 1; throw new Error("must not call"); } },
    payouts: { create: () => { calls.payouts += 1; throw new Error("must not call"); } },
    reversals: { create: () => { calls.reversals += 1; throw new Error("must not call"); } },
  };

  await withOnboardingMode("on", async () => {
    const first = await startStripeConnectOnboarding({ userId: "seller-owner", ownerType: "seller", db: db as never, stripe: stripe as never });
    const second = await startStripeConnectOnboarding({ userId: "seller-owner", ownerType: "seller", db: db as never, stripe: stripe as never });
    assert.equal(first.url, "https://connect.stripe.test/link");
    assert.equal(second.url, "https://connect.stripe.test/link");
  });
  assert.equal(calls.accounts, 1);
  assert.equal(calls.links, 2);
  assert.deepEqual(calls, { accounts: 1, links: 2, transfers: 0, payouts: 0, reversals: 0 });
  assert.deepEqual(idempotencyKeys, ["trade82-connect-onboarding:seller:seller-company:v2"]);
  assert.equal(accountLinkRequests.length, 2);
  assert.deepEqual(accountLinkRequests.map((request) => request.account), ["acct_seller", "acct_seller"]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.companyId, "seller-company");
  assert.equal(rows[0]?.url, undefined);
});

test("off mode does not call Stripe account or Account Link APIs", async () => {
  const { db } = createFakeDb();
  let calls = 0;
  const stripe = {
    accounts: { create: async () => { calls += 1; return fakeAccount("acct_never"); }, retrieve: async () => fakeAccount("acct_never") },
    accountLinks: { create: async () => { calls += 1; return { url: "https://connect.stripe.test/link" }; } },
  };
  await assert.rejects(() => withOnboardingMode("off", () => startStripeConnectOnboarding({
    userId: "seller-owner", ownerType: "seller", db: db as never, stripe: stripe as never,
  })));
  assert.equal(calls, 0);
});

test("Stripe account creation requires both exact-on mode and explicit platform country approval", async () => {
  const { db } = createFakeDb();
  const calls = { accounts: 0, links: 0 };
  const stripe = {
    accounts: { create: async () => { calls.accounts += 1; return fakeAccount("acct_never"); }, retrieve: async () => fakeAccount("acct_never") },
    accountLinks: { create: async () => { calls.links += 1; return { url: "https://connect.stripe.test/link" }; } },
  };
  const start = () => startStripeConnectOnboarding({
    userId: "seller-owner", ownerType: "seller", db: db as never, stripe: stripe as never,
  });

  await assert.rejects(() => withOnboardingMode("on", start, null));
  await assert.rejects(() => withOnboardingMode("on", start, "US"));
  await assert.rejects(() => withOnboardingMode("on", start, "KR, invalid"));
  assert.deepEqual(calls, { accounts: 0, links: 0 });

  await withOnboardingMode("on", start, " kr ");
  assert.deepEqual(calls, { accounts: 1, links: 1 });
});

test("Stripe onboarding requires matching runtime and credential gates before any Stripe API call", async () => {
  const cases = [
    { runtimeMode: null, stripeSecretKey: "sk_test_connect_unit" },
    { runtimeMode: "LIVE", stripeSecretKey: "sk_live_connect_unit" },
    { runtimeMode: "live", stripeSecretKey: "sk_test_connect_unit" },
    { runtimeMode: "test", stripeSecretKey: "sk_live_connect_unit" },
    { runtimeMode: "test", stripeSecretKey: null },
  ] as const;

  for (const config of cases) {
    const { db } = createFakeDb();
    const calls = { accounts: 0, links: 0 };
    const stripe = {
      accounts: { create: async () => { calls.accounts += 1; return fakeAccount("acct_never"); }, retrieve: async () => fakeAccount("acct_never") },
      accountLinks: { create: async () => { calls.links += 1; return { url: "https://connect.stripe.test/link" }; } },
    };
    await assert.rejects(() => withOnboardingMode("on", () => startStripeConnectOnboarding({
      userId: "seller-owner", ownerType: "seller", db: db as never, stripe: stripe as never,
    }), "KR", config.runtimeMode, config.stripeSecretKey));
    assert.deepEqual(calls, { accounts: 0, links: 0 });
  }

  const { db } = createFakeDb();
  const calls = { accounts: 0, links: 0 };
  const stripe = {
    accounts: { create: async () => { calls.accounts += 1; return fakeAccount("acct_live"); }, retrieve: async () => fakeAccount("acct_live") },
    accountLinks: { create: async () => { calls.links += 1; return { url: "https://connect.stripe.test/link" }; } },
  };
  await withOnboardingMode("on", () => startStripeConnectOnboarding({
    userId: "seller-owner", ownerType: "seller", db: db as never, stripe: stripe as never,
  }), "KR", "live", "sk_live_connect_unit");
  assert.deepEqual(calls, { accounts: 1, links: 1 });
});

test("Stripe account retrieval requires matching runtime and credential gates before any Stripe API call", async () => {
  const cases = [
    { runtimeMode: null, stripeSecretKey: "sk_test_connect_unit" },
    { runtimeMode: "test", stripeSecretKey: "sk_live_connect_unit" },
    { runtimeMode: "live", stripeSecretKey: null },
  ] as const;

  for (const config of cases) {
    const { db, rows } = createFakeDb();
    rows.push({
      id: "sca-existing",
      companyId: "seller-company",
      stripeAccountId: "acct_existing",
      status: "PENDING",
      chargesEnabled: false,
      payoutsEnabled: false,
      transfersEnabled: false,
      detailsSubmitted: false,
      onboardingComplete: false,
    });
    let retrieveCalls = 0;
    const stripe = {
      accounts: {
        create: async () => fakeAccount("acct_never"),
        retrieve: async () => {
          retrieveCalls += 1;
          return fakeAccount("acct_existing");
        },
      },
      accountLinks: { create: async () => ({ url: "https://connect.stripe.test/link" }) },
    };

    await assert.rejects(() => withOnboardingMode("on", () => returnFromStripeConnectOnboarding({
      userId: "seller-owner", ownerType: "seller", db: db as never, stripe: stripe as never,
    }), "KR", config.runtimeMode, config.stripeSecretKey));
    assert.equal(retrieveCalls, 0);
  }
});

test("owner checks deny buyers, non-owners, and inactive partners", async () => {
  const sellerOnly = createFakeDb({ ownerType: "seller" });
  await assert.rejects(() => getStripeConnectOnboardingStatus({ userId: "buyer", ownerType: "partner", db: sellerOnly.db as never }));
  const inactivePartner = createFakeDb({ ownerType: "partner", activePartner: false });
  await assert.rejects(() => getStripeConnectOnboardingStatus({ userId: "partner", ownerType: "partner", db: inactivePartner.db as never }));
});

test("an active partner can start onboarding without a seller or buyer company", async () => {
  const { db, rows } = createFakeDb({ ownerType: "partner" });
  const stripe = {
    accounts: {
      create: async (_params: Record<string, unknown>, options: Record<string, unknown>) => {
        assert.equal(options.idempotencyKey, "trade82-connect-onboarding:partner:partner-profile:v2");
        return fakeAccount("acct_partner");
      },
      retrieve: async () => fakeAccount("acct_partner"),
    },
    accountLinks: { create: async () => ({ url: "https://connect.stripe.test/partner-link" }) },
  };

  await withOnboardingMode("on", () => startStripeConnectOnboarding({
    userId: "partner-owner",
    ownerType: "partner",
    db: db as never,
    stripe: stripe as never,
  }), "US");
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.partnerProfileId, "partner-profile");
  assert.equal(rows[0]?.companyId, undefined);
});

test("Stripe-shaped account states classify temporary restrictions without blocking onboarding", () => {
  const requirements = (overrides: Record<string, unknown> = {}) => ({
    currently_due: [], past_due: [], pending_verification: [], disabled_reason: null, ...overrides,
  });
  const pending = mapStripeConnectedAccount(fakeAccount("acct_pending", {
    requirements: requirements({ disabled_reason: "requirements.past_due", past_due: ["external_account"] }),
  }) as never);
  assert.equal(pending.status, "PENDING");
  assert.equal(canContinueStripeConnectOnboarding(pending), true);

  const submittedOutstanding = mapStripeConnectedAccount(fakeAccount("acct_outstanding", {
    details_submitted: true, requirements: requirements({ currently_due: ["business_profile.url"] }),
  }) as never);
  assert.equal(submittedOutstanding.status, "RESTRICTED");
  assert.equal(canContinueStripeConnectOnboarding(submittedOutstanding), true);

  const pendingVerification = mapStripeConnectedAccount(fakeAccount("acct_verification", {
    details_submitted: true, requirements: requirements({ pending_verification: ["individual.verification.document"] }),
  }) as never);
  assert.equal(pendingVerification.status, "RESTRICTED");

  const inactiveTransfers = mapStripeConnectedAccount(fakeAccount("acct_transfer", {
    details_submitted: true, payouts_enabled: true, requirements: requirements(),
  }) as never);
  assert.equal(inactiveTransfers.status, "RESTRICTED");

  const payoutsUnavailable = mapStripeConnectedAccount(fakeAccount("acct_payout", {
    details_submitted: true, capabilities: { transfers: "active" }, requirements: requirements(),
  }) as never);
  assert.equal(payoutsUnavailable.status, "RESTRICTED");

  const permanentlyRejected = mapStripeConnectedAccount(fakeAccount("acct_rejected", {
    details_submitted: true, requirements: requirements({ disabled_reason: "rejected.fraud" }),
  }) as never);
  assert.equal(permanentlyRejected.status, "DISABLED");
  assert.equal(canContinueStripeConnectOnboarding(permanentlyRejected), false);

  const unknownDisabledReason = mapStripeConnectedAccount(fakeAccount("acct_unknown", {
    details_submitted: true, requirements: requirements({ disabled_reason: "platform_new_reason" }),
  }) as never);
  assert.equal(unknownDisabledReason.status, "RESTRICTED");
  assert.equal(classifyStripeConnectDisabledReason("requirements.past_due"), "temporary");
  assert.equal(classifyStripeConnectDisabledReason("rejected.fraud"), "terminal");
  assert.equal(classifyStripeConnectDisabledReason("platform_new_reason"), "unknown");

  const enabled = mapStripeConnectedAccount(fakeAccount("acct_enabled", {
    details_submitted: true, payouts_enabled: true, capabilities: { transfers: "active" }, requirements: requirements(),
  }) as never);
  assert.equal(enabled.status, "ENABLED");
  assert.equal(enabled.onboardingComplete, true);
  assert.equal(canContinueStripeConnectOnboarding(enabled), false);
});

test("Connect account.updated webhooks ignore unknown accounts and idempotently update known accounts", async () => {
  const unknown = createFakeDb();
  const ignored = await processStripeConnectWebhookEvent({ type: "account.updated", data: { object: fakeAccount("acct_unknown") } } as never, { db: unknown.db as never });
  assert.deepEqual(ignored, { handled: true, found: false, updated: false });

  const known = createFakeDb();
  known.rows.push({ id: "sca-known", companyId: "seller-company", stripeAccountId: "acct_known", status: "PENDING", chargesEnabled: false, payoutsEnabled: false, transfersEnabled: false, detailsSubmitted: false, onboardingComplete: false });
  const event = { id: "evt_known", type: "account.updated", livemode: false, data: { object: fakeAccount("acct_known", { details_submitted: true, payouts_enabled: true, capabilities: { transfers: "active" }, requirements: { currently_due: [], past_due: [], pending_verification: [], disabled_reason: null } }) } } as never;
  const stripe = { webhooks: { constructEvent: () => event } };
  await withOnboardingMode("on", async () => {
    const response = await handleStripeConnectWebhookRequest({
      payload: "signed payload",
      signature: "signature",
      webhookSecret: "whsec_unit",
      stripe: stripe as never,
      processEvent: (incomingEvent) => processStripeConnectWebhookEvent(incomingEvent, { db: known.db as never }),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { received: true, handled: true });
  });
  assert.equal((await processStripeConnectWebhookEvent(event, { db: known.db as never })).updated, false);
  assert.equal(known.rows[0]?.status, "ENABLED");
});

test("Connect webhook runtime isolation acknowledges mismatches without invoking processing", async () => {
  const event = { id: "evt_test", type: "account.updated", livemode: false, data: { object: fakeAccount("acct_test") } } as never;
  const stripe = { webhooks: { constructEvent: () => event } };
  let processCalls = 0;
  const logs: unknown[] = [];

  await withOnboardingMode("on", async () => {
    const response = await handleStripeConnectWebhookRequest({
      payload: "signed payload",
      signature: "signature",
      webhookSecret: "whsec_unit",
      stripe: stripe as never,
      processEvent: async () => {
        processCalls += 1;
        return { handled: true, found: true, updated: true };
      },
      logRuntimeMismatch: (entry) => logs.push(entry),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { received: true, handled: false });
  }, "KR", "live", "sk_live_connect_unit");
  assert.equal(processCalls, 0);
  assert.deepEqual(logs, [{
    stripeEventId: "evt_test",
    stripeEventType: "account.updated",
    eventLivemode: false,
    configuredRuntimeMode: "live",
    reason: "stripe_connect_runtime_mismatch",
  }]);
});

test("Connect webhook only processes matching runtime events and fails closed for invalid runtime configuration", async () => {
  const event = { id: "evt_live", type: "account.updated", livemode: true, data: { object: fakeAccount("acct_live") } } as never;
  const stripe = { webhooks: { constructEvent: () => event } };
  let processCalls = 0;
  const processEvent = async () => {
    processCalls += 1;
    return { handled: true, found: true, updated: true } as const;
  };

  await withOnboardingMode("on", async () => {
    const response = await handleStripeConnectWebhookRequest({
      payload: "signed payload", signature: "signature", webhookSecret: "whsec_unit", stripe: stripe as never, processEvent,
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { received: true, handled: true });
  }, "KR", "live", "sk_live_connect_unit");
  assert.equal(processCalls, 1);

  for (const runtimeMode of [null, "LIVE"]) {
    const response = await withOnboardingMode("on", () => handleStripeConnectWebhookRequest({
      payload: "signed payload", signature: "signature", webhookSecret: "whsec_unit", stripe: stripe as never, processEvent,
    }), "KR", runtimeMode, "sk_live_connect_unit");
    assert.equal(response.status, 503);
  }
  assert.equal(processCalls, 1);
});

test("Connect webhook test runtime ignores live events without invoking processing", async () => {
  const event = { id: "evt_live_in_test", type: "account.updated", livemode: true, data: { object: fakeAccount("acct_live") } } as never;
  const stripe = { webhooks: { constructEvent: () => event } };
  let processCalls = 0;

  await withOnboardingMode("on", async () => {
    const response = await handleStripeConnectWebhookRequest({
      payload: "signed payload",
      signature: "signature",
      webhookSecret: "whsec_unit",
      stripe: stripe as never,
      processEvent: async () => {
        processCalls += 1;
        return { handled: true, found: true, updated: true };
      },
      logRuntimeMismatch: () => undefined,
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { received: true, handled: false });
  });
  assert.equal(processCalls, 0);
});

test("Connect webhook preserves invalid-signature handling and safely acknowledges unsupported matching events", async () => {
  const signatureFailure = Object.assign(new Error("bad signature"), { name: "StripeSignatureVerificationError" });
  const invalidSignature = await handleStripeConnectWebhookRequest({
    payload: "invalid", signature: "signature", webhookSecret: "whsec_unit",
    stripe: { webhooks: { constructEvent: () => { throw signatureFailure; } } } as never,
  });
  assert.equal(invalidSignature.status, 400);

  const event = { id: "evt_unsupported", type: "account.external_account.created", livemode: false, data: { object: {} } } as never;
  await withOnboardingMode("on", async () => {
    const response = await handleStripeConnectWebhookRequest({
      payload: "signed payload", signature: "signature", webhookSecret: "whsec_unit",
      stripe: { webhooks: { constructEvent: () => event } } as never,
      processEvent: async () => ({ handled: false, found: false, updated: false }),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { received: true, handled: false });
  });
});
