import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { randomBytes } from "node:crypto";
import { promisify } from "node:util";
import { after, test } from "node:test";

import { Pool } from "pg";

import type { PrismaClient } from "../src/generated/prisma/client.ts";

const execFile = promisify(execFileCallback);

function assertDisposableDatabase() {
  const value = process.env.DATABASE_URL;
  assert.ok(value, "DATABASE_URL is required for the disposable integration suite.");
  const url = new URL(value);
  assert.ok(["127.0.0.1", "localhost"].includes(url.hostname), "The integration database must be localhost only.");
  assert.ok(/^trade82_order_payout_test_/.test(url.pathname.slice(1)), "The integration database name is not disposable.");
  assert.ok(!/(supabase|neon|aws|vercel|render|railway|fly)/i.test(url.hostname), "A remote database is never valid for this suite.");
}

assertDisposableDatabase();
process.env.DATABASE_POOL_MAX = "12";

const { getDb } = await import(new URL("../src/lib/db.ts", import.meta.url).href);
const tradeOrders = await import(new URL("../src/lib/trade-orders.ts", import.meta.url).href);
const payouts = await import(new URL("../src/lib/seller-payouts.ts", import.meta.url).href);
const profiles = await import(new URL("../src/lib/seller-payout-profiles.ts", import.meta.url).href);
const financials = await import(new URL("../src/lib/order-financials.ts", import.meta.url).href);
const crypto = await import(new URL("../src/lib/payout-crypto.ts", import.meta.url).href);
const flags = await import(new URL("../src/lib/trade-order-feature.ts", import.meta.url).href);
const csv = await import(new URL("../src/lib/csv-security.ts", import.meta.url).href);
const orderTable = await import(new URL("../src/lib/admin-order-table.ts", import.meta.url).href);
const bankSeed = await import(new URL("../src/lib/south-korea-bank-directory.ts", import.meta.url).href);

const db = getDb() as PrismaClient;
const directPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });

after(async () => {
  await db.$disconnect();
  await directPool.end();
});

let sequence = 0;

function unique(prefix: string) {
  sequence += 1;
  return `${prefix}-${Date.now().toString(36)}-${sequence}`;
}

type Fixture = Awaited<ReturnType<typeof createFixture>>;
type PaymentRequestClient = Pick<typeof db, "paymentRequest">;

async function createFixture(prefix = "fixture") {
  const suffix = unique(prefix);
  const [buyer, seller, admin] = await Promise.all([
    db.userProfile.create({
      data: {
        clerkUserId: `user_test_order_buyer_${suffix}`,
        email: `buyer-${suffix}@example.test`,
        displayName: "Buyer Test",
        country: "US",
        role: "buyer",
      },
    }),
    db.userProfile.create({
      data: {
        clerkUserId: `user_test_order_seller_${suffix}`,
        email: `seller-${suffix}@example.test`,
        displayName: "Seller Test",
        country: "KR",
        role: "seller",
      },
    }),
    db.userProfile.create({
      data: {
        clerkUserId: `user_test_order_admin_${suffix}`,
        email: `admin-${suffix}@example.test`,
        displayName: "Admin Test",
        country: "US",
        role: "admin",
      },
    }),
  ]);
  const [buyerCompany, sellerCompany] = await Promise.all([
    db.company.create({
      data: {
        ownerUserId: buyer.id,
        companyRole: "buyer",
        legalName: `Buyer ${suffix}`,
        tradeName: `Buyer ${suffix}`,
        country: "US",
        city: "New York",
        businessAddress: "Buyer address",
      },
    }),
    db.company.create({
      data: {
        ownerUserId: seller.id,
        companyRole: "seller",
        legalName: `Seller ${suffix}`,
        tradeName: `Seller ${suffix}`,
        country: "KR",
        city: "Seoul",
        businessAddress: "Seller address",
      },
    }),
  ]);
  const product = await db.product.create({
    data: {
      sellerCompanyId: sellerCompany.id,
      name: `Product ${suffix}`,
      slug: `product-${suffix}`.toLowerCase(),
      category: "Beauty",
      shortDescription: "Integration-test product.",
      detailedDescription: "Integration-test product description.",
      moq: "10",
      leadTime: "14 days",
      ingredientsOrMaterials: "Test material",
      packaging: "Test packaging",
      status: "active",
    },
  });
  const inquiry = await db.inquiry.create({
    data: {
      buyerCompanyId: buyerCompany.id,
      sellerCompanyId: sellerCompany.id,
      productId: product.id,
      senderUserId: buyer.id,
      recipientCompanyId: sellerCompany.id,
      message: "Please quote this product.",
    },
  });
  const message = await db.message.create({
    data: {
      inquiryId: inquiry.id,
      senderUserId: buyer.id,
      receiverUserId: seller.id,
      senderCompanyId: buyerCompany.id,
      receiverCompanyId: sellerCompany.id,
      body: "Normal message remains independent from orders.",
    },
  });
  return { buyer, seller, admin, buyerCompany, sellerCompany, product, inquiry, message };
}

