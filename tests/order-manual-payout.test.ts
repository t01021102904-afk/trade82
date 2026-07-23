import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const financials = await import(new URL("../src/lib/order-financials.ts", import.meta.url).href);
const orderRules = await import(new URL("../src/lib/trade-order-rules.ts", import.meta.url).href);
const counters = await import(new URL("../src/lib/order-number-counters.ts", import.meta.url).href);
const payoutRules = await import(new URL("../src/lib/seller-payout-rules.ts", import.meta.url).href);
const crypto = await import(new URL("../src/lib/payout-crypto.ts", import.meta.url).href);
const flags = await import(new URL("../src/lib/trade-order-feature.ts", import.meta.url).href);
const bankSecurity = await import(new URL("../src/lib/bank-directory-security.ts", import.meta.url).href);
const csv = await import(new URL("../src/lib/csv-security.ts", import.meta.url).href);
const banks = await import(new URL("../src/lib/south-korea-bank-directory.ts", import.meta.url).href);
const adjustments = await import(new URL("../src/lib/seller-payout-adjustment-rules.ts", import.meta.url).href);
const adminOrderTable = await import(new URL("../src/lib/admin-order-table.ts", import.meta.url).href);

const files = {
  migration: new URL("../prisma/migrations/20260713110000_add_trade_orders_and_manual_payouts/migration.sql", import.meta.url),
  orderService: new URL("../src/lib/trade-orders.ts", import.meta.url),
  paymentRoute: new URL("../src/app/api/inquiries/[id]/payment-requests/route.ts", import.meta.url),
  paymentWebhook: new URL("../src/lib/payment-requests.ts", import.meta.url),
  payoutService: new URL("../src/lib/seller-payouts.ts", import.meta.url),
  adjustmentRules: new URL("../src/lib/seller-payout-adjustment-rules.ts", import.meta.url),
  payoutAdjustmentRoute: new URL("../src/app/api/admin/payouts/[id]/adjustments/route.ts", import.meta.url),
  payoutProfileService: new URL("../src/lib/seller-payout-profiles.ts", import.meta.url),
  sellerProfileRoute: new URL("../src/app/api/account/payout-profile/route.ts", import.meta.url),
  onboardingStatus: new URL("../src/lib/onboarding-status.ts", import.meta.url),
  onboardingRoute: new URL("../src/app/api/user/onboarding/route.ts", import.meta.url),
  onboardingForm: new URL("../src/components/onboarding-form.tsx", import.meta.url),
  onboardingStepper: new URL("../src/components/onboarding-stepper.tsx", import.meta.url),
  sellerPayoutOnboarding: new URL("../src/components/seller-payout-onboarding-step.tsx", import.meta.url),
  payoutSettingsUi: new URL("../src/components/payout-information-client.tsx", import.meta.url),
  requireAuth: new URL("../src/lib/require-auth.ts", import.meta.url),
  apiSecurity: new URL("../src/lib/api-security.ts", import.meta.url),
  orderListRoute: new URL("../src/app/api/orders/route.ts", import.meta.url),
  orderDetailRoute: new URL("../src/app/api/orders/[orderNumber]/route.ts", import.meta.url),
  adminPayoutRoute: new URL("../src/app/api/admin/payouts/route.ts", import.meta.url),
  adminPayoutReview: new URL("../src/lib/admin-payout-review.ts", import.meta.url),
  adminPayoutActionRoute: new URL("../src/app/api/admin/payouts/[id]/route.ts", import.meta.url),
  payoutRevealRoute: new URL("../src/app/api/admin/payouts/[id]/reveal/route.ts", import.meta.url),
  partnerPayoutService: new URL("../src/lib/partner-payouts.ts", import.meta.url),
  partnerPayoutAdminRoute: new URL("../src/app/api/admin/partner-payouts/[id]/route.ts", import.meta.url),
  partnerPayoutRevealRoute: new URL("../src/app/api/admin/partner-payouts/[id]/reveal/route.ts", import.meta.url),
  partnerPayoutMigration: new URL("../prisma/migrations/20260722130000_add_partner_manual_payout_review/migration.sql", import.meta.url),
  stripeConnectStartRoute: new URL("../src/app/api/stripe/connect/onboarding/[ownerType]/start/route.ts", import.meta.url),
  stripeConnectStatusRoute: new URL("../src/app/api/stripe/connect/onboarding/[ownerType]/status/route.ts", import.meta.url),
  stripeConnectRefreshRoute: new URL("../src/app/api/stripe/connect/onboarding/[ownerType]/refresh/route.ts", import.meta.url),
  stripeConnectReturnRoute: new URL("../src/app/api/stripe/connect/onboarding/[ownerType]/return/route.ts", import.meta.url),
  partnerDashboardUi: new URL("../src/components/partner-dashboard-view.tsx", import.meta.url),
  payoutProofRoute: new URL("../src/app/api/admin/payouts/[id]/proof/route.ts", import.meta.url),
  payoutProfileAdminRoute: new URL("../src/app/api/admin/payout-profiles/[id]/route.ts", import.meta.url),
  adminOrderRoute: new URL("../src/app/api/admin/orders/route.ts", import.meta.url),
  adminOrderUi: new URL("../src/components/admin-order-management.tsx", import.meta.url),
  adminBankRoute: new URL("../src/app/api/admin/banks/route.ts", import.meta.url),
  adminBankUi: new URL("../src/components/admin-bank-directory.tsx", import.meta.url),
  payoutUi: new URL("../src/components/admin-payout-management.tsx", import.meta.url),
  notificationService: new URL("../src/lib/trade-order-notifications.ts", import.meta.url),
};

