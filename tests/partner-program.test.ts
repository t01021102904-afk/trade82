import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import {
  PartnerProfileStatus,
  PartnerPayoutProfileStatus,
  ReferralAttributionStatus,
  SettlementLegStatus,
  SettlementReversalStatus,
} from "../src/generated/prisma/client.ts";
import {
  consumeReferralClaimForNewUser,
  createOrGetPartnerProfile,
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
import {
  getPublicNavigationLinks,
  isPartnerOnlyAccount,
  isPartnerOnlyNavigationAccount,
} from "../src/lib/public-navigation.ts";
import {
  getPartnerDashboardData,
  partnerCommissionPresentation,
  partnerLegStatus,
  partnerPayoutSetupStatus,
  partnerProfileStatus,
} from "../src/lib/partner-dashboard.ts";
import {
  partnerPayoutProfileAdminSummarySelect,
  partnerPayoutProfileOwnerSelect,
} from "../src/lib/partner-payout-profiles.ts";
import {
  getPartnerLifecycleTransition,
} from "../src/lib/partner-lifecycle.ts";
import {
  normalizePartnerEnrollment,
  normalizePartnerPhone,
  partnerConsentVersions,
} from "../src/lib/partner-enrollment.ts";

test("partner program mode is explicitly opt-in and otherwise fails closed", () => {
  assert.equal(getPartnerProgramMode(undefined), "off");
  assert.equal(getPartnerProgramMode(""), "off");
  assert.equal(getPartnerProgramMode("true"), "off");
  assert.equal(getPartnerProgramMode("enabled"), "off");
  assert.equal(getPartnerProgramMode("ON"), "off");
  assert.equal(getPartnerProgramMode(" on "), "on");
});

test("partner enrollment form has translations for every static partnerProgram key", async () => {
  const form = await readFile(
    new URL("../src/components/partner-enrollment-form.tsx", import.meta.url),
    "utf8",
  );
  const keys = [...form.matchAll(/t\("partnerProgram\.([A-Za-z0-9_]+)"\)/g)]
    .map((match) => match[1])
    .filter((key, index, all) => all.indexOf(key) === index);
  const english = JSON.parse(await readFile(new URL("../messages/en.json", import.meta.url), "utf8"));
  const korean = JSON.parse(await readFile(new URL("../messages/ko.json", import.meta.url), "utf8"));

  assert.ok(keys.length > 0);
  for (const key of keys) {
    assert.equal(typeof english.partnerProgram[key], "string", `missing English key: ${key}`);
    assert.equal(typeof korean.partnerProgram[key], "string", `missing Korean key: ${key}`);
    assert.notEqual(english.partnerProgram[key], `partnerProgram.${key}`);
    assert.notEqual(korean.partnerProgram[key], `partnerProgram.${key}`);
  }
});

test("public navigation keeps Partner Program out of the global navigation", () => {
  const links = getPublicNavigationLinks() as readonly { href: string; labelKey: string }[];
  assert.deepEqual(links, [
    { href: "/marketplace", labelKey: "nav.marketplace" },
    { href: "/sellers", labelKey: "nav.sellers" },
  ]);
  assert.equal(links.some((link) => link.href === "/partner"), false);
});

test("public headers and footer keep Partner Program links out", async () => {
  const headerSource = await readFile(
    new URL("../src/components/site-header.tsx", import.meta.url),
    "utf8",
  );
  const footerSource = await readFile(
    new URL("../src/components/site-footer.tsx", import.meta.url),
    "utf8",
  );
  const english = JSON.parse(
    await readFile(new URL("../messages/en.json", import.meta.url), "utf8"),
  ) as { nav: Record<string, string>; footer: Record<string, string> };
  const korean = JSON.parse(
    await readFile(new URL("../messages/ko.json", import.meta.url), "utf8"),
  ) as { nav: Record<string, string>; footer: Record<string, string> };

  assert.equal(english.nav.partnerProgram, "Partner Program");
  assert.equal(korean.nav.partnerProgram, "파트너 프로그램");
  assert.equal(english.footer.partnerProgram, "Partner Program");
  assert.equal(korean.footer.partnerProgram, "파트너 프로그램");
  assert.match(headerSource, /href=\{withLocale\(link\.href, locale\)\}/);
  assert.doesNotMatch(footerSource, /withLocale\("\/partner", locale\)/);
  assert.match(headerSource, /isPartnerOnlyNavigationAccount/);
  assert.match(headerSource, /partnerProfile: context\?\.partnerProfile/);
  assert.match(headerSource, /nav\.partnerDashboard/);
  assert.match(headerSource, /\/partner\/dashboard/);
  assert.match(headerSource, /\.\.\.\(isPartnerOnly \? \[\] : appLinks\)/);
  assert.match(headerSource, /visibleNavLinks\.map/);
});

test("partner-only navigation requires the server-backed user context", () => {
  const partnerProfile = { id: "partner-1" };
  const noCompanies: Array<{ companyRole: "seller" | "buyer" }> = [];
  assert.equal(
    isPartnerOnlyNavigationAccount({
      isSignedIn: true,
      role: "user",
      partnerProfile,
      companies: noCompanies,
    }),
    true,
  );

  for (const status of ["ACTIVE", "SUSPENDED", "REJECTED", "PENDING_REVIEW"]) {
    assert.equal(
      isPartnerOnlyNavigationAccount({
        isSignedIn: true,
        role: "user",
        partnerProfile: { id: `partner-${status}` },
        companies: noCompanies,
      }),
      true,
    );
  }

  for (const role of ["user", "buyer", "seller", "both"] as const) {
    assert.equal(
      isPartnerOnlyNavigationAccount({
        isSignedIn: true,
        role,
        partnerProfile,
        companies: noCompanies,
      }),
      true,
    );
  }

  for (const input of [
    { isSignedIn: false, role: "user" as const, partnerProfile, companies: noCompanies },
    { isSignedIn: true, role: "user" as const, partnerProfile: null, companies: noCompanies },
    { isSignedIn: true, role: "admin" as const, partnerProfile, companies: noCompanies },
    {
      isSignedIn: true,
      role: "buyer" as const,
      partnerProfile,
      companies: [{ companyRole: "buyer" as const }],
    },
    {
      isSignedIn: true,
      role: "seller" as const,
      partnerProfile,
      companies: [{ companyRole: "seller" as const }],
    },
    {
      isSignedIn: true,
      role: "both" as const,
      partnerProfile,
      companies: [{ companyRole: "buyer" as const }, { companyRole: "seller" as const }],
    },
  ]) {
    assert.equal(isPartnerOnlyNavigationAccount(input), false);
  }

  assert.equal(
    isPartnerOnlyAccount({
      partnerProfile,
      companyState: { hasBuyerCompany: false, hasSellerCompany: false },
    }),
    true,
  );
});

test("partner dashboard navigation uses the existing locale-aware link path", async () => {
  const headerSource = await readFile(
    new URL("../src/components/site-header.tsx", import.meta.url),
    "utf8",
  );
  assert.match(headerSource, /href=\{withLocale\(link\.href, locale\)\}/);
  assert.match(headerSource, /href: "\/partner\/dashboard"/);
});

test("partner-only routing is role-independent and company-aware", async () => {
  const requireAuthSource = await readFile(
    new URL("../src/lib/require-auth.ts", import.meta.url),
    "utf8",
  );
  const roleSource = await readFile(
    new URL("../src/components/role-selection.tsx", import.meta.url),
    "utf8",
  );
  const stepperSource = await readFile(
    new URL("../src/components/onboarding-stepper.tsx", import.meta.url),
    "utf8",
  );
  const formSource = await readFile(
    new URL("../src/components/partner-enrollment-form.tsx", import.meta.url),
    "utf8",
  );
  const contextHookSource = await readFile(
    new URL("../src/hooks/use-user-context.ts", import.meta.url),
    "utf8",
  );

  assert.match(requireAuthSource, /const partnerOnly = isPartnerOnlyAccount/);
  assert.match(requireAuthSource, /if \(partnerOnly\) \{\s*redirect\(`\$\{prefix\}\/partner\/dashboard`\)/);
  assert.doesNotMatch(requireAuthSource, /if \(role === "user"\) \{[\s\S]{0,160}getOwnedPartnerProfile/);
  assert.match(roleSource, /whitespace-normal/);
  assert.match(roleSource, /\[overflow-wrap:anywhere\]/);
  assert.doesNotMatch(stepperSource, /sm:truncate/);
  assert.match(formSource, /await refreshUserContext\(\)/);
  assert.match(formSource, /window\.location\.replace\(/);
  assert.match(contextHookSource, /cache: "no-store"/);
  assert.match(contextHookSource, /export function invalidateUserContext/);
});

test("public navigation omits private Buyers and Pricing links", () => {
  const links = getPublicNavigationLinks() as readonly { href: string }[];
  assert.equal(links.some((link) => link.href === "/partner"), false);
  assert.equal(links.some((link) => link.href === "/buyers"), false);
  assert.equal(links.some((link) => link.href === "/pricing"), false);
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

test("partner enrollment is idempotent and allocates a distinct referral code per user", async () => {
  const profiles = new Map<
    string,
    {
      id: string;
      userId: string;
      referralCode: string;
      status: PartnerProfileStatus;
      createdAt: Date;
    }
  >();
  const repository = {
    partnerProfile: {
      findUnique: async ({ where }: { where: { userId: string } }) =>
        profiles.get(where.userId) ?? null,
      create: async ({ data }: { data: { userId: string; referralCode: string } }) => {
        const profile = {
          id: `partner-${data.userId}`,
          userId: data.userId,
          referralCode: data.referralCode,
          status: PartnerProfileStatus.ACTIVE,
          createdAt: new Date("2026-07-16T00:00:00.000Z"),
        };
        profiles.set(data.userId, profile);
        return profile;
      },
    },
  };

  const first = await createOrGetPartnerProfile(repository, "user-1");
  const repeated = await createOrGetPartnerProfile(repository, "user-1");
  const secondUser = await createOrGetPartnerProfile(repository, "user-2");

  assert.equal(first.created, true);
  assert.equal(repeated.created, false);
  assert.equal(first.partnerProfile.id, repeated.partnerProfile.id);
  assert.equal(profiles.size, 2);
  assert.notEqual(first.partnerProfile.referralCode, secondUser.partnerProfile.referralCode);
});

test("partner enrollment normalizes payout data and requires recorded consent", () => {
  const enrollment = normalizePartnerEnrollment({
    fullName: "  Partner Name ",
    phone: "+1 (212) 555-0199",
    preferredLanguage: "en",
    bankDirectoryId: " bank-1 ",
    accountHolder: "  Partner Name  ",
    accountNumber: " 123-456-7890 ",
    accountBelongsToPartner: true,
    agreeToTerms: true,
    acknowledgePayoutTerms: true,
    acknowledgePrivacy: true,
  });

  assert.deepEqual(enrollment, {
    fullName: "Partner Name",
    accountHolder: "Partner Name",
    phone: "+12125550199",
    preferredLanguage: "en",
    bankDirectoryId: "bank-1",
    accountNumber: "123-456-7890",
    accountBelongsToPartner: true,
  });
  assert.equal(normalizePartnerPhone("82-10-1234-5678"), "821012345678");
  assert.throws(() => normalizePartnerPhone("not-a-phone"));
  assert.throws(() =>
    normalizePartnerEnrollment({
      ...enrollment,
      agreeToTerms: false,
      acknowledgePayoutTerms: true,
      acknowledgePrivacy: true,
    }),
  );
  assert.equal(partnerConsentVersions.terms, "partner-program-2026-07");
  assert.equal(partnerConsentVersions.privacy, "privacy-2026-07");
});

test("a partner cannot consume their own referral claim", async () => {
  const previous = process.env.PARTNER_PROGRAM_MODE;
  process.env.PARTNER_PROGRAM_MODE = "on";
  const rawToken = createReferralClaimSecret();
  let claimUpdated = false;
  try {
    const result = await consumeReferralClaimForNewUser(
      {
        referralClaimToken: {
          findUnique: async () => ({
            id: "claim-1",
            partnerProfileId: "partner-1",
            consumedAt: null,
            expiresAt: new Date("2026-07-17T00:00:00.000Z"),
            partnerProfile: {
              id: "partner-1",
              status: PartnerProfileStatus.ACTIVE,
              userId: "user-1",
              referralCode: "T82-PARTNER_123",
            },
          }),
          updateMany: async () => {
            claimUpdated = true;
            return { count: 1 };
          },
        },
        referralAttribution: {
          create: async () => assert.fail("self-referral must not be attributed"),
        },
      } as never,
      {
        rawToken,
        referredUserId: "user-1",
        now: new Date("2026-07-16T00:00:00.000Z"),
      },
    );
    assert.deepEqual(result, { consumed: false, reason: "invalid" });
    assert.equal(claimUpdated, false);
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
    partnerPayoutSetupStatus({ status: PartnerPayoutProfileStatus.PENDING_VERIFICATION }),
    "pending",
  );
  assert.equal(
    partnerPayoutSetupStatus({ status: PartnerPayoutProfileStatus.REJECTED }),
    "restricted",
  );
  assert.equal(
    partnerPayoutSetupStatus({ status: PartnerPayoutProfileStatus.VERIFIED }),
    "enabled",
  );
  assert.equal(
    partnerPayoutSetupStatus({ status: PartnerPayoutProfileStatus.DISABLED }),
    "disabled",
  );
});

test("partner lifecycle exposes only suspension controls", () => {
  assert.equal(
    getPartnerLifecycleTransition("suspend", PartnerProfileStatus.ACTIVE),
    PartnerProfileStatus.SUSPENDED,
  );
  assert.equal(
    getPartnerLifecycleTransition("reactivate", PartnerProfileStatus.SUSPENDED),
    PartnerProfileStatus.ACTIVE,
  );
  assert.equal(getPartnerLifecycleTransition("reactivate", PartnerProfileStatus.REJECTED), null);
  assert.equal(
    getPartnerLifecycleTransition("suspend", PartnerProfileStatus.PENDING_REVIEW),
    null,
  );
});

test("owner and administrator payout responses contain only safe fields", () => {
  const safeFields = [
    "accountHolder",
    "accountNumberLast4",
    "accountNumberMasked",
    "bankName",
    "id",
    "payoutCurrency",
    "status",
    "updatedAt",
    "verifiedAt",
  ].sort();
  assert.deepEqual(Object.keys(partnerPayoutProfileOwnerSelect).sort(), safeFields);
  assert.deepEqual(
    Object.keys(partnerPayoutProfileAdminSummarySelect).sort(),
    safeFields,
  );
  for (const select of [
    partnerPayoutProfileOwnerSelect,
    partnerPayoutProfileAdminSummarySelect,
  ]) {
    assert.equal("accountNumberCiphertext" in select, false);
    assert.equal("verifiedByUserId" in select, false);
    assert.equal("partnerProfileId" in select, false);
    assert.equal("bankDirectory" in select, false);
  }
});

test("partner dashboard response honors pending and rejected visibility boundaries", async () => {
  const now = new Date("2026-07-22T00:00:00.000Z");
  const payout = {
    id: "payout-1",
    bankName: "Korean Bank",
    accountHolder: "Partner",
    accountNumberMasked: "•••• 7890",
    accountNumberLast4: "7890",
    payoutCurrency: "krw",
    status: PartnerPayoutProfileStatus.PENDING_VERIFICATION,
    verifiedAt: null,
    updatedAt: now,
  };
  const database = {
    partnerProfile: {
      findFirst: async ({ where }: { where: { id: string } }) => ({
        id: where.id,
        displayName: "Partner",
        legalName: null,
        organizationName: null,
        contactEmail: "partner@example.test",
        contactPhone: null,
        country: "US",
        preferredLanguage: "en",
        websiteOrSocialUrl: null,
        promotionDescription: null,
        status: where.id === "pending" ? "PENDING_REVIEW" : "REJECTED",
        referralCode: "T82-SHOULD-NOT-BE-EXPOSED",
        createdAt: now,
        payoutProfile: where.id === "pending" ? payout : payout,
        user: {
          displayName: "Partner",
          email: "partner@example.test",
          preferredLanguage: "en",
        },
      }),
    },
  };
  const getDatabase = () => database as never;
  const pending = await getPartnerDashboardData({
    partnerProfileId: "pending",
    partnerProgramEnabled: true,
    getDatabase: getDatabase as never,
  });
  const rejected = await getPartnerDashboardData({
    partnerProfileId: "rejected",
    partnerProgramEnabled: true,
    getDatabase: getDatabase as never,
  });

  assert.ok(pending);
  assert.equal(pending.partner.referralCode, null);
  assert.deepEqual(pending.partner.payoutProfile, payout);
  assert.equal(pending.counts.referredMembers, 0);
  assert.equal(pending.commissionHistory.length, 0);
  assert.equal(pending.analytics.totals.totalClicks, 0);
  assert.ok(rejected);
  assert.equal(rejected.partner.referralCode, null);
  assert.equal(rejected.partner.payoutProfile, null);
  assert.equal(rejected.counts.referredMembers, 0);
  assert.equal(rejected.commissionHistory.length, 0);
  assert.equal(rejected.analytics.totals.totalClicks, 0);
});

test("partner status panels render only the permitted pending and rejected content", () => {
  const output = execFileSync(
    process.execPath,
    ["--experimental-strip-types", "tests/partner-dashboard-status.render.mjs"],
    {
      cwd: new URL("..", import.meta.url),
      env: { ...process.env, NODE_OPTIONS: "" },
      encoding: "utf8",
    },
  );
  const rendered = JSON.parse(output) as {
    pending: string;
    rejected: string;
  };
  const pendingMarkup = rendered.pending;
  assert.match(pendingMarkup, /Application under review/);
  assert.match(pendingMarkup, /•••• 7890/);
  assert.doesNotMatch(pendingMarkup, /referral|commission|member|T82-/i);

  const rejectedMarkup = rendered.rejected;
  assert.match(rejectedMarkup, /Application not approved/);
  assert.match(rejectedMarkup, /Contact support/);
  assert.doesNotMatch(rejectedMarkup, /payout|referral|commission|member/i);
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

test("partner pending earnings come from partner settlement legs without Stripe onboarding", async () => {
  const holdUntil = new Date("2026-07-30T00:00:00.000Z");
  const partnerLeg = {
    id: "partner-leg-1",
    amount: 500,
    currency: "usd",
    status: SettlementLegStatus.HOLD,
    holdUntil,
    settlement: {
      createdAt: new Date("2026-07-16T00:00:00.000Z"),
      grossAmount: 100_000,
      tradeOrder: { orderNumber: "T82-ORDER-1" },
    },
    reversals: [],
  };
  const result = await getPartnerDashboardData({
    partnerProfileId: "partner-1",
    partnerProgramEnabled: true,
    getDatabase: (() =>
      ({
        partnerProfile: {
          findFirst: async () => ({
            id: "partner-1",
            status: PartnerProfileStatus.ACTIVE,
            referralCode: "T82-PARTNER_123",
            createdAt: new Date("2026-07-01T00:00:00.000Z"),
            payoutProfile: null,
            user: null,
          }),
        },
        referralAttribution: {
          count: async () => 1,
          findMany: async () => [],
        },
        settlement: { count: async () => 1 },
        settlementLeg: { findMany: async () => [partnerLeg] },
      }) as never) as never,
  });

  assert.ok(result);
  assert.equal(result.partner.payoutProfile, null);
  assert.equal(result.totals.pending, 500);
  assert.equal(result.totals.available, 0);
  assert.equal(result.commissionHistory[0]?.orderNumber, "T82-ORDER-1");
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

test("partner enrollment migration only adds private profile and consent fields", async () => {
  const migration = await readFile(
    new URL(
      "../prisma/migrations/20260717100000_add_partner_profile_enrollment_details/migration.sql",
      import.meta.url,
    ),
    "utf8",
  );
  for (const field of [
    "legalName",
    "contactEmail",
    "contactPhone",
    "termsConsentVersion",
    "termsConsentedAt",
    "privacyConsentVersion",
    "privacyConsentedAt",
  ]) {
    assert.match(migration, new RegExp(`ADD COLUMN "${field}"`));
  }
  assert.match(migration, /PartnerProfile_contactEmail_length/);
  assert.match(migration, /PartnerProfile_contactPhone_length/);
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
  const enrollRoute = await readFile(
    new URL("../src/app/api/partner/enroll/route.ts", import.meta.url),
    "utf8",
  );
  const enrollment = await readFile(
    new URL("../src/lib/partner-enrollment.ts", import.meta.url),
    "utf8",
  );
  const joinPage = await readFile(
    new URL("../src/components/partner-join-page.tsx", import.meta.url),
    "utf8",
  );
  const roleSelection = await readFile(
    new URL("../src/components/role-selection.tsx", import.meta.url),
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
  assert.match(authz, /if \(existingByClerkId\) \{[\s\S]*?isActiveUserProfile\(existingByClerkId\)/);
  assert.doesNotMatch(authz, /existingByEmail/);
  assert.doesNotMatch(
    dashboardData,
    /paymentMethod|stripeSecret|bankAccount|stripeAccount|accountNumberCiphertext/,
  );
  assert.match(enrollRoute, /readJsonObject\(request\)/);
  assert.match(enrollRoute, /assertSameOrigin\(request\)/);
  assert.doesNotMatch(enrollRoute, /ownerUserId/);
  assert.doesNotMatch(
    enrollRoute,
    /stripeConnectedAccount|SettlementLeg|ReferralAttribution|transfers\.create/,
  );
  assert.match(enrollment, /userId/);
  assert.match(enrollRoute, /const user = await requireAuth\(\)/);
  assert.doesNotMatch(enrollment, /existingByEmail|relink.*email/i);
  assert.doesNotMatch(enrollment, /stripe\.accounts|bankAccount|routingNumber|swift/i);
  assert.match(joinPage, /\/onboarding\/partner/);
  assert.match(joinPage, /partner\?\.status === "SUSPENDED"/);
  assert.match(roleSelection, /partnerProgramEnabled/);
  assert.match(roleSelection, /partnerProgram\.joinAsPartner/);
  assert.match(roleSelection, /withLocale\("\/partner", locale\)/);
});

test("public partner landing stays concise and localized", async () => {
  const landing = await readFile(
    new URL("../src/components/partner-program-landing.tsx", import.meta.url),
    "utf8",
  );
  const [english, korean] = await Promise.all(
    ["en", "ko"].map(async (locale) => {
      const source = await readFile(
        new URL(`../messages/${locale}.json`, import.meta.url),
        "utf8",
      );
      return JSON.parse(source) as {
        partnerProgram?: Record<string, unknown>;
      };
    }),
  );
  const keys = [
    "landingHeroTitle",
    "landingHeroDescription",
    "landingStep1",
    "landingStep2",
    "landingStep3",
    "landingDisclosure",
    "landingPrimaryCta",
    "landingSignIn",
  ];

  assert.doesNotMatch(landing, /HomeFaqAccordion|export-documents|landingBenefits|landingAudience|landingEarnings|landingFaq/);
  assert.match(landing, /state === "guest"[\s\S]*signUpPath/);
  assert.match(landing, /state === "eligible"[\s\S]*partnerJoinPath/);
  assert.match(landing, /state === "active"[\s\S]*dashboardPath/);
  for (const key of keys) {
    assert.equal(typeof english.partnerProgram?.[key], "string", `en: ${key}`);
    assert.equal(typeof korean.partnerProgram?.[key], "string", `ko: ${key}`);
  }
  assert.equal(
    english.partnerProgram?.landingHeroTitle,
    "Share Trade82 and earn from qualified transactions",
  );
  assert.equal(
    korean.partnerProgram?.landingHeroTitle,
    "Trade82를 공유하고 거래 수익을 받으세요",
  );
});