async function createPaymentRequest(client: PaymentRequestClient, fixture: Fixture, suffix = unique("payment")) {
  const values = financials.calculateOrderFinancials(10_000, 1_000);
  return client.paymentRequest.create({
    data: {
      inquiryId: fixture.inquiry.id,
      buyerCompanyId: fixture.buyerCompany.id,
      sellerCompanyId: fixture.sellerCompany.id,
      createdByUserId: fixture.seller.id,
      productName: fixture.product.name,
      quantity: "10",
      unit: "units",
      productAmount: 10_000,
      shippingAmount: 1_000,
      grossAmount: values.grossAmount,
      platformFeeAmount: values.platformFeeAmount,
      sellerPayableAmount: values.sellerPayableAmount,
      currency: "usd",
      paymentDueDate: new Date(Date.now() + 86_400_000),
      orderTerms: `Integration test terms ${suffix}`,
    },
  });
}

async function createOrder(fixture: Fixture) {
  return db.$transaction(async (tx) => {
    const paymentRequest = await createPaymentRequest(tx, fixture);
    return tradeOrders.createTradeOrderForPaymentRequest(tx, paymentRequest.id, new Date("2026-07-13T12:00:00.000Z"));
  });
}

async function markOrderPaid(orderId: string) {
  const order = await db.tradeOrder.findUniqueOrThrow({
    where: { id: orderId },
    select: { paymentRequestId: true },
  });
  return db.$transaction(async (tx) => {
    const paymentRequest = await tx.paymentRequest.update({
      where: { id: order.paymentRequestId },
      data: { status: "PAID", paidAt: new Date() },
    });
    await tradeOrders.syncTradeOrderFromPaymentRequest(tx, paymentRequest, "paid");
    return paymentRequest;
  });
}

async function createVerifiedProfile(fixture: Fixture, accountNumber = `TEST-${unique("account")}-1234`) {
  const saved = (await db.$transaction((tx) =>
    profiles.saveSellerPayoutProfile({
      db: tx,
      companyId: fixture.sellerCompany.id,
      input: {
        country: "KR",
        bankName: "Integration Test Bank",
        accountHolder: "Integration Seller",
        accountNumber,
        accountType: "LOCAL",
        payoutCurrency: "usd",
        supportedCurrencies: ["usd"],
        accountBelongsToCompany: true,
        manualBankOverride: false,
      },
    }),
  )) as { id: string };
  return db.sellerPayoutProfile.update({
    where: { id: saved.id },
    data: { status: "VERIFIED", verifiedAt: new Date(), verifiedByUserId: fixture.admin.id },
  });
}

async function createReadyPayout(prefix = "ready-payout") {
  const fixture = await createFixture(prefix);
  const order = await createOrder(fixture);
  await markOrderPaid(order.id);
  await createVerifiedProfile(fixture);
  const payout = await payouts.prepareSellerPayout({ orderId: order.id, actorUserId: fixture.admin.id });
  return { fixture, order, payout };
}

async function assertProcessingIsBlocked(payoutId: string, actorUserId: string) {
  const before = await db.sellerPayout.findUniqueOrThrow({
    where: { id: payoutId },
    select: {
      status: true,
      preparedAt: true,
      approvedAt: true,
      sentAt: true,
      finalPayoutAmount: true,
      order: { select: { paymentRequest: { select: { releasedAt: true } } } },
    },
  });
  const processingEvents = await db.sellerPayoutEvent.count({ where: { payoutId, eventType: "PROCESSING" } });
  await assert.rejects(
    payouts.setSellerPayoutStatus({ payoutId, actorUserId, status: "PROCESSING" }),
    /on hold|sent or cancelled/i,
  );
  const after = await db.sellerPayout.findUniqueOrThrow({
    where: { id: payoutId },
    select: {
      status: true,
      preparedAt: true,
      approvedAt: true,
      sentAt: true,
      finalPayoutAmount: true,
      order: { select: { paymentRequest: { select: { releasedAt: true } } } },
    },
  });
  assert.deepEqual(after, before);
  assert.equal(await db.sellerPayoutEvent.count({ where: { payoutId, eventType: "PROCESSING" } }), processingEvents);
}