const source = Object.fromEntries(
  await Promise.all(
    Object.entries(files).map(async ([key, file]) => [key, await readFile(file, "utf8")]),
  ),
) as Record<keyof typeof files, string>;

const dictionaries = {
  en: JSON.parse(await readFile(new URL("../messages/en.json", import.meta.url), "utf8")),
  ko: JSON.parse(await readFile(new URL("../messages/ko.json", import.meta.url), "utf8")),
};

function dictionaryPaths(value: unknown, prefix = ""): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [prefix];
  return Object.entries(value).flatMap(([key, child]) => dictionaryPaths(child, prefix ? `${prefix}.${key}` : key));
}

type Counter = { lastOrderSequence: number; lastPayoutSequence: number };

function atomicCounterTransaction() {
  const counters = new Map<number, Counter>();
  let tail = Promise.resolve();
  return {
    orderNumberCounter: {
      async upsert({
        where,
        create,
        update,
      }: {
        where: { year: number };
        create: Partial<Counter>;
        update: {
          lastOrderSequence?: { increment: number };
          lastPayoutSequence?: { increment: number };
        };
      }) {
        let release: (() => void) | undefined;
        const previous = tail;
        tail = new Promise<void>((resolve) => { release = resolve; });
        await previous;
        try {
          const current = counters.get(where.year);
          const next = current
            ? {
                lastOrderSequence: current.lastOrderSequence + (update.lastOrderSequence?.increment ?? 0),
                lastPayoutSequence: current.lastPayoutSequence + (update.lastPayoutSequence?.increment ?? 0),
              }
            : {
                lastOrderSequence: create.lastOrderSequence ?? 0,
                lastPayoutSequence: create.lastPayoutSequence ?? 0,
              };
          counters.set(where.year, next);
          return { ...next };
        } finally {
          release?.();
        }
      },
    },
  };
}

function withEncryptionEnvironment(run: () => void) {
  const original = {
    key: process.env.PAYOUT_DATA_ENCRYPTION_KEY,
    version: process.env.PAYOUT_DATA_ENCRYPTION_KEY_VERSION,
    keyring: process.env.PAYOUT_DATA_ENCRYPTION_KEYRING,
  };
  process.env.PAYOUT_DATA_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  process.env.PAYOUT_DATA_ENCRYPTION_KEY_VERSION = "test-v1";
  delete process.env.PAYOUT_DATA_ENCRYPTION_KEYRING;
  try {
    run();
  } finally {
    for (const [key, value] of Object.entries(original)) {
      const environmentKey = key === "key"
        ? "PAYOUT_DATA_ENCRYPTION_KEY"
        : key === "version"
          ? "PAYOUT_DATA_ENCRYPTION_KEY_VERSION"
          : "PAYOUT_DATA_ENCRYPTION_KEYRING";
      if (value === undefined) delete process.env[environmentKey];
      else process.env[environmentKey] = value;
    }
  }
}

test("order and payout numbers use UTC-year formats beyond four digits", () => {
  assert.equal(orderRules.formatTradeOrderNumber(2026, 1), "T82-2026-0001");
  assert.equal(orderRules.formatTradeOrderNumber(2026, 10_000), "T82-2026-10000");
  assert.equal(orderRules.formatSellerPayoutNumber(2026, 1), "PAY-T82-2026-0001");
  assert.equal(orderRules.formatSellerPayoutNumber(2026, 10_000), "PAY-T82-2026-10000");
});

test("production order counter allocation remains unique under concurrent calls", async () => {
  const tx = atomicCounterTransaction() as never;
  const values = await Promise.all(
    Array.from({ length: 100 }, () => counters.nextTradeOrderNumber(tx, new Date("2026-12-31T23:59:59.000Z"))),
  );
  assert.equal(new Set(values).size, 100);
  assert.ok(values.every((value) => value.startsWith("T82-2026-")));
  assert.equal(await counters.nextTradeOrderNumber(tx, new Date("2027-01-01T00:00:00.000Z")), "T82-2027-0001");
});

test("production payout counter allocation remains unique under concurrent calls", async () => {
  const tx = atomicCounterTransaction() as never;
  const values = await Promise.all(
    Array.from({ length: 100 }, () => counters.nextSellerPayoutNumber(tx, new Date("2026-06-01T00:00:00.000Z"))),
  );
  assert.equal(new Set(values).size, 100);
  assert.ok(values.every((value) => value.startsWith("PAY-T82-2026-")));
});

