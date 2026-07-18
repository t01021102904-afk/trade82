import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, test } from "node:test";

import { PrismaClient } from "../src/generated/prisma/client.ts";

function assertDisposableDatabase() {
  const value = process.env.DATABASE_URL;
  assert.ok(value, "DATABASE_URL is required for the disposable integration suite.");
  const url = new URL(value);
  assert.ok(["127.0.0.1", "localhost"].includes(url.hostname), "The integration database must be localhost only.");
  assert.match(url.pathname.slice(1), /^trade82_order_payout_test_/, "The integration database name is not disposable.");
}

assertDisposableDatabase();
process.env.DATABASE_POOL_MAX = "4";

const { getDb } = await import(new URL("../src/lib/db.ts", import.meta.url).href);
const onboarding = await import(new URL("../src/lib/stripe-connect-onboarding.ts", import.meta.url).href);
const enrollment = await import(new URL("../src/lib/partner-enrollment.ts", import.meta.url).href);
const webhook = await import(new URL("../src/lib/stripe-connect-onboarding-webhook.ts", import.meta.url).href);
const db = getDb() as PrismaClient;

after(async () => {
  await db.$disconnect();
});

function suffix() {
  return randomBytes(8).toString("hex");
}

function account(id: string, complete = false) {
  return {
    id,
    object: "account",
    charges_enabled: false,
    payouts_enabled: complete,
    details_submitted: complete,
    capabilities: { transfers: complete ? "active" : "inactive" },
    requirements: { currently_due: complete ? [] : ["external_account"], past_due: [], pending_verification: [], disabled_reason: null },
  };
}