async function runBankSeed() {
  await execFile(process.execPath, ["--experimental-strip-types", "scripts/seed-south-korea-bank-directory.ts"], {
    cwd: process.cwd(),
    env: process.env,
  });
}

async function assertRoleCannotAccess(role: "anon" | "authenticated", query: string) {
  const rolePool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  const client = await rolePool.connect();
  try {
    await client.query(`SET ROLE ${role}`);
    let error: unknown;
    try {
      await client.query(query);
    } catch (caught) {
      error = caught;
    }
    assert.match(String(error), /permission denied/i);
  } finally {
    client.release();
    await rolePool.end();
  }
}

async function transactionWithRetry<T>(run: () => Promise<T>) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
      const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
      if (code !== "P2034" && !/could not serialize/i.test(String(error))) throw error;
    }
  }
  throw lastError;
}

test("payment requests and orders are atomic, while feature-off payments and messaging remain compatible", async () => {
  const fixture = await createFixture("atomic");
  const order = await createOrder(fixture);
  const linked = await db.paymentRequest.findUniqueOrThrow({ where: { id: order.paymentRequestId } });
  assert.equal(linked.orderId, order.id);
  assert.equal(await db.tradeOrder.count({ where: { paymentRequestId: linked.id } }), 1);

  const failedMarker = unique("rollback");
  await assert.rejects(
    db.$transaction(async (tx) => {
      const paymentRequest = await createPaymentRequest(tx, fixture, failedMarker);
      await tx.paymentRequest.update({
        where: { id: paymentRequest.id },
        data: { grossAmount: paymentRequest.grossAmount + 1 },
      });
      await tradeOrders.createTradeOrderForPaymentRequest(tx, paymentRequest.id);
    }),
  );
  assert.equal(await db.paymentRequest.count({ where: { orderTerms: `Integration test terms ${failedMarker}` } }), 0);

  assert.equal(
    flags.isTradeOrderSystemEnabledForClerkUser(fixture.buyer.clerkUserId, { TRADE_ORDER_SYSTEM_MODE: "off" }),
    false,
  );
  const featureOffPayment = await createPaymentRequest(db, fixture, unique("feature-off"));
  assert.equal(featureOffPayment.orderId, null);
  assert.equal(await db.tradeOrder.count({ where: { paymentRequestId: featureOffPayment.id } }), 0);
  assert.equal(await db.message.count({ where: { id: fixture.message.id } }), 1);
});

test("order and payout counters allocate unique numbers under concurrent database transactions", async () => {
  const orderNumbers = (await Promise.all(
    Array.from({ length: 24 }, () =>
      transactionWithRetry(() =>
        db.$transaction((tx) => tradeOrders.nextTradeOrderNumber(tx, new Date("2026-07-13T12:00:00.000Z"))),
      ),
    ),
  )) as string[];
  const payoutNumbers = (await Promise.all(
    Array.from({ length: 24 }, () =>
      transactionWithRetry(() =>
        db.$transaction((tx) => tradeOrders.nextSellerPayoutNumber(tx, new Date("2026-07-13T12:00:00.000Z"))),
      ),
    ),
  )) as string[];
  assert.equal(new Set(orderNumbers).size, orderNumbers.length);
  assert.equal(new Set(payoutNumbers).size, payoutNumbers.length);
  assert.ok(orderNumbers.every((value) => value.startsWith("T82-2026-")));
  assert.ok(payoutNumbers.every((value) => value.startsWith("PAY-T82-2026-")));
});

test("a single order can prepare only one payout during concurrent requests", async () => {
  const fixture = await createFixture("duplicate-payout");
  const order = await createOrder(fixture);
  await markOrderPaid(order.id);
  await createVerifiedProfile(fixture);
  const results = await Promise.allSettled([
    payouts.prepareSellerPayout({ orderId: order.id, actorUserId: fixture.admin.id }),
    payouts.prepareSellerPayout({ orderId: order.id, actorUserId: fixture.admin.id }),
  ]);
  assert.equal(await db.sellerPayout.count({ where: { orderId: order.id } }), 1);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
});