test("order financials use integer cents and half-up five-percent rounding", () => {
  assert.deepEqual(financials.calculateOrderFinancials(1, 0), { grossAmount: 1, platformFeeAmount: 0, sellerPayableAmount: 1 });
  assert.deepEqual(financials.calculateOrderFinancials(10, 0), { grossAmount: 10, platformFeeAmount: 1, sellerPayableAmount: 9 });
  assert.deepEqual(financials.calculateOrderFinancials(100, 0), { grossAmount: 100, platformFeeAmount: 5, sellerPayableAmount: 95 });
  assert.deepEqual(financials.calculateOrderFinancials(1_999, 0), { grossAmount: 1_999, platformFeeAmount: 100, sellerPayableAmount: 1_899 });
  assert.deepEqual(financials.calculateOrderFinancials(10_000, 0), { grossAmount: 10_000, platformFeeAmount: 500, sellerPayableAmount: 9_500 });
  assert.deepEqual(financials.calculateOrderFinancials(10_001, 99), { grossAmount: 10_100, platformFeeAmount: 505, sellerPayableAmount: 9_595 });
  const large = financials.calculateOrderFinancials(Number.MAX_SAFE_INTEGER - 1, 0);
  assert.equal(large.grossAmount, Number.MAX_SAFE_INTEGER - 1);
  assert.equal(large.sellerPayableAmount + large.platformFeeAmount, large.grossAmount);
});

test("financial calculations reject negative, unsafe, fractional, and non-USD inputs", () => {
  assert.throws(() => financials.calculateOrderFinancials(0, 0));
  assert.throws(() => financials.calculateOrderFinancials(-1, 0));
  assert.throws(() => financials.calculateOrderFinancials(10.5, 0));
  assert.throws(() => financials.calculateOrderFinancials(Number.MAX_SAFE_INTEGER, 1));
  assert.equal(financials.assertUsdCurrency("USD"), "usd");
  assert.throws(() => financials.assertUsdCurrency("krw"));
});

test("company and product snapshots do not follow later profile edits", () => {
  const company = { legalName: "APR Co., Ltd.", tradeName: "APR", owner: { displayName: "Ari", email: "ari@example.test", phoneNumber: "010" }, country: "KR", businessAddress: "Seoul" };
  const snapshot = orderRules.immutableCompanySnapshot(company);
  company.tradeName = "Changed";
  company.owner.displayName = "Changed owner";
  assert.deepEqual(snapshot, { companyName: "APR", contactName: "Ari", email: "ari@example.test", phone: "010", country: "KR", address: "Seoul" });
  assert.match(source.orderService, /productSnapshot:/);
});