test("disposable PostgreSQL enforces connected-account owner XOR and supports idempotent account state sync", async () => {
  const id = suffix();
  const [sellerUser, partnerUser] = await Promise.all([
    db.userProfile.create({ data: { clerkUserId: `connect-seller-${id}`, email: `connect-seller-${id}@example.test`, displayName: "Connect seller", country: "KR", role: "seller" } }),
    db.userProfile.create({ data: { clerkUserId: `connect-partner-${id}`, email: `connect-partner-${id}@example.test`, displayName: "Connect partner", country: "US", role: "user" } }),
  ]);
  const [company, partner] = await Promise.all([
    db.company.create({ data: { ownerUserId: sellerUser.id, companyRole: "seller", legalName: `Connect Seller ${id}`, country: "KR", city: "Seoul", businessAddress: "Seoul" } }),
    db.partnerProfile.create({ data: { userId: partnerUser.id, referralCode: `CONNECT${id.slice(0, 8).toUpperCase()}`, status: "ACTIVE" } }),
  ]);

  const previous = process.env.STRIPE_CONNECT_ONBOARDING_MODE;
  const previousApprovedCountries = process.env.STRIPE_CONNECT_APPROVED_ACCOUNT_COUNTRIES;
  const previousRuntimeMode = process.env.STRIPE_CONNECT_RUNTIME_MODE;
  const previousStripeSecretKey = process.env.STRIPE_SECRET_KEY;
  process.env.STRIPE_CONNECT_ONBOARDING_MODE = "on";
  process.env.STRIPE_CONNECT_APPROVED_ACCOUNT_COUNTRIES = "KR";
  process.env.STRIPE_CONNECT_RUNTIME_MODE = "test";
  process.env.STRIPE_SECRET_KEY = "sk_test_connect_integration";
  const idempotencyKeys: string[] = [];
  const accountLinkRequests: Record<string, unknown>[] = [];
  const stripe = {
    accounts: {
      create: async (_params: unknown, options: { idempotencyKey?: string }) => {
        idempotencyKeys.push(options.idempotencyKey ?? "");
        return account(`acct_connect_${id}`);
      },
      retrieve: async () => account(`acct_connect_${id}`, true),
    },
    accountLinks: {
      create: async (params: Record<string, unknown>) => {
        accountLinkRequests.push(params);
        return { url: "https://connect.stripe.test/onboarding" };
      },
    },
  };
  try {
    await Promise.all([
      onboarding.startStripeConnectOnboarding({ userId: sellerUser.id, ownerType: "seller", db, stripe }),
      onboarding.startStripeConnectOnboarding({ userId: sellerUser.id, ownerType: "seller", db, stripe }),
    ]);
    const stored = await db.stripeConnectedAccount.findUniqueOrThrow({ where: { companyId: company.id } });
    assert.equal(stored.stripeAccountId, `acct_connect_${id}`);
    assert.equal(await db.stripeConnectedAccount.count({ where: { companyId: company.id } }), 1);
    assert.deepEqual(
      idempotencyKeys,
      [
        "trade82-connect-onboarding:seller:" + company.id + ":v2",
        "trade82-connect-onboarding:seller:" + company.id + ":v2",
      ],
    );
    assert.equal(accountLinkRequests.length, 2);
    for (const request of accountLinkRequests) {
      assert.equal(request.account, stored.stripeAccountId);
      assert.equal(request.type, "account_onboarding");
      assert.equal(typeof request.refresh_url, "string");
      assert.equal(typeof request.return_url, "string");
      assert.deepEqual(request.collection_options, { fields: "eventually_due" });
    }
    const event = { type: "account.updated", data: { object: account(stored.stripeAccountId, true) } } as never;
    assert.equal((await webhook.processStripeConnectWebhookEvent(event, { db })).updated, true);
    assert.equal((await webhook.processStripeConnectWebhookEvent(event, { db })).updated, false);
    assert.equal((await db.stripeConnectedAccount.findUniqueOrThrow({ where: { id: stored.id } })).status, "ENABLED");

    await assert.rejects(() => db.$executeRawUnsafe(
      'INSERT INTO "StripeConnectedAccount" ("id", "companyId", "partnerProfileId", "stripeAccountId", "status", "updatedAt") VALUES ($1, $2, $3, $4, $5, NOW())',
      `xor-${id}`, company.id, partner.id, `acct_xor_${id}`, "PENDING",
    ));
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
});

test("disposable PostgreSQL stores one partner enrollment with private consent evidence", async () => {
  const id = suffix();
  const user = await db.userProfile.create({
    data: {
      clerkUserId: `partner-enrollment-${id}`,
      email: `partner-enrollment-${id}@example.test`,
      displayName: "Partner enrollment",
      country: "US",
      role: "user",
    },
  });
  const input = {
    legalName: "Partner Enrollment LLC",
    displayName: "Partner Enrollment",
    email: `partner-contact-${id}@example.test`,
    phone: "+1 (212) 555-0199",
    country: "United States",
    preferredLanguage: "en" as const,
    organizationName: "Partner Organization",
    websiteOrSocialUrl: "https://example.test/partner",
    promotionDescription: "Qualified B2B referral outreach.",
    agreeToTerms: true,
    acknowledgePrivacy: true,
  };
  const first = await enrollment.enrollPartnerProfile({ userId: user.id, input, db });
  const repeated = await enrollment.enrollPartnerProfile({ userId: user.id, input, db });
  const profile = await db.partnerProfile.findUniqueOrThrow({ where: { userId: user.id } });

  assert.equal(first.created, true);
  assert.equal(repeated.created, false);
  assert.equal(await db.partnerProfile.count({ where: { userId: user.id } }), 1);
  assert.equal(profile.contactEmail, input.email);
  assert.equal(profile.contactPhone, "+12125550199");
  assert.equal(profile.termsConsentVersion, enrollment.partnerConsentVersions.terms);
  assert.ok(profile.termsConsentedAt);
  assert.equal(profile.privacyConsentVersion, enrollment.partnerConsentVersions.privacy);
  assert.ok(profile.privacyConsentedAt);
  assert.equal(
    await db.stripeConnectedAccount.count({ where: { partnerProfileId: profile.id } }),
    0,
  );
});