test("a paid eligible payout can enter processing", async () => {
  const { fixture, payout } = await createReadyPayout("processing-eligible");
  await payouts.setSellerPayoutStatus({
    payoutId: payout.id,
    actorUserId: fixture.admin.id,
    status: "PROCESSING",
  });
  assert.equal((await db.sellerPayout.findUniqueOrThrow({ where: { id: payout.id } })).status, "PROCESSING");
  assert.equal(await db.sellerPayoutEvent.count({ where: { payoutId: payout.id, eventType: "PROCESSING" } }), 1);
});

test("cancelled orders and payouts cannot enter processing", async () => {
  const cancelledOrder = await createReadyPayout("processing-cancelled-order");
  await db.tradeOrder.update({
    where: { id: cancelledOrder.order.id },
    data: { orderStatus: "CANCELLED", payoutStatus: "CANCELLED" },
  });
  await assertProcessingIsBlocked(cancelledOrder.payout.id, cancelledOrder.fixture.admin.id);

  const cancelledPayout = await createReadyPayout("processing-cancelled-payout");
  await db.sellerPayout.update({ where: { id: cancelledPayout.payout.id }, data: { status: "CANCELLED" } });
  await assertProcessingIsBlocked(cancelledPayout.payout.id, cancelledPayout.fixture.admin.id);
});

test("active disputes and reconciliation holds cannot enter processing", async () => {
  const activeDispute = await createReadyPayout("processing-active-dispute");
  await db.paymentDispute.create({
    data: {
      paymentRequestId: activeDispute.order.paymentRequestId,
      stripeDisputeId: `dp_${unique("processing-active")}`,
      amount: 11_000,
      status: "needs_response",
    },
  });
  await assertProcessingIsBlocked(activeDispute.payout.id, activeDispute.fixture.admin.id);

  const reconciliation = await createReadyPayout("processing-reconciliation");
  await db.paymentRequest.update({
    where: { id: reconciliation.order.paymentRequestId },
    data: { requiresManualReconciliation: true },
  });
  await assertProcessingIsBlocked(reconciliation.payout.id, reconciliation.fixture.admin.id);
});

test("simultaneous SENT actions release payment only once", async () => {
  const { fixture, order, payout } = await createReadyPayout("sent-race");
  const sentAt = new Date();
  const results = await Promise.allSettled([
    payouts.markSellerPayoutSent({
      payoutId: payout.id,
      actorUserId: fixture.admin.id,
      externalTransferReference: `wire-${unique("one")}`,
      sentAt,
      confirmation: payout.payoutNumber,
    }),
    payouts.markSellerPayoutSent({
      payoutId: payout.id,
      actorUserId: fixture.admin.id,
      externalTransferReference: `wire-${unique("two")}`,
      sentAt,
      confirmation: payout.payoutNumber,
    }),
  ]);
  assert.ok(results.some((result) => result.status === "fulfilled"));
  const persisted = await db.sellerPayout.findUniqueOrThrow({ where: { id: payout.id } });
  const paymentRequest = await db.paymentRequest.findUniqueOrThrow({ where: { id: order.paymentRequestId } });
  assert.equal(persisted.status, "SENT");
  assert.equal(paymentRequest.status, "RELEASED");
  assert.equal(await db.sellerPayoutEvent.count({ where: { payoutId: payout.id, eventType: "SENT" } }), 1);
});

