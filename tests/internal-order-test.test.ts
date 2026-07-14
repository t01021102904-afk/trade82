import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const access = await import(new URL("../src/lib/internal-order-test-access-rules.ts", import.meta.url).href);
const rules = await import(new URL("../src/lib/internal-order-test-rules.ts", import.meta.url).href);
const security = await import(new URL("../src/lib/api-security.ts", import.meta.url).href);

const tester = "user_3Fm24HRzecKpHvt45f690eSTqRN";
const environment = {
  INTERNAL_ORDER_TEST_MODE: "on",
  INTERNAL_ORDER_TESTER_CLERK_IDS: tester,
  TRADE_ORDER_SYSTEM_MODE: "off",
  MANUAL_PAYOUT_SYSTEM_MODE: "off",
};

const files = {
  schema: new URL("../prisma/schema.prisma", import.meta.url),
  migration: new URL("../prisma/migrations/20260714090000_add_internal_order_test_runs/migration.sql", import.meta.url),
  page: new URL("../src/app/admin/order-system-test/page.tsx", import.meta.url),
  route: new URL("../src/app/api/admin/order-system-test/route.ts", import.meta.url),
  service: new URL("../src/lib/internal-order-test-service.ts", import.meta.url),
  client: new URL("../src/components/internal-order-system-test-client.tsx", import.meta.url),
};

const source = Object.fromEntries(
  await Promise.all(
    Object.entries(files).map(async ([key, file]) => [key, await readFile(file, "utf8")]),
  ),
) as Record<keyof typeof files, string>;

test("internal test mode fails closed for missing, off, blank, malformed, signed-out, and unauthorized users", () => {
  assert.equal(access.isInternalOrderTestEnabledForClerkUser(tester, {}), false);
  assert.equal(access.isInternalOrderTestEnabledForClerkUser(tester, { ...environment, INTERNAL_ORDER_TEST_MODE: "off" }), false);
  assert.equal(access.isInternalOrderTestEnabledForClerkUser(tester, { ...environment, INTERNAL_ORDER_TEST_MODE: "ON" }), false);
  assert.equal(access.isInternalOrderTestEnabledForClerkUser(tester, { ...environment, TRADE_ORDER_SYSTEM_MODE: "internal" }), false);
  assert.equal(access.isInternalOrderTestEnabledForClerkUser(tester, { ...environment, MANUAL_PAYOUT_SYSTEM_MODE: "on" }), false);
  assert.equal(access.isInternalOrderTestEnabledForClerkUser(tester, { ...environment, INTERNAL_ORDER_TESTER_CLERK_IDS: "" }), false);
  assert.equal(access.isInternalOrderTestEnabledForClerkUser(tester, { ...environment, INTERNAL_ORDER_TESTER_CLERK_IDS: `${tester},not-a-clerk-id` }), false);
  assert.equal(access.isInternalOrderTestEnabledForClerkUser(null, environment), false);
  assert.equal(access.isInternalOrderTestEnabledForClerkUser("user_not_allowlisted", environment), false);
});

test("only the explicitly authorized Clerk user is enabled", () => {
  assert.equal(access.isInternalOrderTestEnabledForClerkUser(tester, environment), true);
  assert.equal(access.isInternalOrderTestEnabledForClerkUser(`${tester} `, environment), false);
  assert.equal(access.isInternalOrderTestEnabledForClerkUser("profile_cuid_not_a_clerk_user", environment), false);
});

test("page and API enforce the server-side internal test gate and CSRF protection", () => {
  assert.match(source.page, /getInternalOrderTestAccess\(\)/);
  assert.match(source.page, /if \(!access\) notFound\(\)/);
  assert.match(source.route, /requireInternalOrderTestAccess\(\)/);
  assert.match(source.route, /assertSameOrigin\(request\)/);
  assert.match(source.route, /rateLimitOrResponse/);
  assert.throws(
    () => security.assertSameOrigin(new Request("https://trade82.com/api/admin/order-system-test", { method: "POST" })),
    (error) => error instanceof Response && error.status === 403,
  );
  assert.doesNotThrow(() => security.assertSameOrigin(new Request("https://trade82.com/api/admin/order-system-test", { method: "POST", headers: { origin: "https://trade82.com", host: "trade82.com" } })));
  assert.throws(
    () => security.assertSameOrigin(new Request("https://trade82.com/api/admin/order-system-test", { method: "POST", headers: { origin: "https://evil.example", host: "trade82.com" } })),
    (error) => error instanceof Response && error.status === 403,
  );
});

