import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import {
  PartnerProfileStatus,
  ReferralAttributionStatus,
  SettlementLegStatus,
  SettlementReversalStatus,
} from "../src/generated/prisma/client.ts";
import {
  createReferralClaimForCode,
  createReferralClaimSecret,
  hashReferralClaimToken,
  normalizeReferralCode,
} from "../src/lib/partner-referrals.ts";
import { getPartnerProgramMode } from "../src/lib/partner-program-feature.ts";
import { attemptAnonymousReferralClaim } from "../src/lib/referral-claim-request.ts";
import {
  applyReferralClaimCookie,
  getReferralClaimCookieOptions,
} from "../src/lib/referral-claim-response.ts";
import { getPublicNavigationLinks } from "../src/lib/public-navigation.ts";
import {
  getPartnerDashboardData,
  partnerCommissionPresentation,
  partnerLegStatus,
  partnerPayoutSetupStatus,
  partnerProfileStatus,
} from "../src/lib/partner-dashboard.ts";

test("partner program mode is explicitly opt-in and otherwise fails closed", () => {
  assert.equal(getPartnerProgramMode(undefined), "off");
  assert.equal(getPartnerProgramMode(""), "off");
  assert.equal(getPartnerProgramMode("true"), "off");
  assert.equal(getPartnerProgramMode("enabled"), "off");
  assert.equal(getPartnerProgramMode("ON"), "off");
  assert.equal(getPartnerProgramMode(" on "), "on");
});

test("feature-off navigation omits Partner while an exact opt-in includes it", () => {
  assert.equal(
    getPublicNavigationLinks(false).some((link) => link.href === "/partner"),
    false,
  );
  assert.equal(
    getPublicNavigationLinks(getPartnerProgramMode(" on ") === "on").some(
      (link) => link.href === "/partner",
    ),
    true,
  );
  assert.equal(
    getPublicNavigationLinks(getPartnerProgramMode("ON") === "on").some(
      (link) => link.href === "/partner",
    ),
    false,
  );
});

test("referral codes are normalized without accepting malformed input", () => {
  assert.equal(normalizeReferralCode("  t82-ab_cd09  "), "T82-AB_CD09");
  assert.equal(normalizeReferralCode("short"), null);
  assert.equal(normalizeReferralCode("T82-INVALID!"), null);
});