test("refunds, full refunds, disputes, and sent payouts hold or preserve payouts correctly", async () => {
  const partial = await createReadyPayout("partial-refund");
  await db.$transaction(async (tx) => {
    const request = await tx.paymentRequest.update({
      where: { id: partial.order.paymentRequestId },
      data: { status: "PARTIALLY_REFUNDED", refundAmount: 500 },
    });
    await tradeOrders.syncTradeOrderFromPaymentRequest(tx, request, "refund");
  });
  assert.equal((await db.sellerPayout.findUniqueOrThrow({ where: { id: partial.payout.id } })).status, "HOLD");
  assert.equal((await db.tradeOrder.findUniqueOrThrow({ where: { id: partial.order.id } })).payoutStatus, "HOLD");
  await assertProcessingIsBlocked(partial.payout.id, partial.fixture.admin.id);

  const fullRefund = await createReadyPayout("full-refund");
  await db.$transaction(async (tx) => {
    const request = await tx.paymentRequest.update({
      where: { id: fullRefund.order.paymentRequestId },
      data: { status: "REFUNDED", refundAmount: 11_000 },
    });
    await tradeOrders.syncTradeOrderFromPaymentRequest(tx, request, "refund");
  });
  await assertProcessingIsBlocked(fullRefund.payout.id, fullRefund.fixture.admin.id);

  const dispute = await createReadyPayout("dispute");
  await db.$transaction(async (tx) => {
    await tx.paymentDispute.create({
      data: { paymentRequestId: dispute.order.paymentRequestId, stripeDisputeId: `dp_${unique("dispute")}`, amount: 11_000, status: "needs_response" },
    });
    const request = await tx.paymentRequest.update({ where: { id: dispute.order.paymentRequestId }, data: { status: "DISPUTED" } });
    await tradeOrders.syncTradeOrderFromPaymentRequest(tx, request, "dispute");
  });
  assert.equal((await db.sellerPayout.findUniqueOrThrow({ where: { id: dispute.payout.id } })).status, "HOLD");
  await assertProcessingIsBlocked(dispute.payout.id, dispute.fixture.admin.id);

  const sent = await createReadyPayout("sent-refund");
  await payouts.markSellerPayoutSent({
    payoutId: sent.payout.id,
    actorUserId: sent.fixture.admin.id,
    externalTransferReference: `wire-${unique("sent")}`,
    sentAt: new Date(),
    confirmation: sent.payout.payoutNumber,
  });
  await db.$transaction(async (tx) => {
    const request = await tx.paymentRequest.update({
      where: { id: sent.order.paymentRequestId },
      data: { status: "REFUNDED", refundAmount: 11_000, requiresManualReconciliation: true },
    });
    await tradeOrders.syncTradeOrderFromPaymentRequest(tx, request, "refund");
  });
  const preserved = await db.sellerPayout.findUniqueOrThrow({ where: { id: sent.payout.id } });
  const sentOrder = await db.tradeOrder.findUniqueOrThrow({ where: { id: sent.order.id } });
  assert.equal(preserved.status, "SENT");
  assert.equal(sentOrder.payoutStatus, "HOLD");
  assert.ok(preserved.externalTransferReference);
  await assertProcessingIsBlocked(sent.payout.id, sent.fixture.admin.id);
});

test("a concurrent refund cannot leave a payout in processing", async () => {
  const { fixture, order, payout } = await createReadyPayout("processing-refund-race");
  const results = await Promise.allSettled([
    payouts.setSellerPayoutStatus({ payoutId: payout.id, actorUserId: fixture.admin.id, status: "PROCESSING" }),
    db.$transaction(async (tx) => {
      const request = await tx.paymentRequest.update({
        where: { id: order.paymentRequestId },
        data: { status: "PARTIALLY_REFUNDED", refundAmount: 500 },
      });
      await tradeOrders.syncTradeOrderFromPaymentRequest(tx, request, "refund");
    }),
  ]);
  assert.equal(results[1].status, "fulfilled");
  assert.equal((await db.paymentRequest.findUniqueOrThrow({ where: { id: order.paymentRequestId } })).status, "PARTIALLY_REFUNDED");
  assert.equal((await db.sellerPayout.findUniqueOrThrow({ where: { id: payout.id } })).status, "HOLD");
  assert.equal((await db.tradeOrder.findUniqueOrThrow({ where: { id: order.id } })).payoutStatus, "HOLD");
});