test("new payment request and exactly one linked order are created inside one transaction", () => {
  assert.match(source.paymentRoute, /\$transaction\(async \(tx\)/);
  assert.match(source.paymentRoute, /createTradeOrderForPaymentRequest\(tx, created\.id\)/);
  assert.match(source.orderService, /paymentRequestId\s+String\s+@unique|paymentRequestId: paymentRequest\.id/);
  assert.match(source.migration, /CREATE UNIQUE INDEX "TradeOrder_paymentRequestId_key"/);
  assert.match(source.migration, /CREATE UNIQUE INDEX "PaymentRequest_orderId_key"/);
});

test("webhook payment, refund, dispute, and cancellation states synchronize linked orders", () => {
  assert.match(source.paymentWebhook, /syncTradeOrderFromPaymentRequest/);
  for (const status of ["PAID", "PARTIALLY_REFUNDED", "REFUNDED", "DISPUTED", "CANCELLED"]) {
    assert.match(source.orderService, new RegExp(`PaymentRequestStatus\\.${status}`));
  }
  assert.match(source.orderService, /reconciliationRequired: true/);
  assert.match(source.paymentWebhook, /claimPaymentRequestWebhookEvent/);
});

test("payout eligibility blocks unpaid, unverified, refunded, disputed, and duplicate payouts", () => {
  const base = { paymentStatus: "PAID", orderPaymentStatus: "PAID", orderStatus: "PAID", orderPayoutStatus: "NOT_READY", refundAmount: 0, hasActiveDispute: false, payoutProfileStatus: "VERIFIED", sellerPayableAmount: 9_500, existingPayoutStatus: null };
  assert.deepEqual(payoutRules.sellerPayoutEligibility(base), { ready: true });
  for (const changed of [{ paymentStatus: "PENDING" }, { payoutProfileStatus: "PENDING_VERIFICATION" }, { refundAmount: 1 }, { hasActiveDispute: true }, { existingPayoutStatus: "SENT" }]) {
    assert.equal(payoutRules.sellerPayoutEligibility({ ...base, ...changed }).ready, false);
  }
});

test("payout preparation and SENT transition use serializable conditional writes", () => {
  assert.match(source.payoutService, /TransactionIsolationLevel\.Serializable/);
  assert.match(source.payoutService, /SellerPayoutStatus\.SENT/);
  assert.match(source.payoutService, /status: \{ in: \["READY", "PROCESSING"\] \}, sentAt: null/);
  assert.match(source.payoutService, /claimPaymentRequestRelease/);
  assert.match(source.migration, /CREATE UNIQUE INDEX "SellerPayout_orderId_key"/);
  assert.match(source.migration, /CREATE UNIQUE INDEX "SellerPayout_payoutNumber_key"/);
});

test("manual payout adjustment rules credit and debit in integer minor units", () => {
  assert.deepEqual(
    adjustments.calculatePayoutAdjustmentTotals({
      sellerPayableAmount: 9_500,
      refundAdjustmentAmount: 0,
      adjustments: [{ adjustmentType: "CREDIT", amount: 500 }],
    }),
    { manualAdjustmentAmount: 500, finalPayoutAmount: 10_000 },
  );
  assert.deepEqual(
    adjustments.calculatePayoutAdjustmentTotals({
      sellerPayableAmount: 9_500,
      refundAdjustmentAmount: 1_000,
      adjustments: [{ adjustmentType: "DEBIT", amount: 500 }],
    }),
    { manualAdjustmentAmount: -500, finalPayoutAmount: 8_000 },
  );
  assert.throws(() => adjustments.signedAdjustmentAmount({ adjustmentType: "CREDIT", amount: 0 }));
  assert.throws(() => adjustments.calculatePayoutAdjustmentTotals({ sellerPayableAmount: 100, refundAdjustmentAmount: 0, adjustments: [{ adjustmentType: "BANK_FEE", amount: 101 }] }));
});

test("payout adjustments are admin-only, confirmed, immutable, and never rewrite sent amounts", () => {
  assert.match(source.payoutAdjustmentRoute, /requireAdmin\(\)/);
  assert.match(source.payoutAdjustmentRoute, /confirmation/);
  assert.match(source.payoutAdjustmentRoute, /positive integer minor-unit/);
  const adjustmentService = source.payoutService.split("export async function addSellerPayoutAdjustment")[1] ?? "";
  assert.match(adjustmentService, /SellerPayoutAdjustment\.create|sellerPayoutAdjustment\.create/);
  assert.match(adjustmentService, /SellerPayoutEventType\.ADJUSTMENT_ADDED/);
  assert.match(adjustmentService, /requiresManualReconciliation: sent/);
  assert.match(adjustmentService, /if \(sent\)[\s\S]*payoutStatus: OrderPayoutStatus\.HOLD/);
  assert.doesNotMatch(adjustmentService.split("if (sent)")[1]?.split("else")[0] ?? "", /finalPayoutAmount|manualAdjustmentAmount/);
  assert.doesNotMatch(adjustmentService, /sellerPayoutAdjustment\.(update|delete|deleteMany|updateMany)/);
  assert.doesNotMatch(adjustmentService, /metadata: \{[^}]*?(bank|account|beneficiary)/i);
  assert.match(source.migration, /CREATE TABLE "SellerPayoutAdjustment"/);
  assert.match(source.migration, /ALTER TABLE "SellerPayoutAdjustment" ENABLE ROW LEVEL SECURITY/);
  assert.match(source.migration, /CREATE TRIGGER "SellerPayoutAdjustment_immutable"/);
});

test("payout beneficiary encryption uses unique IVs, key versioning, and authenticated decryption", () => {
  withEncryptionEnvironment(() => {
    const first = crypto.encryptPayoutData("1234567890");
    const second = crypto.encryptPayoutData("1234567890");
    assert.equal(first.keyVersion, "test-v1");
    assert.notDeepEqual(first.iv, second.iv);
    assert.notDeepEqual(first.ciphertext, second.ciphertext);
    assert.equal(crypto.decryptPayoutData(first), "1234567890");
    assert.ok(!JSON.stringify(first).includes("1234567890"));
    assert.equal(crypto.maskAccountNumber("1234567890"), "•••• 7890");
  });
});

test("payout encryption fails closed for missing, malformed, wrong, and tampered keys", () => {
  const original = {
    key: process.env.PAYOUT_DATA_ENCRYPTION_KEY,
    version: process.env.PAYOUT_DATA_ENCRYPTION_KEY_VERSION,
    keyring: process.env.PAYOUT_DATA_ENCRYPTION_KEYRING,
  };
  try {
    delete process.env.PAYOUT_DATA_ENCRYPTION_KEY;
    delete process.env.PAYOUT_DATA_ENCRYPTION_KEY_VERSION;
    assert.throws(() => crypto.encryptPayoutData("1234567890"), crypto.PayoutEncryptionConfigurationError as typeof Error);
    process.env.PAYOUT_DATA_ENCRYPTION_KEY = "not-valid-base64";
    process.env.PAYOUT_DATA_ENCRYPTION_KEY_VERSION = "test-v1";
    assert.throws(() => crypto.encryptPayoutData("1234567890"), crypto.PayoutEncryptionConfigurationError as typeof Error);
    process.env.PAYOUT_DATA_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    const encrypted = crypto.encryptPayoutData("1234567890");
    process.env.PAYOUT_DATA_ENCRYPTION_KEY = Buffer.alloc(32, 8).toString("base64");
    assert.throws(() => crypto.decryptPayoutData(encrypted));
    process.env.PAYOUT_DATA_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    encrypted.authTag[0] ^= 1;
    assert.throws(() => crypto.decryptPayoutData(encrypted), crypto.PayoutDecryptionError as typeof Error);
  } finally {
    if (original.key === undefined) delete process.env.PAYOUT_DATA_ENCRYPTION_KEY; else process.env.PAYOUT_DATA_ENCRYPTION_KEY = original.key;
    if (original.version === undefined) delete process.env.PAYOUT_DATA_ENCRYPTION_KEY_VERSION; else process.env.PAYOUT_DATA_ENCRYPTION_KEY_VERSION = original.version;
    if (original.keyring === undefined) delete process.env.PAYOUT_DATA_ENCRYPTION_KEYRING; else process.env.PAYOUT_DATA_ENCRYPTION_KEYRING = original.keyring;
  }
});

test("rollout flags fail closed and only a Clerk user ID in the allowlist is enabled", async () => {
  assert.equal(flags.getTradeOrderSystemMode({}), "off");
  assert.equal(flags.getManualPayoutSystemMode({ MANUAL_PAYOUT_SYSTEM_MODE: "wrong" }), "off");
  const environment = {
    TRADE_ORDER_SYSTEM_MODE: "internal",
    TRADE_ORDER_INTERNAL_USER_IDS: "user_seller,user_buyer,profile_cuid_should_not_match",
    MANUAL_PAYOUT_SYSTEM_MODE: "internal",
    MANUAL_PAYOUT_INTERNAL_USER_IDS: "user_admin",
  };
  assert.equal(flags.isTradeOrderSystemEnabledForClerkUser("user_seller", environment), true);
  assert.equal(flags.isTradeOrderSystemEnabledForClerkUser("user_other", environment), false);
  assert.equal(flags.isTradeOrderSystemEnabledForClerkUser("profile_cuid_should_not_match", environment), false);
  assert.equal(flags.isManualPayoutSystemEnabledForClerkUser("user_admin", environment), true);
  assert.equal(flags.isManualPayoutSystemEnabledForClerkUser("user_seller", environment), false);
  assert.match(await readFile(new URL("../src/lib/trade-order-feature.ts", import.meta.url), "utf8"), /import "server-only"/);
});

test("seller profile APIs use safe selects and prohibit cross-role access without encrypted fields", () => {
  assert.match(source.sellerProfileRoute, /requireSeller\(\)/);
  assert.match(source.sellerProfileRoute, /user\.clerkUserId/);
  assert.match(source.sellerProfileRoute, /assertSameOrigin\(request\)/);
  assert.match(source.sellerProfileRoute, /companyId: company\.id/);
  assert.doesNotMatch(source.sellerProfileRoute, /body\.companyId/);
  assert.doesNotMatch(source.payoutProfileService.split("sellerPayoutProfileSafeSelect")[1]?.split("satisfies")[0] ?? "", /accountNumberCiphertext|accountNumberIv|accountNumberAuthTag/);
  assert.match(source.payoutProfileAdminRoute, /cannot verify their own seller payout profile/);
});

test("seller onboarding requires an encrypted payout profile while buyer onboarding remains unchanged", () => {
  assert.match(
    source.onboardingStatus,
    /role === "seller"[\s\S]*hasSellerCompany && companyState\.hasSellerPayoutProfile/,
  );
  assert.match(
    source.onboardingStatus,
    /role === "buyer"\) return companyState\.hasBuyerCompany/,
  );
  assert.match(source.onboardingRoute, /Complete payout information before finishing seller onboarding/);
  assert.match(source.requireAuth, /onboardingComplete: isOnboardingCompleteForRole/);
  assert.match(source.requireAuth, /hasSellerCompany: companyState\.hasSellerCompany/);
  assert.match(source.onboardingForm, /kind === "seller" \? "payout" : "personal"/);
  assert.match(source.onboardingForm, /SellerPayoutOnboardingStep/);
  assert.match(source.onboardingForm, /completeOnboardingAfterSave/);
  assert.match(source.onboardingForm, /if \(kind === "buyer"\)/);
  assert.match(source.onboardingStepper, /id: "payout"/);
});