test("test records are permanently marked, isolated, direct-access restricted, and cannot affect public data", () => {
  assert.match(source.schema, /model InternalOrderTestRun/);
  assert.match(source.schema, /isInternalTest\s+Boolean\s+@default\(true\)/);
  assert.match(source.schema, /testLabel\s+String\s+@default\("INTERNAL_PRODUCTION_TEST"\)/);
  assert.match(source.migration, /CHECK \("isInternalTest" = true\)/);
  assert.match(source.migration, /CHECK \("testLabel" = 'INTERNAL_PRODUCTION_TEST'\)/);
  assert.match(source.migration, /ENABLE ROW LEVEL SECURITY/);
  assert.match(source.migration, /REVOKE ALL PRIVILEGES ON TABLE "InternalOrderTestRun" FROM anon, authenticated/);
  assert.doesNotMatch(source.service, /paymentRequest\.|tradeOrder\.|sellerPayout\./);
});

test("server calculations use integer USD minor units with deterministic five-percent fee and non-negative seller net", () => {
  assert.deepEqual(
    rules.calculateInternalOrderTestFinancials(100_000, 0),
    { grossAmount: 100_000, platformFeeAmount: 5_000, sellerPayableAmount: 95_000, currency: "usd" },
  );
  assert.equal(rules.eligibleInternalOrderTestPayout(95_000, 0), 95_000);
  assert.equal(rules.eligibleInternalOrderTestPayout(95_000, 100_000), 0);
  assert.throws(() => rules.calculateInternalOrderTestFinancials(10.5, 0));
  assert.throws(() => rules.calculateInternalOrderTestFinancials(-1, 0));
});

test("invalid state transitions and excessive simulated refunds are rejected", () => {
  assert.doesNotThrow(() => rules.assertCanSimulatePayment("CREATED", null));
  assert.throws(() => rules.assertCanSimulatePayment("SIMULATED_PAID", null));
  assert.doesNotThrow(() => rules.assertCanSimulateRefund("SIMULATED_PAID", 100_000, 10_000, null));
  assert.throws(() => rules.assertCanSimulateRefund("CREATED", 100_000, 10_000, null));
  assert.throws(() => rules.assertCanSimulateRefund("SIMULATED_PAID", 100_000, 100_001, null));
  assert.throws(() => rules.assertCanSimulateRefund("SIMULATED_PAID", 100_000, 0, null));
  assert.equal(rules.refundStatusForInternalOrderTest(100_000, 10_000), "SIMULATED_PARTIALLY_REFUNDED");
  assert.equal(rules.refundStatusForInternalOrderTest(100_000, 100_000), "SIMULATED_REFUNDED");
  assert.doesNotThrow(() => rules.assertCanCancelInternalOrderTest("CREATED"));
  assert.throws(() => rules.assertCanCancelInternalOrderTest("SIMULATED_PAID"));
});

test("payout preview cannot exceed eligible seller proceeds and duplicate preview is structurally prevented", () => {
  assert.equal(rules.assertCanGenerateInternalOrderTestPayoutPreview({ status: "SIMULATED_PAID", simulatedPaidAmount: 100_000, sellerPayableAmount: 95_000, simulatedRefundAmount: 10_000 }), 85_000);
  assert.throws(() => rules.assertCanGenerateInternalOrderTestPayoutPreview({ status: "SIMULATED_REFUNDED", simulatedPaidAmount: 100_000, sellerPayableAmount: 95_000, simulatedRefundAmount: 100_000 }));
  assert.match(source.service, /if \(run\.payoutPreviewGeneratedAt\) return \{ run, created: false \}/);
  assert.match(source.service, /version: expectedVersion/);
  assert.match(source.service, /version: \{ increment: 1 \}/);
});

test("test records are rejected from financial execution and never import external financial services", () => {
  assert.throws(() => rules.assertInternalOrderTestNeverExecutesFinancialOperation({ isInternalTest: true, testLabel: rules.INTERNAL_ORDER_TEST_LABEL }), /cannot execute payments, refunds, transfers, payouts, or financial notifications/);
  assert.doesNotMatch(source.service, /from "@\/lib\/stripe"|from "stripe"|getStripe|checkout\.sessions|refunds\.create|transfers\.create/i);
  assert.doesNotMatch(source.route, /getStripe|checkout\.sessions|refunds\.create|transfers\.create|sendTradeOrderNotification/i);
  assert.match(source.client, /NO REAL PAYMENT, REFUND, TRANSFER, OR PAYOUT/);
});

test("create actions use an idempotency key and mutation actions use optimistic versions", () => {
  assert.match(source.route, /idempotencyKey/);
  assert.match(source.service, /where: \{ idempotencyKey: input\.idempotencyKey \}/);
  assert.match(source.service, /updateMany\(/);
  assert.match(source.service, /expectedVersion/);
});