test("adjustments use an immutable ledger with safe totals and post-sent reconciliation", async () => {
  const ready = await createReadyPayout("adjustments");
  const credit = await payouts.addSellerPayoutAdjustment({
    payoutId: ready.payout.id,
    actorUserId: ready.fixture.admin.id,
    adjustmentType: "CREDIT",
    amount: 500,
    currency: "usd",
    reason: "Documented seller credit.",
    confirmation: ready.payout.payoutNumber,
  });
  const debit = await payouts.addSellerPayoutAdjustment({
    payoutId: ready.payout.id,
    actorUserId: ready.fixture.admin.id,
    adjustmentType: "BANK_FEE",
    amount: 300,
    currency: "usd",
    reason: "Documented bank fee.",
    confirmation: ready.payout.payoutNumber,
  });
  assert.equal(credit.finalPayoutAmount, 10_950);
  assert.equal(debit.finalPayoutAmount, 10_650);
  await assert.rejects(
    payouts.addSellerPayoutAdjustment({
      payoutId: ready.payout.id,
      actorUserId: ready.fixture.admin.id,
      adjustmentType: "DEBIT",
      amount: 0,
      currency: "usd",
      reason: "Zero amount.",
      confirmation: ready.payout.payoutNumber,
    }),
  );
  await assert.rejects(
    payouts.addSellerPayoutAdjustment({
      payoutId: ready.payout.id,
      actorUserId: ready.fixture.admin.id,
      adjustmentType: "DEBIT",
      amount: 20_000,
      currency: "usd",
      reason: "Unsafe negative total.",
      confirmation: ready.payout.payoutNumber,
    }),
  );
  const adjustment = credit.adjustment;
  await assert.rejects(
    db.sellerPayoutAdjustment.update({ where: { id: adjustment.id }, data: { reason: "rewrite" } }),
    /immutable/i,
  );
  await assert.rejects(db.sellerPayoutAdjustment.delete({ where: { id: adjustment.id } }), /immutable/i);

  const sent = await createReadyPayout("sent-adjustment");
  await payouts.markSellerPayoutSent({
    payoutId: sent.payout.id,
    actorUserId: sent.fixture.admin.id,
    externalTransferReference: `wire-${unique("adjustment")}`,
    sentAt: new Date(),
    confirmation: sent.payout.payoutNumber,
  });
  const before = await db.sellerPayout.findUniqueOrThrow({ where: { id: sent.payout.id } });
  const postSent = await payouts.addSellerPayoutAdjustment({
    payoutId: sent.payout.id,
    actorUserId: sent.fixture.admin.id,
    adjustmentType: "DEBIT",
    amount: 100,
    currency: "usd",
    reason: "Post-sent reconciliation item.",
    confirmation: sent.payout.payoutNumber,
  });
  const afterSent = await db.sellerPayout.findUniqueOrThrow({ where: { id: sent.payout.id } });
  assert.equal(postSent.reconciliationRequired, true);
  assert.equal(afterSent.finalPayoutAmount, before.finalPayoutAmount);
  assert.equal((await db.tradeOrder.findUniqueOrThrow({ where: { id: sent.order.id } })).payoutStatus, "HOLD");
});

test("authorization scopes cross-company reads and allows only audited administrative decryption", async () => {
  const owner = await createReadyPayout("authorization-owner");
  const other = await createReadyPayout("authorization-other");
  const buyerScope = await db.tradeOrder.findFirst({
    where: { id: other.order.id, buyerCompany: { ownerUserId: owner.fixture.buyer.id } },
    select: { id: true },
  });
  const sellerScope = await db.sellerPayoutProfile.findFirst({
    where: { companyId: other.fixture.sellerCompany.id, company: { ownerUserId: owner.fixture.seller.id } },
    select: { id: true },
  });
  assert.equal(buyerScope, null);
  assert.equal(sellerScope, null);
  assert.notEqual(owner.fixture.seller.id, owner.fixture.admin.id);
  assert.notEqual(owner.fixture.sellerCompany.ownerUserId, owner.fixture.admin.id);

  const encryptedProfile = await db.sellerPayoutProfile.findUniqueOrThrow({ where: { companyId: owner.fixture.sellerCompany.id } });
  const accountNumber = (await db.$transaction((tx) =>
    profiles.revealSellerPayoutProfileAccount({
      db: tx,
      payoutProfileId: encryptedProfile.id,
      actorUserId: owner.fixture.admin.id,
      reason: "Integration audit review",
    }),
  )) as string;
  assert.ok(accountNumber.endsWith("1234"));
  assert.equal(
    await db.sellerPayoutProfileAuditEvent.count({
      where: { payoutProfileId: encryptedProfile.id, actorUserId: owner.fixture.admin.id, action: "ACCOUNT_REVEALED" },
    }),
    1,
  );

  for (const role of ["anon", "authenticated"] as const) {
    await assertRoleCannotAccess(role, 'SELECT * FROM "SellerPayoutProfile" LIMIT 1');
    await assertRoleCannotAccess(role, 'INSERT INTO "TradeOrder" DEFAULT VALUES');
  }
});