test("payout onboarding accepts only required safe fields and never renders full account data", () => {
  assert.match(source.sellerPayoutOnboarding, /accountNumber \? \{ accountNumber \} : \{\}/);
  assert.match(source.sellerPayoutOnboarding, /setAccountNumber\(""\)/);
  assert.match(source.sellerPayoutOnboarding, /accountNumberMasked/);
  assert.match(source.sellerPayoutOnboarding, /accountNumberLast4/);
  assert.doesNotMatch(source.sellerPayoutOnboarding, /localStorage|sessionStorage|document\.cookie|console\./);
  assert.match(source.sellerProfileRoute, /status: 503/);
  assert.match(source.sellerProfileRoute, /manualPayoutMaintenanceMessage/);
  assert.match(source.sellerProfileRoute, /assertKoreanPayoutConfiguration/);
  assert.match(source.sellerProfileRoute, /findActiveKoreanSellerPayoutBank/);
  assert.match(source.sellerProfileRoute, /termsAccepted/);
  assert.match(source.sellerProfileRoute, /privacyAccepted/);
  assert.match(source.payoutProfileService, /accountNumberCiphertext/);
  assert.match(source.payoutProfileService, /normalizeKoreanAccountNumber/);
  assert.match(source.payoutProfileService, /PENDING_VERIFICATION/);
  assert.match(source.payoutProfileService, /existing\?\.status === SellerPayoutProfileStatus\.VERIFIED/);
  assert.doesNotMatch(source.payoutProfileService, /console\./);
  assert.doesNotMatch(source.sellerProfileRoute, /console\./);
  assert.match(source.apiSecurity, /export function assertSameOrigin/);
  assert.match(source.payoutSettingsUi, /country: "KR"/);
  assert.doesNotMatch(source.payoutSettingsUi, /JSON\.stringify\(\{ \.\.\.profile/);
});

test("admin reveals require POST, no-store, a reason, and audit events without bank payloads", () => {
  assert.match(source.payoutRevealRoute, /export async function POST/);
  assert.match(source.payoutRevealRoute, /A reveal reason is required/);
  assert.match(source.payoutRevealRoute, /BANK_DETAILS_REVEALED/);
  assert.match(source.payoutRevealRoute, /Cache-Control": "no-store/);
  assert.doesNotMatch(source.payoutRevealRoute, /metadata: \{[^}]*accountNumber/);
});

test("buyer order responses omit seller payout and beneficiary fields", () => {
  assert.match(source.orderListRoute, /sellerCompanyIdSet/);
  assert.match(source.orderListRoute, /delete safeOrder\.platformFeeAmount/);
  assert.match(source.orderDetailRoute, /function buyerSafeOrder/);
  assert.doesNotMatch(source.orderDetailRoute, /accountNumberLast4: true/);
  assert.match(source.adminPayoutActionRoute, /\{ ok: true, alreadySent: result\.alreadySent \}/);
});

test("admin payout list explicitly excludes encrypted snapshots and proof storage paths", () => {
  assert.match(source.adminPayoutReview, /accountNumberLast4/);
  assert.doesNotMatch(source.adminPayoutReview, /beneficiarySnapshotEncrypted/);
  assert.doesNotMatch(source.adminPayoutReview, /payoutProofStoragePath/);
});

test("bank auto-fill only trusts verified directory values and safe HTTPS portals", async () => {
  const bank = { bankNameEnglish: "KB Kookmin Bank", defaultSwiftBic: "CZNBKRSE", defaultBankAddress: "Seoul", officialWebsite: "https://www.kbstar.com", verifiedAt: new Date() };
  assert.deepEqual(bankSecurity.verifiedBankAutofill(bank, false), { bankName: "KB Kookmin Bank", swiftBic: "CZNBKRSE", bankAddress: "Seoul", officialWebsite: "https://www.kbstar.com" });
  assert.equal(bankSecurity.verifiedBankAutofill({ ...bank, verifiedAt: null }, false), null);
  assert.equal(bankSecurity.verifiedBankAutofill(bank, true), null);
  for (const unsafe of ["javascript:alert(1)", "data:text/html,boom", "http://bank.test", "https://localhost", "https://127.0.0.1"]) {
    assert.equal(bankSecurity.isSafeOfficialBankWebsite(unsafe), false, unsafe);
  }
  assert.equal(bankSecurity.isSafeOfficialBankWebsite("https://bank.example.com"), true);
  assert.equal(banks.SOUTH_KOREAN_BANK_DIRECTORY_SEED.length, 20);
  assert.ok(
    banks.SOUTH_KOREAN_BANK_DIRECTORY_SEED.every(
      (bank: { countryCode: string }) => bank.countryCode === "KR",
    ),
  );
  assert.match(await readFile(new URL("../scripts/seed-south-korea-bank-directory.ts", import.meta.url), "utf8"), /sourceType: "SEED"/);
  assert.match(await readFile(new URL("../scripts/seed-south-korea-bank-directory.ts", import.meta.url), "utf8"), /update: \{\}/);
});

test("admin bank directory supports search, edit, active status, verified source data, and source markers", () => {
  assert.match(source.adminBankRoute, /bankNameEnglish: \{ contains: search/);
  assert.match(source.adminBankRoute, /sourceType: "ADMIN"/);
  assert.match(source.adminBankRoute, /sourceType: "ADMIN_OVERRIDE"/);
  assert.match(source.adminBankUi, /t\("payouts\.bankAddress"\)/);
  assert.match(source.adminBankUi, /t\("payouts\.bankDirectory\.officialSourceUrl"\)/);
  assert.match(source.adminBankUi, /t\("payouts\.bankDirectory\.activeForSellerSelection"\)/);
  assert.match(source.adminBankUi, /t\("payouts\.bankDirectory\.adminOverride"\)/);
});

test("Open Bank Portal is only a verified website link with noopener and noreferrer", () => {
  assert.match(source.payoutUi, /isSafeOfficialBankWebsite/);
  assert.match(source.payoutUi, /rel="noopener noreferrer"/);
  assert.match(source.payoutUi, /t\("payouts\.openBankPortal"\)/);
  assert.doesNotMatch(source.payoutUi, /t\("payouts\.manualExternalNotice"\)/);
});

test("payout proof uploads use a private bucket, matching type and extension, and short signed URLs", () => {
  assert.match(source.payoutProofRoute, /uploadPrivateFile/);
  assert.match(source.payoutProofRoute, /createSignedPrivateFileUrl\(payout\.payoutProofStoragePath, 120\)/);
  assert.match(source.payoutProofRoute, /matching MIME type/);
  assert.match(source.payoutProofRoute, /payout-proofs\//);
  assert.match(source.payoutProofRoute, /INSTRUCTIONS_EXPORTED/);
});

test("CSV exports mask accounts, neutralize Excel formulas, and write an admin audit event", () => {
  for (const value of ["=1+1", "+SUM(A1)", "-1+2", "@cmd", "\t=SUM(A1)", "\r=SUM(A1)"]) {
    assert.match(csv.csvCell(value), /^"'/, value);
  }
  assert.equal(csv.csvCell('APR "Co"'), '"APR ""Co"""');
  assert.match(source.adminOrderRoute, /createMany/);
  assert.match(source.adminOrderRoute, /Admin exported masked order CSV data/);
  assert.match(source.adminOrderRoute, /\\uFEFF/);
  assert.match(source.adminOrderRoute, /const allOrders = await db\.tradeOrder\.findMany\(\{ where/);
  assert.doesNotMatch(source.adminOrderRoute.split("function csvRows")[1]?.split("export async function GET")[0] ?? "", /stripeCheckoutSessionId|stripePaymentIntentId|stripeChargeId/);
});

test("admin order query supports server filters, pagination, sorting, per-currency totals, masked detail, and drawer-only safe data", () => {
  for (const parameter of ["orderStatus", "paymentStatus", "shipmentStatus", "payoutStatus", "buyerCountry", "sellerCountry", "originCountry", "destinationCountry", "currency", "dateFrom", "dateTo"]) {
    assert.match(source.adminOrderRoute, new RegExp(`searchParams\\.get\\("${parameter}"\\)`));
  }
  for (const searchTarget of ["orderNumber", "buyerCompanyName", "sellerCompanyName", "buyerEmail", "sellerEmail", "productName", "trackingNumber", "externalTransferReference"]) {
    assert.match(source.adminOrderRoute, new RegExp(searchTarget));
  }
  assert.match(source.adminOrderRoute, /skip: \(page - 1\) \* pageSize/);
  assert.match(source.adminOrderRoute, /orderBy: \{ \[sortField\]: sortDirection \}/);
  assert.match(source.adminOrderRoute, /groupBy\(\{ by: \["currency"\]/);
  assert.match(source.adminOrderRoute, /maskStripeIdentifier/);
  assert.match(source.adminOrderUi, /role="dialog"/);
  assert.match(source.adminOrderUi, /localStorage\.setItem\(storageKey, JSON\.stringify\(safe\)\)/);
  assert.deepEqual(adminOrderTable.sanitizeOrderTableColumnVisibility(["orderNumber", "buyerEmail", "not-a-column", 1]), ["orderNumber"]);
  assert.deepEqual(adminOrderTable.currencyTotals([{ currency: "usd", grossAmount: 100, platformFeeAmount: 5, sellerPayableAmount: 95 }, { currency: "krw", grossAmount: 1_000, platformFeeAmount: 50, sellerPayableAmount: 950 }]), { usd: { grossAmount: 100, platformFeeAmount: 5, sellerPayableAmount: 95 }, krw: { grossAmount: 1_000, platformFeeAmount: 50, sellerPayableAmount: 950 } });
  assert.equal(adminOrderTable.maskStripeIdentifier("cs_test_1234", "cs"), "cs_...1234");
});

test("migration is additive, uses restrictive financial foreign keys, and locks down Supabase Data API access", () => {
  assert.doesNotMatch(source.migration, /(^|\n)\s*(DROP|TRUNCATE|DELETE)\b/im);
  assert.doesNotMatch(source.migration, /ALTER TABLE "(Inquiry|Message)"/);
  assert.match(source.migration, /ALTER TABLE "PaymentRequest" ADD COLUMN\s+"orderId" TEXT/);
  assert.match(source.migration, /ON DELETE RESTRICT/);
  for (const table of ["OrderNumberCounter", "TradeOrder", "TradeOrderItem", "TradeOrderShipment", "TradeOrderEvent", "BankDirectory", "SellerPayoutProfile", "SellerPayoutProfileAuditEvent", "SellerPayout", "SellerPayoutEvent", "SellerPayoutAdjustment"]) {
    assert.match(source.migration, new RegExp(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`));
    assert.match(source.migration, new RegExp(`REVOKE ALL PRIVILEGES ON TABLE "${table}" FROM anon, authenticated`));
  }
});

test("manual payout UI records only external transfers and clears revealed bank instructions", () => {
  assert.match(source.payoutUi, /t\("payouts\.markSent"\)/);
  assert.match(source.payoutUi, /t\("payouts\.markFailed"\)/);
  assert.match(source.payoutUi, /t\("payouts\.placeOnHold"\)/);
  assert.match(source.payoutUi, /t\("payouts\.downloadInstructions"\)/);
  assert.match(source.payoutUi, /setRevealed\(null\)/);
  assert.match(source.payoutUi, /instructions-exported/);
});

test("admin payout bank reveal routes require same-origin, rate limiting, reason, no-store, and audit", () => {
  for (const route of [source.payoutRevealRoute, source.partnerPayoutRevealRoute]) {
    assert.match(route, /assertSameOrigin\(request\)/);
    assert.match(route, /rateLimitOrResponse\(/);
    assert.match(route, /Reveal reason must be between 3 and 500 characters/);
    assert.match(route, /Cache-Control": "no-store, no-cache, must-revalidate"/);
  }
  assert.match(source.payoutRevealRoute, /BANK_DETAILS_REVEALED/);
  assert.match(source.partnerPayoutService, /ACCOUNT_REVEALED/);
});

test("partner manual payouts are linked to settlement legs and never invoke Stripe or bank transfers", () => {
  assert.match(source.partnerPayoutMigration, /CREATE TABLE "PartnerPayout"/);
  assert.match(source.partnerPayoutMigration, /"PartnerPayout_settlementLegId_key"/);
  assert.match(source.partnerPayoutMigration, /"PartnerPayout_settlementId_fkey"/);
  assert.match(source.partnerPayoutMigration, /"PartnerPayout_orderId_fkey"/);
  assert.match(source.partnerPayoutMigration, /"PartnerPayout_partnerProfileId_fkey"/);
  assert.match(source.partnerPayoutMigration, /ALTER TABLE "PartnerPayout" ENABLE ROW LEVEL SECURITY/);
  assert.match(source.partnerPayoutService, /Prisma\.TransactionIsolationLevel\.Serializable/);
  assert.match(source.partnerPayoutService, /SettlementLegType\.PARTNER_REFERRAL/);
  assert.match(source.partnerPayoutService, /paymentFlow === "DIRECT_CHARGE"/);
  assert.match(source.partnerPayoutService, /PartnerPayoutStatus\.NOT_READY/);
  assert.match(source.partnerPayoutService, /PartnerPayoutStatus\.HOLD/);
  assert.match(source.partnerPayoutService, /PartnerPayoutStatus\.READY/);
  assert.match(source.partnerPayoutService, /PartnerPayoutStatus\.CANCELLED/);
  assert.match(source.partnerPayoutService, /leg\.partnerPayout\.status === PartnerPayoutStatus\.SENT/);
  assert.doesNotMatch(source.partnerPayoutService, /stripe\.(transfers|payouts|refunds|paymentIntents|checkout)/);
});

test("partner Stripe onboarding requests are blocked before account-link work while seller routes remain present", () => {
  for (const route of [source.stripeConnectStartRoute, source.stripeConnectStatusRoute, source.stripeConnectRefreshRoute]) {
    const executableSource = route.slice(route.indexOf("function onboardingError"));
    const partnerGuard = executableSource.search(/ownerType(?:Value)? === "partner"/);
    const stripeWork = executableSource.search(/startStripeConnectOnboarding|getStripeConnectOnboardingStatus|refreshStripeConnectOnboarding/);
    assert.ok(partnerGuard >= 0, "partner guard exists");
    assert.ok(stripeWork === -1 || partnerGuard < stripeWork, "partner guard precedes Stripe Connect work");
  }
  assert.match(source.stripeConnectReturnRoute, /ownerType === "partner"/);
  assert.match(source.stripeConnectReturnRoute, /\/onboarding\/partner\?edit=1/);
  assert.match(source.partnerDashboardUi, /partnerProgram\.payoutSetupDescription/);
  assert.equal(dictionaries.en.partnerProgram.payoutSetupDescription, "Referral earnings are paid to your registered payout account after Trade82 review.");
  assert.equal(dictionaries.ko.partnerProgram.payoutSetupDescription, "추천 수익은 Trade82의 검토 후 등록한 정산 계좌로 지급됩니다.");
});

test("order and payout translation namespaces stay structurally aligned and localize financial states", () => {
  assert.deepEqual(dictionaryPaths(dictionaries.en).sort(), dictionaryPaths(dictionaries.ko).sort());

  for (const key of [
    "orders.status.order.PAYMENT_PENDING",
    "orders.status.order.READY_TO_SHIP",
    "orders.status.payment.PARTIALLY_REFUNDED",
    "orders.status.shipment.IN_TRANSIT",
    "payouts.status.PROCESSING",
    "payouts.profileStatus.PENDING_VERIFICATION",
    "payouts.adjustmentType.REFUND_RECOVERY",
    "payouts.noPayouts",
  ]) {
    const value = key.split(".").reduce<unknown>((current, segment) => (
      current && typeof current === "object" ? (current as Record<string, unknown>)[segment] : undefined
    ), dictionaries.ko);
    assert.equal(typeof value, "string", key);
  }

  assert.match(source.adminOrderUi, /tradeOrderStatusLabel/);
  assert.match(source.adminOrderUi, /orderPaymentStatusLabel/);
  assert.match(source.adminOrderUi, /shipmentStatusLabel/);
  assert.match(source.adminOrderUi, /payoutStatusLabel/);
  assert.match(source.payoutUi, /payoutAdjustmentTypeLabel/);
  assert.match(source.payoutUi, /formatTradeMoney/);
});

test("order notifications do not contain account, encrypted bank, or Stripe identifier payloads", () => {
  assert.doesNotMatch(source.notificationService, /accountNumber|beneficiarySnapshot|stripePaymentIntentId|stripeCheckoutSessionId/);
  assert.match(source.notificationService, /idempotencyKey/);
});