test("claim secrets have 32 random bytes and only their hash is persisted", async () => {
  const secret = createReferralClaimSecret();
  assert.match(secret, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(secret, createReferralClaimSecret());
  const writes: unknown[] = [];
  const previous = process.env.PARTNER_PROGRAM_MODE;
  process.env.PARTNER_PROGRAM_MODE = "on";
  try {
    const created = await createReferralClaimForCode(
      {
        partnerProfile: {
          findUnique: async () => ({
            id: "partner-1",
            status: PartnerProfileStatus.ACTIVE,
          }),
        },
        referralClaimToken: {
          create: async ({ data }) => {
            writes.push(data);
          },
        },
      },
      "T82-PARTNER_123",
    );
    assert.ok(created);
    assert.equal(writes.length, 1);
    const write = writes[0] as { tokenHash: string; expiresAt: Date };
    assert.equal(write.tokenHash, hashReferralClaimToken(created));
    assert.notEqual(write.tokenHash, created);
    assert.equal(
      write.expiresAt.getTime() - Date.now() > 29 * 24 * 60 * 60 * 1000,
      true,
    );
  } finally {
    if (previous === undefined) delete process.env.PARTNER_PROGRAM_MODE;
    else process.env.PARTNER_PROGRAM_MODE = previous;
  }
});

test("inactive partner codes produce no claim token", async () => {
  const previous = process.env.PARTNER_PROGRAM_MODE;
  process.env.PARTNER_PROGRAM_MODE = "on";
  try {
    const result = await createReferralClaimForCode(
      {
        partnerProfile: {
          findUnique: async () => ({
            id: "partner-1",
            status: PartnerProfileStatus.SUSPENDED,
          }),
        },
        referralClaimToken: {
          create: async () => assert.fail("claim should not be stored"),
        },
      },
      "T82-PARTNER_123",
    );
    assert.equal(result, null);
  } finally {
    if (previous === undefined) delete process.env.PARTNER_PROGRAM_MODE;
    else process.env.PARTNER_PROGRAM_MODE = previous;
  }
});

test("rate-limited referral requests never create claim records", async () => {
  const result = await attemptAnonymousReferralClaim({
    request: new Request("https://trade82.test/r/T82-PARTNER_123", {
      headers: { "x-forwarded-for": "203.0.113.7" },
    }),
    referralCode: "T82-PARTNER_123",
    createClaim: async () =>
      assert.fail("claim creation must not run after rate limiting"),
    rateLimitCheck: () => ({ allowed: false }),
  });
  assert.deepEqual(result, { rawToken: null, rateLimited: true });
});

test("referral redirects replace valid claim cookies and expire stale claim cookies", () => {
  const stored: Array<Record<string, unknown>> = [];
  const response = {
    cookies: {
      set: (cookie: Record<string, unknown>) => stored.push(cookie),
    },
  };

  applyReferralClaimCookie({ response, rawToken: "valid-claim-token" });
  assert.deepEqual(stored.pop(), {
    name: "trade82_referral_claim",
    value: "valid-claim-token",
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });

  applyReferralClaimCookie({ response, rawToken: null });
  assert.deepEqual(stored.pop(), {
    name: "trade82_referral_claim",
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 0,
  });

  assert.equal(getReferralClaimCookieOptions("production").secure, true);
});

test("partner commission presentation only applies approved adjustment states", () => {
  const result = partnerCommissionPresentation({
    id: "leg-1",
    amount: 500,
    currency: "usd",
    status: SettlementLegStatus.READY,
    holdUntil: new Date(),
    settlement: {
      createdAt: new Date(),
      grossAmount: 100_000,
      tradeOrder: { orderNumber: "T82-1" },
    },
    reversals: [
      { amount: 100, status: SettlementReversalStatus.ACCOUNTING_APPLIED },
      { amount: 50, status: SettlementReversalStatus.PENDING },
    ],
  });
  assert.deepEqual(result, {
    grossAmount: 500,
    adjustmentAmount: 150,
    netAmount: 350,
    usableAmount: 350,
    status: "available",
  });
  assert.equal(partnerLegStatus(SettlementLegStatus.TRANSFERRED), "paid");
  assert.equal(
    partnerLegStatus(SettlementLegStatus.REVERSAL_PENDING),
    "under_review",
  );
  assert.equal(ReferralAttributionStatus.LOCKED, "LOCKED");
});

test("partner payout and profile states use stable localized presentation keys", () => {
  assert.equal(partnerProfileStatus("ACTIVE"), "active");
  assert.equal(partnerProfileStatus("SUSPENDED"), "suspended");
  assert.equal(partnerPayoutSetupStatus(null), "notStarted");
  assert.equal(
    partnerPayoutSetupStatus({ status: "PENDING", onboardingComplete: false }),
    "pending",
  );
  assert.equal(
    partnerPayoutSetupStatus({
      status: "RESTRICTED",
      onboardingComplete: true,
    }),
    "restricted",
  );
  assert.equal(
    partnerPayoutSetupStatus({ status: "ENABLED", onboardingComplete: true }),
    "enabled",
  );
  assert.equal(
    partnerPayoutSetupStatus({ status: "DISABLED", onboardingComplete: false }),
    "disabled",
  );
});

test("feature-off dashboard access returns before any database query", async () => {
  const result = await getPartnerDashboardData({
    partnerProfileId: "partner-1",
    partnerProgramEnabled: false,
    getDatabase: (() =>
      assert.fail("dashboard must not query while feature is off")) as never,
  });
  assert.equal(result, null);
});

test("partner claim migration is additive, indexed, restrictive, and never stores raw claim evidence", async () => {
  const migration = await readFile(
    new URL(
      "../prisma/migrations/20260716150000_add_partner_program_referral_claims/migration.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(migration, /CREATE TABLE "ReferralClaimToken"/);
  assert.match(migration, /"tokenHash" TEXT NOT NULL/);
  assert.match(migration, /"ReferralClaimToken_tokenHash_key"/);
  assert.match(
    migration,
    /"ReferralClaimToken_partnerProfileId_expiresAt_idx"/,
  );
  assert.match(migration, /ON DELETE RESTRICT/);
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  assert.match(
    migration,
    /REVOKE ALL PRIVILEGES ON TABLE "ReferralClaimToken" FROM anon, authenticated/,
  );
  assert.doesNotMatch(migration, /^\s*(DROP|DELETE FROM|TRUNCATE)\b/m);
});

test("partner routes clear stale claims and gate active functionality server-side", async () => {
  const referralRoute = await readFile(
    new URL("../src/app/r/[referralCode]/route.ts", import.meta.url),
    "utf8",
  );
  const landingPage = await readFile(
    new URL("../src/app/partner/page.tsx", import.meta.url),
    "utf8",
  );
  const dashboardPage = await readFile(
    new URL("../src/app/partner/dashboard/page.tsx", import.meta.url),
    "utf8",
  );
  const dashboardData = await readFile(
    new URL("../src/lib/partner-dashboard.ts", import.meta.url),
    "utf8",
  );
  const authz = await readFile(
    new URL("../src/lib/authz.ts", import.meta.url),
    "utf8",
  );

  assert.match(referralRoute, /attemptAnonymousReferralClaim/);
  assert.match(referralRoute, /applyReferralClaimCookie/);
  assert.match(
    landingPage,
    /if \(!isPartnerProgramEnabled\(\)\)\s+return <PartnerProgramLanding state="unavailable" \/>;/,
  );
  assert.match(
    dashboardPage,
    /if \(!isPartnerProgramEnabled\(\)\)\s+return <PartnerProgramLanding state="unavailable" \/>;/,
  );
  assert.match(dashboardData, /if \(!partnerProgramEnabled\) return null;/);
  assert.match(dashboardData, /type: SettlementLegType\.PARTNER_REFERRAL/);
  assert.match(
    authz,
    /if \(existingByClerkId\) \{\s*return await updateExistingProfile\(existingByClerkId\);\s*\}/,
  );
  assert.match(
    authz,
    /if \(existingByEmail\) \{[\s\S]*?return await updateExistingProfile\(existingByEmail\);\s*\}/,
  );
  assert.doesNotMatch(
    dashboardData,
    /paymentMethod|stripeSecret|bankAccount|email:/,
  );
});