test("payout account data remains encrypted, decrypts only with its correct key, and snapshots are historical", async () => {
  const fixture = await createFixture("encryption");
  const firstAccount = `FIRST-${unique("account")}-1234`;
  const profile = await createVerifiedProfile(fixture, firstAccount);
  const raw = await directPool.query<{ encoded: string }>(
    'SELECT encode("accountNumberCiphertext", \'base64\') AS encoded FROM "SellerPayoutProfile" WHERE id = $1',
    [profile.id],
  );
  assert.equal(raw.rows.length, 1);
  assert.ok(!raw.rows[0].encoded.includes(firstAccount));
  const order = await createOrder(fixture);
  await markOrderPaid(order.id);
  const payout = await payouts.prepareSellerPayout({ orderId: order.id, actorUserId: fixture.admin.id });
  const snapshot = await db.sellerPayout.findUniqueOrThrow({ where: { id: payout.id } });
  const decryptedSnapshot = crypto.decryptPayoutData({
    ciphertext: Buffer.from(snapshot.beneficiarySnapshotEncrypted),
    iv: Buffer.from(snapshot.beneficiarySnapshotIv),
    authTag: Buffer.from(snapshot.beneficiarySnapshotAuthTag),
    keyVersion: snapshot.beneficiarySnapshotKeyVersion,
  });
  assert.ok(decryptedSnapshot.includes(firstAccount));

  const currentKey = process.env.PAYOUT_DATA_ENCRYPTION_KEY;
  process.env.PAYOUT_DATA_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  try {
    assert.throws(() => crypto.decryptPayoutData({
      ciphertext: Buffer.from(snapshot.beneficiarySnapshotEncrypted),
      iv: Buffer.from(snapshot.beneficiarySnapshotIv),
      authTag: Buffer.from(snapshot.beneficiarySnapshotAuthTag),
      keyVersion: snapshot.beneficiarySnapshotKeyVersion,
    }));
  } finally {
    if (currentKey) process.env.PAYOUT_DATA_ENCRYPTION_KEY = currentKey;
  }

  await db.$transaction((tx) =>
    profiles.saveSellerPayoutProfile({
      db: tx,
      companyId: fixture.sellerCompany.id,
      input: {
        country: "KR",
        bankName: "Integration Test Bank",
        accountHolder: "Integration Seller",
        accountNumber: `SECOND-${unique("account")}-9876`,
        accountType: "LOCAL",
        payoutCurrency: "usd",
        supportedCurrencies: ["usd"],
        accountBelongsToCompany: true,
        manualBankOverride: false,
      },
    }),
  );
  const replacedProfile = await db.sellerPayoutProfile.findUniqueOrThrow({
    where: { companyId: fixture.sellerCompany.id },
    select: {
      status: true,
      verifiedAt: true,
      verifiedByUserId: true,
      accountNumberLast4: true,
      accountNumberMasked: true,
      accountNumberCiphertext: true,
    },
  });
  assert.equal(replacedProfile.status, "PENDING_VERIFICATION");
  assert.equal(replacedProfile.verifiedAt, null);
  assert.equal(replacedProfile.verifiedByUserId, null);
  assert.equal(replacedProfile.accountNumberLast4, "9876");
  assert.equal(replacedProfile.accountNumberMasked, "•••• 9876");
  assert.ok(replacedProfile.accountNumberCiphertext);
  assert.ok(!Buffer.from(replacedProfile.accountNumberCiphertext).toString("base64").includes("9876"));
  const unchangedSnapshot = await db.sellerPayout.findUniqueOrThrow({ where: { id: payout.id } });
  const historical = crypto.decryptPayoutData({
    ciphertext: Buffer.from(unchangedSnapshot.beneficiarySnapshotEncrypted),
    iv: Buffer.from(unchangedSnapshot.beneficiarySnapshotIv),
    authTag: Buffer.from(unchangedSnapshot.beneficiarySnapshotAuthTag),
    keyVersion: unchangedSnapshot.beneficiarySnapshotKeyVersion,
  });
  assert.ok(historical.includes(firstAccount));
});

test("RLS, schema constraints, and the Korean bank seed are enforced by PostgreSQL", async () => {
  const requiredTables = [
    "OrderNumberCounter",
    "TradeOrder",
    "TradeOrderItem",
    "TradeOrderShipment",
    "TradeOrderEvent",
    "BankDirectory",
    "SellerPayoutProfile",
    "SellerPayoutProfileAuditEvent",
    "SellerPayout",
    "SellerPayoutEvent",
    "SellerPayoutAdjustment",
  ];
  const tableMetadata = await directPool.query<{ relname: string; relrowsecurity: boolean }>(
    "SELECT c.relname, c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = ANY($1::text[])",
    [requiredTables],
  );
  assert.equal(tableMetadata.rows.length, requiredTables.length);
  assert.ok(tableMetadata.rows.every((row) => row.relrowsecurity));
  const paymentOrderColumn = await directPool.query<{ is_nullable: string }>(
    "SELECT is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PaymentRequest' AND column_name = 'orderId'",
  );
  assert.equal(paymentOrderColumn.rows[0]?.is_nullable, "YES");
  const requiredForeignKeys = [
    "TradeOrder_inquiryId_fkey",
    "TradeOrder_paymentRequestId_fkey",
    "TradeOrder_buyerCompanyId_fkey",
    "TradeOrder_sellerCompanyId_fkey",
    "SellerPayout_orderId_fkey",
    "SellerPayout_sellerCompanyId_fkey",
    "SellerPayout_payoutProfileId_fkey",
    "SellerPayoutAdjustment_payoutId_fkey",
    "SellerPayoutAdjustment_createdByUserId_fkey",
  ];
  const foreignKeys = await directPool.query<{ conname: string; confdeltype: string }>(
    "SELECT conname, confdeltype FROM pg_constraint WHERE contype = 'f' AND conname = ANY($1::text[])",
    [requiredForeignKeys],
  );
  assert.equal(foreignKeys.rows.length, requiredForeignKeys.length);
  assert.ok(foreignKeys.rows.every((row) => row.confdeltype === "r"));
  const uniqueIndexes = await directPool.query<{ indexname: string }>(
    "SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname = ANY($1::text[])",
    [["TradeOrder_orderNumber_key", "SellerPayout_payoutNumber_key", "SellerPayout_orderId_key"]],
  );
  assert.equal(uniqueIndexes.rows.length, 3);

  await runBankSeed();
  const initialBanks = await db.bankDirectory.findMany({ where: { countryCode: "KR" }, orderBy: { bankNameEnglish: "asc" } });
  assert.equal(initialBanks.length, bankSeed.SOUTH_KOREAN_BANK_DIRECTORY_SEED.length);
  assert.ok(initialBanks.every((bank) => bank.defaultSwiftBic === null && bank.defaultBankAddress === null && bank.officialWebsite === null));
  const edited = initialBanks[0];
  await db.bankDirectory.update({
    where: { id: edited.id },
    data: { sourceType: "ADMIN_OVERRIDE", officialWebsite: "https://admin.example.test/bank", verifiedAt: new Date() },
  });
  await runBankSeed();
  const afterSeed = await db.bankDirectory.findMany({ where: { countryCode: "KR" } });
  assert.equal(afterSeed.length, bankSeed.SOUTH_KOREAN_BANK_DIRECTORY_SEED.length);
  const preserved = await db.bankDirectory.findUniqueOrThrow({ where: { id: edited.id } });
  assert.equal(preserved.sourceType, "ADMIN_OVERRIDE");
  assert.equal(preserved.officialWebsite, "https://admin.example.test/bank");
  assert.ok(afterSeed.filter((bank) => bank.id !== edited.id).every((bank) => bank.sourceType === "SEED" && bank.defaultSwiftBic === null && bank.defaultBankAddress === null && bank.officialWebsite === null));
});

test("authorized CSV output stays filtered, masked, and formula-safe", async () => {
  const ready = await createReadyPayout("csv");
  const fullStripeId = `pi_private_${unique("stripe")}`;
  await db.paymentRequest.update({ where: { id: ready.order.paymentRequestId }, data: { stripePaymentIntentId: fullStripeId } });
  const owned = await db.tradeOrder.findMany({
    where: { sellerCompanyId: ready.fixture.sellerCompany.id },
    include: { payout: true, paymentRequest: true },
  });
  assert.equal(owned.length, 1);
  const row = owned[0];
  const output = [
    csv.csvCell(row.orderNumber),
    csv.csvCell(row.payout?.accountNumberLast4 ? `•••• ${row.payout.accountNumberLast4}` : ""),
    csv.csvCell(orderTable.maskStripeIdentifier(row.paymentRequest.stripePaymentIntentId, "pi")),
    csv.csvCell("=SUM(1,1)"),
  ].join(",");
  assert.ok(output.includes("•••• 1234"));
  assert.ok(output.includes("pi_..."));
  assert.ok(!output.includes(fullStripeId));
  assert.ok(output.includes("'=SUM(1,1)"));
});
