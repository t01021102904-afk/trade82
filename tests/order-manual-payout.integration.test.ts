import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { randomBytes } from "node:crypto";
import { promisify } from "node:util";
import { after, test } from "node:test";

import { Pool } from "pg";
import type Stripe from "stripe";

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
const settlements = await import(new URL("../src/lib/stripe-connect-settlements.ts", import.meta.url).href);
const settlementRelease = await import(new URL("../src/lib/stripe-connect-settlement-release.ts", import.meta.url).href);
const settlementWebhook = await import(new URL("../src/lib/stripe-connect-settlement-webhook.ts", import.meta.url).href);
const transferExecution = await import(new URL("../src/lib/stripe-connect-transfer-execution.ts", import.meta.url).href);
const reversalExecution = await import(new URL("../src/lib/stripe-connect-transfer-reversal-execution.ts", import.meta.url).href);
const accountDeletion = await import(new URL("../src/lib/account-deletion.ts", import.meta.url).href);
const settlementReleaseCron = await import(new URL("../src/app/api/cron/settlements/release/route.ts", import.meta.url).href);
const paymentRequests = await import(new URL("../src/lib/payment-requests.ts", import.meta.url).href);
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

test("account deletion tombstones public data without deleting financial identity rows", async () => {
  const fixture = await createFixture("account-deletion");
  const partner = await db.partnerProfile.create({
    data: {
      userId: fixture.seller.id,
      referralCode: unique("deleted-partner").toUpperCase(),
    },
  });
  await db.referralClaimToken.create({
    data: {
      tokenHash: unique("claim-token"),
      partnerProfileId: partner.id,
      expiresAt: new Date(Date.now() + 60_000),
    },
  });

  await accountDeletion.markAccountDeletionPending(fixture.seller.id);
  const result = await accountDeletion.cleanupTrade82AccountData({
    userProfileId: fixture.seller.id,
    clerkUserId: fixture.seller.clerkUserId,
  });

  assert.equal(result.productCount, 1);
  const [deletedUser, deletedCompany, deletedProduct, deletedPartner, tokenCount] = await Promise.all([
    db.userProfile.findUniqueOrThrow({ where: { id: fixture.seller.id } }),
    db.company.findUniqueOrThrow({ where: { id: fixture.sellerCompany.id } }),
    db.product.findUniqueOrThrow({ where: { id: fixture.product.id } }),
    db.partnerProfile.findUniqueOrThrow({ where: { id: partner.id } }),
    db.referralClaimToken.count({ where: { partnerProfileId: partner.id } }),
  ]);
  assert.equal(deletedUser.deletionStatus, "DELETED");
  assert.ok(deletedUser.deletedAt);
  assert.notEqual(deletedUser.email, fixture.seller.email);
  assert.ok(deletedCompany.deletedAt);
  assert.equal(deletedCompany.verificationStatus, "rejected");
  assert.equal(deletedProduct.status, "draft");
  assert.ok(deletedProduct.deletedAt);
  assert.equal(deletedPartner.status, "SUSPENDED");
  assert.ok(deletedPartner.deletedAt);
  assert.equal(tokenCount, 0);

  const freshProfile = await db.userProfile.create({
    data: {
      clerkUserId: unique("fresh-clerk"),
      email: fixture.seller.email,
      displayName: "Fresh seller identity",
      role: "user",
    },
  });
  assert.notEqual(freshProfile.id, deletedUser.id);
  assert.equal(await db.company.count({ where: { ownerUserId: freshProfile.id } }), 0);
  assert.equal(await db.partnerProfile.count({ where: { userId: freshProfile.id } }), 0);
});

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

async function createVerifiedProfile(fixture: Fixture, accountNumber = "1000000000001234") {
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

async function withStripeConnectSettlementMode<T>(
  mode: "off" | "on",
  run: () => Promise<T>,
) {
  const previous = process.env.STRIPE_CONNECT_SETTLEMENT_MODE;
  process.env.STRIPE_CONNECT_SETTLEMENT_MODE = mode;
  try {
    return await run();
  } finally {
    if (previous === undefined) {
      delete process.env.STRIPE_CONNECT_SETTLEMENT_MODE;
    } else {
      process.env.STRIPE_CONNECT_SETTLEMENT_MODE = previous;
    }
  }
}

async function createVerifiedSettlementWebhookEvidence(
  paymentRequestId: string,
  confirmationSource: "checkout_session" | "payment_intent" = "checkout_session",
) {
  const paymentRequest = await db.paymentRequest.update({
    where: { id: paymentRequestId },
    data: {
      stripeCheckoutSessionId: `cs_${unique("settlement")}`,
      stripePaymentIntentId: `pi_${unique("settlement")}`,
      stripeChargeId: `ch_${unique("settlement")}`,
    },
    select: {
      id: true,
      grossAmount: true,
      stripeCheckoutSessionId: true,
      stripePaymentIntentId: true,
    },
  });

  return {
    paymentRequestId: paymentRequest.id,
    paymentIntentId: paymentRequest.stripePaymentIntentId,
    checkoutSessionId:
      confirmationSource === "checkout_session"
        ? paymentRequest.stripeCheckoutSessionId
        : null,
    grossAmount: paymentRequest.grossAmount,
    currency: "usd",
    confirmationSource,
  } as const;
}

async function setReferralLockedAtOnOrBeforePayment(
  attributionId: string,
  paidAt: Date,
  offsetMilliseconds = 1,
) {
  return db.referralAttribution.update({
    where: { id: attributionId },
    data: { lockedAt: new Date(paidAt.getTime() - offsetMilliseconds) },
  });
}

async function createReconciliableSettlement(
  prefix: string,
  { withReferral = false }: { withReferral?: boolean } = {},
) {
  const fixture = await createFixture(prefix);
  const order = await createOrder(fixture);
  const paymentRequest = await markOrderPaid(order.id);
  const evidence = await createVerifiedSettlementWebhookEvidence(paymentRequest.id);

  let referralAttributionId: string | undefined;
  if (withReferral) {
    const partnerUser = await db.userProfile.create({
      data: {
        clerkUserId: `user_test_reconciliation_partner_${unique(prefix)}`,
        email: `${unique(prefix)}@example.test`,
        displayName: "Settlement Reconciliation Partner",
        country: "US",
        role: "buyer",
      },
    });
    const partner = await db.partnerProfile.create({
      data: { userId: partnerUser.id, referralCode: unique("reconciliation-partner") },
    });
    const attribution = (await db.$transaction((tx) => settlements.lockReferralAttribution(tx, {
      referredUserId: fixture.seller.id,
      partnerProfileId: partner.id,
    }))) as { attribution: { id: string } };
    await setReferralLockedAtOnOrBeforePayment(attribution.attribution.id, paymentRequest.paidAt!);
    referralAttributionId = attribution.attribution.id;
  }

  const result = (await db.$transaction((tx) => settlements.createPendingSettlementForVerifiedPayment(tx, {
    paymentRequestId: paymentRequest.id,
    referralAttributionId,
  }))) as { settlement: { id: string } };
  return { fixture, order, paymentRequest, evidence, settlement: result.settlement };
}

async function enableCompanyTransfers(companyId: string) {
  return db.stripeConnectedAccount.create({
    data: {
      companyId,
      stripeAccountId: `acct_${unique("seller-transfer")}`,
      status: "ENABLED",
      chargesEnabled: true,
      payoutsEnabled: true,
      transfersEnabled: true,
      detailsSubmitted: true,
      onboardingComplete: true,
    },
  });
}

async function expireSettlementHold(settlementId: string) {
  const expiredAt = new Date(Date.now() - 60_000);
  await db.$transaction([
    db.settlement.update({ where: { id: settlementId }, data: { holdUntil: expiredAt } }),
    db.settlementLeg.updateMany({ where: { settlementId }, data: { holdUntil: expiredAt } }),
  ]);
  return expiredAt;
}

function stripeRefund({
  id,
  paymentIntentId,
  amount,
  status = "succeeded",
}: {
  id: string;
  paymentIntentId: string;
  amount: number;
  status?: string;
}) {
  return {
    id,
    payment_intent: paymentIntentId,
    amount,
    status,
  } as Stripe.Refund;
}

function stripeDispute({
  id,
  paymentIntentId,
  amount,
  status,
}: {
  id: string;
  paymentIntentId: string;
  amount: number;
  status: string;
}) {
  return {
    id,
    payment_intent: paymentIntentId,
    amount,
    currency: "usd",
    status,
    reason: "fraudulent",
  } as Stripe.Dispute;
}

function stripeWebhookEvent(stripeEventType: string, stripeEventCreatedAt = new Date()) {
  return {
    stripeEventId: `evt_${unique("settlement-webhook")}`,
    stripeEventType,
    stripeEventCreatedAt,
  };
}

test("settlement reversal trigger uses an explicit search path and its composite foreign key index", async () => {
  const functionResult = await directPool.query<{ proconfig: string[] | null }>(
    `SELECT p.proconfig
     FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = 'checkSettlementReversalLeg'
       AND p.pronargs = 0`,
  );
  assert.equal(functionResult.rowCount, 1);
  assert.match(functionResult.rows[0]?.proconfig?.join("\n") ?? "", /search_path=pg_catalog, public/);

  const indexResult = await directPool.query<{ indexdef: string }>(
    `SELECT indexdef
     FROM pg_indexes
     WHERE schemaname = 'public'
       AND tablename = 'SettlementReversal'
       AND indexname = 'SettlementReversal_settlementId_settlementLegId_idx'`,
  );
  assert.equal(indexResult.rowCount, 1);
  assert.match(
    indexResult.rows[0]?.indexdef ?? "",
    /\("settlementId", "settlementLegId"\)/,
  );
});

test("verified payments create one fourteen-day pending settlement ledger with fixed referral attribution", async () => {
  const fixture = await createFixture("connect-settlement");
  const order = await createOrder(fixture);
  const paymentRequest = await markOrderPaid(order.id);
  const partnerUser = await db.userProfile.create({
    data: {
      clerkUserId: `user_test_order_partner_${unique("connect-settlement")}`,
      email: `${unique("partner")}@example.test`,
      displayName: "Partner Test",
      country: "US",
      role: "buyer",
    },
  });
  const partner = await db.partnerProfile.create({
    data: {
      userId: partnerUser.id,
      referralCode: unique("partner"),
    },
  });

  const attribution = (await db.$transaction((tx) => settlements.lockReferralAttribution(tx, {
    referredUserId: fixture.seller.id,
    partnerProfileId: partner.id,
  }))) as { created: boolean; attribution: { id: string } };
  const duplicateAttribution = (await db.$transaction((tx) => settlements.lockReferralAttribution(tx, {
    referredUserId: fixture.seller.id,
    partnerProfileId: partner.id,
  }))) as { created: boolean; attribution: { id: string } };
  await setReferralLockedAtOnOrBeforePayment(
    attribution.attribution.id,
    paymentRequest.paidAt!,
  );
  assert.equal(attribution.created, true);
  assert.equal(duplicateAttribution.created, false);
  assert.equal(duplicateAttribution.attribution.id, attribution.attribution.id);

  const first = (await db.$transaction((tx) =>
    settlements.createPendingSettlementForVerifiedPayment(tx, {
      paymentRequestId: paymentRequest.id,
      referralAttributionId: attribution.attribution.id,
    }),
  )) as {
    created: boolean;
    settlement: {
      id: string;
      legs: unknown[];
      referralAttributionId: string | null;
      referralPartnerProfileId: string | null;
      referralCodeSnapshot: string | null;
      referralSubjectType: "BUYER" | "SELLER" | null;
      referredUserIdSnapshot: string | null;
      sellerPayableAmount: number;
      platformFeeAmount: number;
      partnerReferralAmount: number;
      trade82RetainedAmountBeforeStripeFees: number;
      holdUntil: Date;
    };
  };
  const duplicate = (await db.$transaction((tx) =>
    settlements.createPendingSettlementForVerifiedPayment(tx, {
      paymentRequestId: paymentRequest.id,
      referralAttributionId: attribution.attribution.id,
    }),
  )) as { created: boolean; settlement: { id: string } };
  assert.equal(first.created, true);
  assert.equal(duplicate.created, false);
  assert.equal(duplicate.settlement.id, first.settlement.id);
  assert.equal(first.settlement.legs.length, 3);
  assert.equal(first.settlement.referralAttributionId, attribution.attribution.id);
  assert.equal(first.settlement.referralPartnerProfileId, partner.id);
  assert.equal(first.settlement.referralCodeSnapshot, partner.referralCode);
  assert.equal(first.settlement.referralSubjectType, "SELLER");
  assert.equal(first.settlement.referredUserIdSnapshot, fixture.seller.id);
  assert.equal(first.settlement.sellerPayableAmount, 10_450);
  assert.equal(first.settlement.platformFeeAmount, 550);
  assert.equal(first.settlement.partnerReferralAmount, 55);
  assert.equal(first.settlement.trade82RetainedAmountBeforeStripeFees, 495);
  assert.equal(
    first.settlement.holdUntil.getTime() - paymentRequest.paidAt!.getTime(),
    14 * 24 * 60 * 60 * 1_000,
  );
});

test("verified checkout and PaymentIntent retries backfill one matching settlement ledger", async () => {
  const pendingFixture = await createFixture("settlement-webhook-pending");
  const pendingOrder = await createOrder(pendingFixture);
  const pendingEvidence = await createVerifiedSettlementWebhookEvidence(
    pendingOrder.paymentRequestId,
  );
  const pendingSettlement = await withStripeConnectSettlementMode("on", () =>
    settlementWebhook.createSettlementLedgerAfterVerifiedPayment(pendingEvidence),
  );
  assert.equal(pendingSettlement, null);
  assert.equal(
    await db.settlement.count({ where: { paymentRequestId: pendingOrder.paymentRequestId } }),
    0,
  );

  const fixture = await createFixture("settlement-webhook-backfill");
  const order = await createOrder(fixture);
  const payment = await markOrderPaid(order.id);
  const checkoutEvidence = await createVerifiedSettlementWebhookEvidence(payment.id);
  const paymentIntentEvidence = {
    ...checkoutEvidence,
    checkoutSessionId: null,
    confirmationSource: "payment_intent" as const,
  };

  const featureOff = await withStripeConnectSettlementMode("off", () =>
    settlementWebhook.createSettlementLedgerAfterVerifiedPayment(checkoutEvidence),
  );
  assert.equal(featureOff, null);
  assert.equal(await db.settlement.count({ where: { paymentRequestId: payment.id } }), 0);

  const checkoutDelivery = await withStripeConnectSettlementMode("on", () =>
    settlementWebhook.createSettlementLedgerAfterVerifiedPayment(checkoutEvidence),
  ) as { created: boolean; settlement: { id: string; legs: Array<{ type: string; status: string; amount: number; holdUntil: Date }> } };
  const paymentIntentDelivery = await withStripeConnectSettlementMode("on", () =>
    settlementWebhook.createSettlementLedgerAfterVerifiedPayment(paymentIntentEvidence),
  ) as { created: boolean; settlement: { id: string } };

  assert.equal(checkoutDelivery.created, true);
  assert.equal(paymentIntentDelivery.created, false);
  assert.equal(paymentIntentDelivery.settlement.id, checkoutDelivery.settlement.id);
  assert.equal(await db.settlement.count({ where: { paymentRequestId: payment.id } }), 1);
  assert.deepEqual(
    checkoutDelivery.settlement.legs.map((leg) => [leg.type, leg.amount, leg.status]).sort(),
    [
      ["PLATFORM_FEE", 550, "HOLD"],
      ["SELLER_PAYABLE", 10_450, "HOLD"],
    ],
  );
  for (const leg of checkoutDelivery.settlement.legs) {
    assert.equal(
      leg.holdUntil.getTime() - payment.paidAt!.getTime(),
      14 * 24 * 60 * 60 * 1_000,
    );
  }
});

test("verified-payment settlement ledger snapshots only referrals locked by the payment time", async () => {
  const partnerUser = await db.userProfile.create({
    data: {
      clerkUserId: `user_test_order_partner_${unique("settlement-webhook-referral")}`,
      email: `${unique("partner")}@example.test`,
      displayName: "Webhook Settlement Partner",
      country: "US",
      role: "buyer",
    },
  });
  const partner = await db.partnerProfile.create({
    data: { userId: partnerUser.id, referralCode: unique("settlement-webhook-partner") },
  });

  const buyerFixture = await createFixture("settlement-webhook-buyer");
  const buyerOrder = await createOrder(buyerFixture);
  const buyerPayment = await markOrderPaid(buyerOrder.id);
  const buyerAttribution = (await db.$transaction((tx) => settlements.lockReferralAttribution(tx, {
    referredUserId: buyerFixture.buyer.id,
    partnerProfileId: partner.id,
  }))) as { attribution: { id: string } };
  await setReferralLockedAtOnOrBeforePayment(
    buyerAttribution.attribution.id,
    buyerPayment.paidAt!,
  );
  const buyerEvidence = await createVerifiedSettlementWebhookEvidence(buyerPayment.id);
  const buyerSettlement = (await withStripeConnectSettlementMode("on", () =>
    settlementWebhook.createSettlementLedgerAfterVerifiedPayment(buyerEvidence),
  )) as {
    settlement: {
      referralAttributionId: string | null;
      referralSubjectType: "BUYER" | "SELLER" | null;
      referredUserIdSnapshot: string | null;
      partnerReferralAmount: number;
      trade82RetainedAmountBeforeStripeFees: number;
      legs: Array<{ type: string; amount: number; status: string }>;
    };
  };
  assert.equal(buyerSettlement.settlement.referralAttributionId, buyerAttribution.attribution.id);
  assert.equal(buyerSettlement.settlement.referralSubjectType, "BUYER");
  assert.equal(buyerSettlement.settlement.referredUserIdSnapshot, buyerFixture.buyer.id);
  assert.equal(buyerSettlement.settlement.partnerReferralAmount, 55);
  assert.equal(buyerSettlement.settlement.trade82RetainedAmountBeforeStripeFees, 495);
  assert.deepEqual(
    buyerSettlement.settlement.legs.map((leg) => [leg.type, leg.amount, leg.status]).sort(),
    [
      ["PARTNER_REFERRAL", 55, "HOLD"],
      ["PLATFORM_FEE", 495, "HOLD"],
      ["SELLER_PAYABLE", 10_450, "HOLD"],
    ],
  );

  const sellerFixture = await createFixture("settlement-webhook-seller");
  const sellerOrder = await createOrder(sellerFixture);
  const sellerPayment = await markOrderPaid(sellerOrder.id);
  const sellerAttribution = (await db.$transaction((tx) =>
    settlements.lockReferralAttribution(tx, {
      referredUserId: sellerFixture.seller.id,
      partnerProfileId: partner.id,
    }),
  )) as { attribution: { id: string } };
  await setReferralLockedAtOnOrBeforePayment(
    sellerAttribution.attribution.id,
    sellerPayment.paidAt!,
  );
  const sellerEvidence = await createVerifiedSettlementWebhookEvidence(sellerPayment.id);
  const sellerSettlement = (await withStripeConnectSettlementMode("on", () =>
    settlementWebhook.createSettlementLedgerAfterVerifiedPayment(sellerEvidence),
  )) as {
    settlement: {
      referralAttributionId: string | null;
      referralSubjectType: "BUYER" | "SELLER" | null;
      referredUserIdSnapshot: string | null;
      legs: Array<{ type: string; amount: number; status: string }>;
    };
  };
  assert.equal(sellerSettlement.settlement.referralAttributionId, sellerAttribution.attribution.id);
  assert.equal(sellerSettlement.settlement.referralSubjectType, "SELLER");
  assert.equal(sellerSettlement.settlement.referredUserIdSnapshot, sellerFixture.seller.id);
  assert.deepEqual(
    sellerSettlement.settlement.legs.map((leg) => [leg.type, leg.amount, leg.status]).sort(),
    [
      ["PARTNER_REFERRAL", 55, "HOLD"],
      ["PLATFORM_FEE", 495, "HOLD"],
      ["SELLER_PAYABLE", 10_450, "HOLD"],
    ],
  );

  const bothFixture = await createFixture("settlement-webhook-both");
  const bothOrder = await createOrder(bothFixture);
  const bothPayment = await markOrderPaid(bothOrder.id);
  const [buyerLocked, sellerLocked] = await Promise.all([
    db.$transaction((tx) => settlements.lockReferralAttribution(tx, {
      referredUserId: bothFixture.buyer.id,
      partnerProfileId: partner.id,
    })),
    db.$transaction((tx) => settlements.lockReferralAttribution(tx, {
      referredUserId: bothFixture.seller.id,
      partnerProfileId: partner.id,
    })),
  ]) as Array<{ attribution: { id: string } }>;
  const earlierSellerLock = new Date(bothPayment.paidAt!.getTime() - 2_000);
  const laterBuyerLock = new Date(bothPayment.paidAt!.getTime() - 1_000);
  await Promise.all([
    db.referralAttribution.update({ where: { id: buyerLocked.attribution.id }, data: { lockedAt: laterBuyerLock } }),
    db.referralAttribution.update({ where: { id: sellerLocked.attribution.id }, data: { lockedAt: earlierSellerLock } }),
  ]);
  const bothEvidence = await createVerifiedSettlementWebhookEvidence(bothPayment.id);
  const bothSettlement = (await withStripeConnectSettlementMode("on", () =>
    settlementWebhook.createSettlementLedgerAfterVerifiedPayment(bothEvidence),
  )) as { settlement: { referralAttributionId: string | null; referralSubjectType: "BUYER" | "SELLER" | null } };
  assert.equal(bothSettlement.settlement.referralAttributionId, sellerLocked.attribution.id);
  assert.equal(bothSettlement.settlement.referralSubjectType, "SELLER");

  const tieFixture = await createFixture("settlement-webhook-tie");
  const tieOrder = await createOrder(tieFixture);
  const tiePayment = await markOrderPaid(tieOrder.id);
  const [tieBuyerLocked, tieSellerLocked] = await Promise.all([
    db.$transaction((tx) => settlements.lockReferralAttribution(tx, {
      referredUserId: tieFixture.buyer.id,
      partnerProfileId: partner.id,
    })),
    db.$transaction((tx) => settlements.lockReferralAttribution(tx, {
      referredUserId: tieFixture.seller.id,
      partnerProfileId: partner.id,
    })),
  ]) as Array<{ attribution: { id: string } }>;
  const tiedLock = tiePayment.paidAt!;
  await db.referralAttribution.updateMany({
    where: { id: { in: [tieBuyerLocked.attribution.id, tieSellerLocked.attribution.id] } },
    data: { lockedAt: tiedLock },
  });
  const tieEvidence = await createVerifiedSettlementWebhookEvidence(tiePayment.id);
  const tieSettlement = (await withStripeConnectSettlementMode("on", () =>
    settlementWebhook.createSettlementLedgerAfterVerifiedPayment(tieEvidence),
  )) as { settlement: { referralAttributionId: string | null } };
  assert.equal(
    tieSettlement.settlement.referralAttributionId,
    [tieBuyerLocked.attribution.id, tieSellerLocked.attribution.id].sort()[0],
  );
});

test("settlement webhook evidence blocks mismatches and reconciliation while preserving retry safety", async () => {
  const fixture = await createFixture("settlement-webhook-evidence");
  const order = await createOrder(fixture);
  const payment = await markOrderPaid(order.id);
  const evidence = await createVerifiedSettlementWebhookEvidence(payment.id);

  const rejectedEvidence = [
    { ...evidence, paymentRequestId: `unrelated-${payment.id}` },
    { ...evidence, paymentIntentId: `pi_mismatch_${unique("settlement")}` },
    { ...evidence, checkoutSessionId: `cs_mismatch_${unique("settlement")}` },
    { ...evidence, grossAmount: evidence.grossAmount + 1 },
    { ...evidence, currency: "eur" },
  ];
  for (const mismatchedEvidence of rejectedEvidence) {
    const result = await withStripeConnectSettlementMode("on", () =>
      settlementWebhook.createSettlementLedgerAfterVerifiedPayment(mismatchedEvidence),
    );
    assert.equal(result, null);
  }
  assert.equal(await db.settlement.count({ where: { paymentRequestId: payment.id } }), 0);

  await db.paymentRequest.update({
    where: { id: payment.id },
    data: { requiresManualReconciliation: true },
  });
  assert.equal(
    await withStripeConnectSettlementMode("on", () =>
      settlementWebhook.createSettlementLedgerAfterVerifiedPayment(evidence),
    ),
    null,
  );
  assert.equal(await db.settlement.count({ where: { paymentRequestId: payment.id } }), 0);

  await db.paymentRequest.update({
    where: { id: payment.id },
    data: { requiresManualReconciliation: false },
  });
  const paidBeforeFailure = await db.paymentRequest.findUniqueOrThrow({
    where: { id: payment.id },
    select: { paidAt: true, platformFeeAmount: true, status: true },
  });
  await db.paymentRequest.update({
    where: { id: payment.id },
    data: { platformFeeAmount: paidBeforeFailure.platformFeeAmount + 1 },
  });
  await assert.rejects(
    withStripeConnectSettlementMode("on", () =>
      settlementWebhook.createSettlementLedgerAfterVerifiedPayment(evidence),
    ),
    /financials do not match/i,
  );
  const afterFailure = await db.paymentRequest.findUniqueOrThrow({
    where: { id: payment.id },
    select: { paidAt: true, status: true },
  });
  assert.equal(afterFailure.status, "PAID");
  assert.equal(afterFailure.paidAt?.getTime(), paidBeforeFailure.paidAt?.getTime());
  assert.equal(await db.settlement.count({ where: { paymentRequestId: payment.id } }), 0);

  await db.paymentRequest.update({
    where: { id: payment.id },
    data: { platformFeeAmount: paidBeforeFailure.platformFeeAmount },
  });
  const retry = await withStripeConnectSettlementMode("on", () =>
    settlementWebhook.createSettlementLedgerAfterVerifiedPayment(evidence),
  ) as { created: boolean; settlement: { id: string } };
  const duplicateRetry = await withStripeConnectSettlementMode("on", () =>
    settlementWebhook.createSettlementLedgerAfterVerifiedPayment(evidence),
  ) as { created: boolean; settlement: { id: string } };
  assert.equal(retry.created, true);
  assert.equal(duplicateRetry.created, false);
  assert.equal(duplicateRetry.settlement.id, retry.settlement.id);
  assert.equal(await db.settlement.count({ where: { paymentRequestId: payment.id } }), 1);
});

test("a referral locked after payment receives no commission while an exact-time lock remains eligible", async () => {
  const partnerUser = await db.userProfile.create({
    data: {
      clerkUserId: `user_test_order_partner_${unique("settlement-referral-cutoff")}`,
      email: `${unique("partner")}@example.test`,
      displayName: "Referral Cutoff Partner",
      country: "US",
      role: "buyer",
    },
  });
  const partner = await db.partnerProfile.create({
    data: { userId: partnerUser.id, referralCode: unique("settlement-referral-cutoff") },
  });

  const afterFixture = await createFixture("settlement-referral-after-payment");
  const afterOrder = await createOrder(afterFixture);
  const afterPayment = await markOrderPaid(afterOrder.id);
  const afterAttribution = (await db.$transaction((tx) => settlements.lockReferralAttribution(tx, {
    referredUserId: afterFixture.buyer.id,
    partnerProfileId: partner.id,
  }))) as { attribution: { id: string } };
  await db.referralAttribution.update({
    where: { id: afterAttribution.attribution.id },
    data: { lockedAt: new Date(afterPayment.paidAt!.getTime() + 1) },
  });
  const afterEvidence = await createVerifiedSettlementWebhookEvidence(afterPayment.id);
  const afterSettlement = (await withStripeConnectSettlementMode("on", () =>
    settlementWebhook.createSettlementLedgerAfterVerifiedPayment(afterEvidence),
  )) as { settlement: { referralAttributionId: string | null; partnerReferralAmount: number; legs: Array<{ type: string }> } };
  assert.equal(afterSettlement.settlement.referralAttributionId, null);
  assert.equal(afterSettlement.settlement.partnerReferralAmount, 0);
  assert.equal(
    afterSettlement.settlement.legs.some((leg) => leg.type === "PARTNER_REFERRAL"),
    false,
  );

  const exactFixture = await createFixture("settlement-referral-exact-payment");
  const exactOrder = await createOrder(exactFixture);
  const exactPayment = await markOrderPaid(exactOrder.id);
  const exactAttribution = (await db.$transaction((tx) => settlements.lockReferralAttribution(tx, {
    referredUserId: exactFixture.seller.id,
    partnerProfileId: partner.id,
  }))) as { attribution: { id: string } };
  await db.referralAttribution.update({
    where: { id: exactAttribution.attribution.id },
    data: { lockedAt: exactPayment.paidAt! },
  });
  const exactEvidence = await createVerifiedSettlementWebhookEvidence(exactPayment.id);
  const exactSettlement = (await withStripeConnectSettlementMode("on", () =>
    settlementWebhook.createSettlementLedgerAfterVerifiedPayment(exactEvidence),
  )) as { settlement: { referralAttributionId: string | null; referralSubjectType: "BUYER" | "SELLER" | null; partnerReferralAmount: number } };
  assert.equal(exactSettlement.settlement.referralAttributionId, exactAttribution.attribution.id);
  assert.equal(exactSettlement.settlement.referralSubjectType, "SELLER");
  assert.equal(exactSettlement.settlement.partnerReferralAmount, 55);
});

test("settlement referral ownership and reversal legs are constrained by the ledger", async () => {
  const partnerUser = await db.userProfile.create({
    data: {
      clerkUserId: `user_test_order_partner_${unique("settlement-constraints")}`,
      email: `${unique("partner")}@example.test`,
      displayName: "Settlement Partner",
      country: "US",
      role: "buyer",
    },
  });
  const partner = await db.partnerProfile.create({
    data: { userId: partnerUser.id, referralCode: unique("settlement-partner") },
  });

  const sellerFixture = await createFixture("settlement-seller-referral");
  const sellerOrder = await createOrder(sellerFixture);
  const sellerPayment = await markOrderPaid(sellerOrder.id);
  const sellerAttribution = (await db.$transaction((tx) => settlements.lockReferralAttribution(tx, {
    referredUserId: sellerFixture.seller.id,
    partnerProfileId: partner.id,
  }))) as { attribution: { id: string } };
  await setReferralLockedAtOnOrBeforePayment(
    sellerAttribution.attribution.id,
    sellerPayment.paidAt!,
  );
  const sellerResult = (await db.$transaction((tx) =>
    settlements.createPendingSettlementForVerifiedPayment(tx, {
      paymentRequestId: sellerPayment.id,
      referralAttributionId: sellerAttribution.attribution.id,
    }),
  )) as {
    settlement: {
      id: string;
      referralSubjectType: "BUYER" | "SELLER" | null;
      referredUserIdSnapshot: string | null;
    };
  };
  assert.equal(sellerResult.settlement.referralSubjectType, "SELLER");
  assert.equal(sellerResult.settlement.referredUserIdSnapshot, sellerFixture.seller.id);

  const buyerFixture = await createFixture("settlement-buyer-referral");
  const buyerOrder = await createOrder(buyerFixture);
  const buyerPayment = await markOrderPaid(buyerOrder.id);
  const buyerAttribution = (await db.$transaction((tx) => settlements.lockReferralAttribution(tx, {
    referredUserId: buyerFixture.buyer.id,
    partnerProfileId: partner.id,
  }))) as { attribution: { id: string } };
  await setReferralLockedAtOnOrBeforePayment(
    buyerAttribution.attribution.id,
    buyerPayment.paidAt!,
  );
  const buyerResult = (await db.$transaction((tx) =>
    settlements.createPendingSettlementForVerifiedPayment(tx, {
      paymentRequestId: buyerPayment.id,
      referralAttributionId: buyerAttribution.attribution.id,
    }),
  )) as {
    settlement: {
      id: string;
      referralSubjectType: "BUYER" | "SELLER" | null;
      referredUserIdSnapshot: string | null;
    };
  };
  assert.equal(buyerResult.settlement.referralSubjectType, "BUYER");
  assert.equal(buyerResult.settlement.referredUserIdSnapshot, buyerFixture.buyer.id);

  const unrelatedUser = await db.userProfile.create({
    data: {
      clerkUserId: `user_test_order_unrelated_${unique("settlement-constraints")}`,
      email: `${unique("unrelated")}@example.test`,
      displayName: "Unrelated User",
      country: "US",
      role: "buyer",
    },
  });
  const unrelatedFixture = await createFixture("settlement-unrelated-referral");
  const unrelatedOrder = await createOrder(unrelatedFixture);
  const unrelatedPayment = await markOrderPaid(unrelatedOrder.id);
  const unrelatedAttribution = (await db.$transaction((tx) => settlements.lockReferralAttribution(tx, {
    referredUserId: unrelatedUser.id,
    partnerProfileId: partner.id,
  }))) as { attribution: { id: string } };
  await assert.rejects(
    db.$transaction((tx) => settlements.createPendingSettlementForVerifiedPayment(tx, {
      paymentRequestId: unrelatedPayment.id,
      referralAttributionId: unrelatedAttribution.attribution.id,
    })),
    /exactly one transaction party/i,
  );
  assert.equal(await db.settlement.count({ where: { paymentRequestId: unrelatedPayment.id } }), 0);

  const sellerLegs = await db.settlementLeg.findMany({ where: { settlementId: sellerResult.settlement.id } });
  const sellerPayableLeg = sellerLegs.find((leg) => leg.type === "SELLER_PAYABLE");
  const partnerLeg = sellerLegs.find((leg) => leg.type === "PARTNER_REFERRAL");
  const platformFeeLeg = sellerLegs.find((leg) => leg.type === "PLATFORM_FEE");
  assert.ok(sellerPayableLeg);
  assert.ok(partnerLeg);
  assert.ok(platformFeeLeg);

  const stripeRefundId = `re_${unique("multi-leg-refund")}`;
  await db.settlementReversal.create({
    data: {
      settlementId: sellerResult.settlement.id,
      settlementLegId: sellerPayableLeg.id,
      amount: 100,
      reason: "REFUND",
      idempotencyKey: unique("seller-reversal"),
      stripeRefundId,
    },
  });
  await db.settlementReversal.create({
    data: {
      settlementId: sellerResult.settlement.id,
      settlementLegId: partnerLeg.id,
      amount: 10,
      reason: "REFUND",
      idempotencyKey: unique("partner-reversal"),
      stripeRefundId,
    },
  });
  assert.equal(await db.settlementReversal.count({ where: { stripeRefundId } }), 2);

  await assert.rejects(
    db.settlementReversal.create({
      data: {
        settlementId: sellerResult.settlement.id,
        settlementLegId: sellerPayableLeg.id,
        amount: 1,
        reason: "REFUND",
        status: "COMPLETED",
        idempotencyKey: unique("completed-without-stripe-reversal"),
        stripeRefundId: `re_${unique("completed-without-stripe-reversal")}`,
      },
    }),
    /SettlementReversal_stripeTransferReversalId_status_check/i,
  );
  await assert.rejects(
    db.settlementReversal.create({
      data: {
        settlementId: sellerResult.settlement.id,
        settlementLegId: sellerPayableLeg.id,
        amount: 1,
        reason: "REFUND",
        status: "ACCOUNTING_APPLIED",
        stripeTransferReversalId: `trr_${unique("accounting-applied")}`,
        idempotencyKey: unique("accounting-applied-with-stripe-reversal"),
        stripeRefundId: `re_${unique("accounting-applied")}`,
      },
    }),
    /SettlementReversal_stripeTransferReversalId_status_check/i,
  );

  await assert.rejects(
    db.settlementReversal.create({
      data: {
        settlementId: sellerResult.settlement.id,
        settlementLegId: platformFeeLeg.id,
        amount: 100,
        reason: "REFUND",
        idempotencyKey: unique("platform-reversal"),
        stripeRefundId: `re_${unique("platform")}`,
      },
    }),
    /seller or partner settlement leg/i,
  );

  const buyerSellerLeg = await db.settlementLeg.findFirstOrThrow({
    where: { settlementId: buyerResult.settlement.id, type: "SELLER_PAYABLE" },
  });
  await assert.rejects(
    db.settlementReversal.create({
      data: {
        settlementId: sellerResult.settlement.id,
        settlementLegId: buyerSellerLeg.id,
        amount: 100,
        reason: "REFUND",
        idempotencyKey: unique("cross-settlement-reversal"),
        stripeRefundId: `re_${unique("cross-settlement")}`,
      },
    }),
  );

  await assert.rejects(
    directPool.query(
      'INSERT INTO "SettlementReversal" ("id", "settlementId", "amount", "reason", "idempotencyKey") VALUES ($1, $2, $3, $4, $5)',
      [unique("missing-leg-reversal"), sellerResult.settlement.id, 100, "REFUND", unique("missing-leg-key")],
    ),
    /seller or partner settlement leg/i,
  );
});

test("verified refunds reconcile cumulative seller and partner ledger reductions exactly once", async () => {
  const { paymentRequest, evidence, settlement } = await createReconciliableSettlement(
    "settlement-refund-reconciliation",
    { withReferral: true },
  );
  const paymentIntentId = evidence.paymentIntentId;
  assert.ok(paymentIntentId);

  const firstRefund = stripeRefund({
    id: `re_${unique("partial-refund")}`,
    paymentIntentId,
    amount: 2_750,
  });
  await withStripeConnectSettlementMode("on", () => paymentRequests.syncPaymentRequestRefund(firstRefund, {
    stripeEventId: `evt_${unique("partial-refund")}`,
    stripeEventType: "refund.created",
    stripeEventCreatedAt: new Date(),
  }));

  let current = await db.settlement.findUniqueOrThrow({
    where: { id: settlement.id },
    include: { legs: true, reversals: true },
  });
  assert.equal(current.status, "HOLD");
  assert.equal(current.reversals.some((reversal) => reversal.stripeRefundId === firstRefund.id), true);
  assert.equal(
    current.reversals
      .filter((reversal) => reversal.settlementLegId === current.legs.find((leg) => leg.type === "SELLER_PAYABLE")?.id)
      .reduce((total, reversal) => total + reversal.amount, 0),
    2_613,
  );
  assert.equal(
    current.reversals
      .filter((reversal) => reversal.settlementLegId === current.legs.find((leg) => leg.type === "PARTNER_REFERRAL")?.id)
      .reduce((total, reversal) => total + reversal.amount, 0),
    14,
  );
  assert.equal(
    current.reversals.some((reversal) => reversal.settlementLegId === current.legs.find((leg) => leg.type === "PLATFORM_FEE")?.id),
    false,
  );
  assert.equal(
    current.reversals.every((reversal) => reversal.status === "ACCOUNTING_APPLIED" && reversal.stripeTransferReversalId === null),
    true,
  );

  await withStripeConnectSettlementMode("on", () => paymentRequests.syncPaymentRequestRefund(firstRefund, {
    stripeEventId: `evt_${unique("duplicate-partial-refund")}`,
    stripeEventType: "refund.updated",
    stripeEventCreatedAt: new Date(),
  }));
  assert.equal(
    await db.settlementReversal.count({ where: { settlementId: settlement.id } }),
    2,
  );

  const finalRefund = stripeRefund({
    id: `re_${unique("full-refund")}`,
    paymentIntentId,
    amount: paymentRequest.grossAmount - firstRefund.amount,
  });
  await withStripeConnectSettlementMode("on", () => paymentRequests.syncPaymentRequestRefund(finalRefund, {
    stripeEventId: `evt_${unique("full-refund")}`,
    stripeEventType: "refund.created",
    stripeEventCreatedAt: new Date(),
  }));

  current = await db.settlement.findUniqueOrThrow({
    where: { id: settlement.id },
    include: { legs: true, reversals: true },
  });
  assert.equal(current.status, "CANCELLED");
  assert.equal(current.legs.every((leg) => leg.status === "CANCELLED"), true);
  assert.equal(
    current.reversals
      .filter((reversal) => reversal.settlementLegId === current.legs.find((leg) => leg.type === "SELLER_PAYABLE")?.id)
      .reduce((total, reversal) => total + reversal.amount, 0),
    current.sellerPayableAmount,
  );
  assert.equal(
    current.reversals
      .filter((reversal) => reversal.settlementLegId === current.legs.find((leg) => leg.type === "PARTNER_REFERRAL")?.id)
      .reduce((total, reversal) => total + reversal.amount, 0),
    current.partnerReferralAmount,
  );
  assert.equal(
    await db.settlementEvent.count({
      where: { settlementId: settlement.id, eventType: "FULL_REFUND_CANCELLED" },
    }),
    1,
  );
  assert.equal(
    await db.settlementEvent.count({
      where: { settlementId: settlement.id, eventType: "CANCELLED" },
    }),
    1,
  );
  assert.equal(
    current.reversals.every((reversal) => reversal.status === "ACCOUNTING_APPLIED"),
    true,
  );
});

test("concurrent verified refunds serialize settlement allocation without duplicate reversal amounts", async () => {
  const { paymentRequest, evidence, settlement } = await createReconciliableSettlement(
    "settlement-concurrent-refund-reconciliation",
    { withReferral: true },
  );
  const paymentIntentId = evidence.paymentIntentId;
  assert.ok(paymentIntentId);
  const partialRefund = stripeRefund({
    id: `re_${unique("concurrent-partial-refund")}`,
    paymentIntentId,
    amount: 2_750,
  });
  const fullRefund = stripeRefund({
    id: `re_${unique("concurrent-final-refund")}`,
    paymentIntentId,
    amount: paymentRequest.grossAmount - partialRefund.amount,
  });

  await withStripeConnectSettlementMode("on", () => Promise.all([
    paymentRequests.syncPaymentRequestRefund(partialRefund, {
      stripeEventId: `evt_${unique("concurrent-partial-refund")}`,
      stripeEventType: "refund.created",
      stripeEventCreatedAt: new Date(),
    }),
    paymentRequests.syncPaymentRequestRefund(fullRefund, {
      stripeEventId: `evt_${unique("concurrent-final-refund")}`,
      stripeEventType: "refund.created",
      stripeEventCreatedAt: new Date(),
    }),
  ]));

  const after = await db.settlement.findUniqueOrThrow({
    where: { id: settlement.id },
    include: { legs: true, reversals: true },
  });
  assert.equal(after.status, "CANCELLED");
  for (const legType of ["SELLER_PAYABLE", "PARTNER_REFERRAL"] as const) {
    const leg = after.legs.find((candidate) => candidate.type === legType);
    assert.ok(leg);
    const total = after.reversals
      .filter((reversal) => reversal.settlementLegId === leg.id)
      .reduce((sum, reversal) => sum + reversal.amount, 0);
    assert.equal(total, leg.amount);
  }
  assert.equal(
    after.reversals.some((reversal) => {
      const leg = after.legs.find((candidate) => candidate.id === reversal.settlementLegId);
      return leg?.type === "PLATFORM_FEE";
    }),
    false,
  );
});

test("refund event ordering is monotonic and stale evidence cannot reopen a cancelled settlement", async () => {
  const { order, paymentRequest, evidence, settlement } = await createReconciliableSettlement(
    "settlement-refund-event-order",
    { withReferral: true },
  );
  const paymentIntentId = evidence.paymentIntentId;
  assert.ok(paymentIntentId);
  const refundId = `re_${unique("ordered-refund")}`;
  const succeededAt = new Date("2026-07-16T14:00:00.000Z");

  await withStripeConnectSettlementMode("on", () => paymentRequests.syncPaymentRequestRefund(stripeRefund({
    id: refundId,
    paymentIntentId,
    amount: paymentRequest.grossAmount,
  }), {
    stripeEventId: "evt_refund_z_succeeded",
    stripeEventType: "refund.updated",
    stripeEventCreatedAt: succeededAt,
  }));

  const before = await Promise.all([
    db.paymentRefund.findUniqueOrThrow({ where: { stripeRefundId: refundId } }),
    db.paymentRequest.findUniqueOrThrow({ where: { id: paymentRequest.id } }),
    db.tradeOrder.findUniqueOrThrow({ where: { id: order.id } }),
    db.settlement.findUniqueOrThrow({ where: { id: settlement.id } }),
    db.settlementReversal.count({ where: { settlementId: settlement.id } }),
    db.paymentRequestEvent.count({ where: { paymentRequestId: paymentRequest.id } }),
    db.settlementEvent.count({ where: { settlementId: settlement.id } }),
  ]);

  await withStripeConnectSettlementMode("on", () => Promise.all([
    paymentRequests.syncPaymentRequestRefund(stripeRefund({
      id: refundId,
      paymentIntentId,
      amount: 2_750,
      status: "pending",
    }), {
      stripeEventId: "evt_refund_a_pending",
      stripeEventType: "refund.updated",
      stripeEventCreatedAt: new Date("2026-07-16T13:59:00.000Z"),
    }),
    paymentRequests.syncPaymentRequestRefund(stripeRefund({
      id: refundId,
      paymentIntentId,
      amount: 2_750,
    }), {
      stripeEventId: "evt_refund_a_succeeded",
      stripeEventType: "refund.updated",
      stripeEventCreatedAt: succeededAt,
    }),
  ]));

  const after = await Promise.all([
    db.paymentRefund.findUniqueOrThrow({ where: { stripeRefundId: refundId } }),
    db.paymentRequest.findUniqueOrThrow({ where: { id: paymentRequest.id } }),
    db.tradeOrder.findUniqueOrThrow({ where: { id: order.id } }),
    db.settlement.findUniqueOrThrow({ where: { id: settlement.id } }),
    db.settlementReversal.count({ where: { settlementId: settlement.id } }),
    db.paymentRequestEvent.count({ where: { paymentRequestId: paymentRequest.id } }),
    db.settlementEvent.count({ where: { settlementId: settlement.id } }),
  ]);
  assert.equal(after[0].status, "succeeded");
  assert.equal(after[0].amount, paymentRequest.grossAmount);
  assert.equal(after[0].lastStripeEventCreatedAt.toISOString(), succeededAt.toISOString());
  assert.equal(after[0].lastStripeEventId, "evt_refund_z_succeeded");
  assert.equal(after[1].status, "REFUNDED");
  assert.equal(after[1].refundAmount, paymentRequest.grossAmount);
  assert.equal(after[3].status, "CANCELLED");
  assert.equal(after[1].updatedAt.toISOString(), before[1].updatedAt.toISOString());
  assert.equal(after[2].updatedAt.toISOString(), before[2].updatedAt.toISOString());
  assert.equal(after[3].updatedAt.toISOString(), before[3].updatedAt.toISOString());
  assert.equal(after[4], before[4]);
  assert.equal(after[5], before[5]);
  assert.equal(after[6], before[6]);
});

test("concurrent refund.created and refund.updated evidence applies succeeded once and keeps accounting idempotent", async () => {
  const { paymentRequest, evidence, settlement } = await createReconciliableSettlement(
    "settlement-refund-equal-time-order",
  );
  const paymentIntentId = evidence.paymentIntentId;
  assert.ok(paymentIntentId);
  const refundId = `re_${unique("equal-time-refund")}`;
  const occurredAt = new Date("2026-07-16T14:30:00.000Z");

  await withStripeConnectSettlementMode("on", () => Promise.all([
    paymentRequests.syncPaymentRequestRefund(stripeRefund({
      id: refundId,
      paymentIntentId,
      amount: paymentRequest.grossAmount,
      status: "pending",
    }), {
      stripeEventId: "evt_refund_a_pending",
      stripeEventType: "refund.created",
      stripeEventCreatedAt: occurredAt,
    }),
    paymentRequests.syncPaymentRequestRefund(stripeRefund({
      id: refundId,
      paymentIntentId,
      amount: paymentRequest.grossAmount,
    }), {
      stripeEventId: "evt_refund_b_succeeded",
      stripeEventType: "refund.updated",
      stripeEventCreatedAt: occurredAt,
    }),
  ]));

  const reversalsAfterSucceeded = await db.settlementReversal.count({ where: { settlementId: settlement.id } });
  await withStripeConnectSettlementMode("on", () => paymentRequests.syncPaymentRequestRefund(stripeRefund({
    id: refundId,
    paymentIntentId,
    amount: paymentRequest.grossAmount,
  }), {
    stripeEventId: "evt_refund_c_succeeded",
    stripeEventType: "refund.updated",
    stripeEventCreatedAt: new Date("2026-07-16T14:31:00.000Z"),
  }));

  assert.equal((await db.paymentRefund.findUniqueOrThrow({ where: { stripeRefundId: refundId } })).status, "succeeded");
  assert.equal((await db.paymentRequest.findUniqueOrThrow({ where: { id: paymentRequest.id } })).refundAmount, paymentRequest.grossAmount);
  assert.equal((await db.settlement.findUniqueOrThrow({ where: { id: settlement.id } })).status, "CANCELLED");
  assert.equal(await db.settlementReversal.count({ where: { settlementId: settlement.id } }), reversalsAfterSucceeded);
});

test("a terminal reversed settlement remains reversed during later refund reconciliation", async () => {
  const { paymentRequest, evidence, settlement } = await createReconciliableSettlement(
    "settlement-terminal-reversed",
  );
  const paymentIntentId = evidence.paymentIntentId;
  assert.ok(paymentIntentId);
  await db.settlement.update({ where: { id: settlement.id }, data: { status: "REVERSED" } });

  await withStripeConnectSettlementMode("on", () => paymentRequests.syncPaymentRequestRefund(stripeRefund({
    id: `re_${unique("terminal-reversed")}`,
    paymentIntentId,
    amount: paymentRequest.grossAmount,
  }), stripeWebhookEvent("refund.created", new Date("2026-07-16T14:45:00.000Z"))));

  assert.equal((await db.settlement.findUniqueOrThrow({ where: { id: settlement.id } })).status, "REVERSED");
});

test("open, won, and lost disputes block or restore settlement eligibility without moving money", async () => {
  const { paymentRequest, evidence, settlement } = await createReconciliableSettlement(
    "settlement-dispute-reconciliation",
    { withReferral: true },
  );
  const paymentIntentId = evidence.paymentIntentId;
  assert.ok(paymentIntentId);
  await db.settlement.update({ where: { id: settlement.id }, data: { status: "READY", holdUntil: new Date(0) } });
  await db.settlementLeg.updateMany({
    where: { settlementId: settlement.id },
    data: { status: "READY" },
  });

  const disputeId = `dp_${unique("open-dispute")}`;
  await withStripeConnectSettlementMode("on", () => paymentRequests.syncPaymentRequestDispute(stripeDispute({
    id: disputeId,
    paymentIntentId,
    amount: paymentRequest.grossAmount,
    status: "needs_response",
  }), {
    stripeEventId: `evt_${unique("open-dispute")}`,
    stripeEventType: "charge.dispute.created",
    stripeEventCreatedAt: new Date("2026-07-16T12:00:00.000Z"),
  }));
  assert.equal((await db.settlement.findUniqueOrThrow({ where: { id: settlement.id } })).status, "HOLD");
  assert.equal(
    await db.settlementLeg.count({ where: { settlementId: settlement.id, status: "HOLD" } }),
    3,
  );

  await withStripeConnectSettlementMode("on", () => paymentRequests.syncPaymentRequestDispute(stripeDispute({
    id: disputeId,
    paymentIntentId,
    amount: paymentRequest.grossAmount,
    status: "won",
  }), {
    stripeEventId: `evt_${unique("won-dispute")}`,
    stripeEventType: "charge.dispute.closed",
    stripeEventCreatedAt: new Date("2026-07-16T12:01:00.000Z"),
  }));
  assert.equal((await db.settlement.findUniqueOrThrow({ where: { id: settlement.id } })).status, "HOLD");

  const lostFixture = await createReconciliableSettlement("settlement-dispute-loss", { withReferral: true });
  const lostPaymentIntentId = lostFixture.evidence.paymentIntentId;
  assert.ok(lostPaymentIntentId);
  const lostDisputeId = `dp_${unique("lost-dispute")}`;
  await withStripeConnectSettlementMode("on", () => paymentRequests.syncPaymentRequestDispute(stripeDispute({
    id: lostDisputeId,
    paymentIntentId: lostPaymentIntentId,
    amount: 2_750,
    status: "lost",
  }), {
    stripeEventId: `evt_${unique("lost-dispute")}`,
    stripeEventType: "charge.dispute.closed",
    stripeEventCreatedAt: new Date("2026-07-16T12:00:00.000Z"),
  }));
  const lostSettlement = await db.settlement.findUniqueOrThrow({
    where: { id: lostFixture.settlement.id },
    include: { reversals: true },
  });
  assert.equal(lostSettlement.status, "HOLD");
  assert.equal(lostSettlement.reversals.every((reversal) => reversal.stripeDisputeId === lostDisputeId), true);
  assert.equal(lostSettlement.reversals.every((reversal) => reversal.status === "ACCOUNTING_APPLIED"), true);
  assert.equal(
    await db.settlementEvent.count({
      where: { settlementId: lostSettlement.id, eventType: "DISPUTE_LOST" },
    }),
    1,
  );
  const lostEvent = await db.settlementEvent.findFirstOrThrow({
    where: { settlementId: lostSettlement.id, eventType: "DISPUTE_LOST" },
  });
  assert.deepEqual(
    {
      stripeDisputeId: (lostEvent.metadata as Record<string, unknown>).stripeDisputeId,
      disputeStatus: (lostEvent.metadata as Record<string, unknown>).disputeStatus,
      stripeEventType: (lostEvent.metadata as Record<string, unknown>).stripeEventType,
      amount: (lostEvent.metadata as Record<string, unknown>).amount,
      currency: (lostEvent.metadata as Record<string, unknown>).currency,
    },
    {
      stripeDisputeId: lostDisputeId,
      disputeStatus: "lost",
      stripeEventType: "charge.dispute.closed",
      amount: 2_750,
      currency: "usd",
    },
  );
});

test("post-transfer losses remain pending for internal reversal reconciliation and never call Stripe", async () => {
  const { paymentRequest, evidence, settlement } = await createReconciliableSettlement(
    "settlement-post-transfer-reversal",
    { withReferral: true },
  );
  const paymentIntentId = evidence.paymentIntentId;
  assert.ok(paymentIntentId);
  const sellerLeg = await db.settlementLeg.findFirstOrThrow({
    where: { settlementId: settlement.id, type: "SELLER_PAYABLE" },
  });
  await db.settlementLeg.update({ where: { id: sellerLeg.id }, data: { status: "TRANSFERRED" } });
  await db.settlement.update({ where: { id: settlement.id }, data: { status: "TRANSFERRED" } });

  const refundId = `re_${unique("post-transfer")}`;
  await withStripeConnectSettlementMode("on", () => paymentRequests.syncPaymentRequestRefund(stripeRefund({
    id: refundId,
    paymentIntentId,
    amount: paymentRequest.grossAmount,
  }), {
    stripeEventId: `evt_${unique("post-transfer")}`,
    stripeEventType: "refund.created",
    stripeEventCreatedAt: new Date(),
  }));

  const after = await db.settlement.findUniqueOrThrow({
    where: { id: settlement.id },
    include: { legs: true, reversals: true },
  });
  assert.equal(after.status, "REVERSAL_PENDING");
  assert.equal(after.legs.find((leg) => leg.id === sellerLeg.id)?.status, "REVERSAL_PENDING");
  const sellerReversal = after.reversals.find((reversal) => reversal.settlementLegId === sellerLeg.id);
  assert.equal(sellerReversal?.status, "PENDING");
  assert.equal(sellerReversal?.stripeTransferReversalId, null);
  assert.equal(
    await db.settlementEvent.count({
      where: { settlementId: settlement.id, eventType: "POST_TRANSFER_REVERSAL_REQUIRED" },
    }),
    1,
  );

  const reversalCount = after.reversals.length;
  await withStripeConnectSettlementMode("on", () => paymentRequests.syncPaymentRequestRefund(stripeRefund({
    id: refundId,
    paymentIntentId,
    amount: paymentRequest.grossAmount,
  }), {
    stripeEventId: `evt_${unique("post-transfer-refund-duplicate")}`,
    stripeEventType: "refund.updated",
    stripeEventCreatedAt: new Date("2026-07-16T15:00:00.000Z"),
  }));
  const duplicateRefund = await db.settlement.findUniqueOrThrow({
    where: { id: settlement.id },
    include: { legs: true, reversals: true },
  });
  assert.equal(duplicateRefund.status, "REVERSAL_PENDING");
  assert.equal(duplicateRefund.reversals.length, reversalCount);
  assert.equal(duplicateRefund.legs.find((leg) => leg.id === sellerLeg.id)?.status, "REVERSAL_PENDING");
  assert.equal(
    await db.settlementEvent.count({
      where: { settlementId: settlement.id, eventType: "POST_TRANSFER_REVERSAL_REQUIRED" },
    }),
    1,
  );
});

test("duplicate post-transfer dispute losses retain pending reversal work without duplicate ledger events", async () => {
  const { paymentRequest, evidence, settlement } = await createReconciliableSettlement(
    "settlement-post-transfer-dispute-duplicate",
    { withReferral: true },
  );
  const paymentIntentId = evidence.paymentIntentId;
  assert.ok(paymentIntentId);
  const sellerLeg = await db.settlementLeg.findFirstOrThrow({
    where: { settlementId: settlement.id, type: "SELLER_PAYABLE" },
  });
  await db.settlementLeg.update({ where: { id: sellerLeg.id }, data: { status: "TRANSFERRED" } });
  await db.settlement.update({ where: { id: settlement.id }, data: { status: "TRANSFERRED" } });
  const disputeId = `dp_${unique("post-transfer-dispute")}`;

  await withStripeConnectSettlementMode("on", () => paymentRequests.syncPaymentRequestDispute(stripeDispute({
    id: disputeId,
    paymentIntentId,
    amount: paymentRequest.grossAmount,
    status: "lost",
  }), stripeWebhookEvent("charge.dispute.closed", new Date("2026-07-16T15:10:00.000Z"))));
  const first = await db.settlement.findUniqueOrThrow({
    where: { id: settlement.id },
    include: { reversals: true },
  });
  const firstPostTransferEvents = await db.settlementEvent.count({
    where: { settlementId: settlement.id, eventType: "POST_TRANSFER_REVERSAL_REQUIRED" },
  });

  await withStripeConnectSettlementMode("on", () => paymentRequests.syncPaymentRequestDispute(stripeDispute({
    id: disputeId,
    paymentIntentId,
    amount: paymentRequest.grossAmount,
    status: "lost",
  }), stripeWebhookEvent("charge.dispute.updated", new Date("2026-07-16T15:11:00.000Z"))));
  const duplicate = await db.settlement.findUniqueOrThrow({
    where: { id: settlement.id },
    include: { reversals: true },
  });
  assert.equal(duplicate.status, "REVERSAL_PENDING");
  assert.equal(duplicate.reversals.length, first.reversals.length);
  assert.equal(
    await db.settlementEvent.count({
      where: { settlementId: settlement.id, eventType: "POST_TRANSFER_REVERSAL_REQUIRED" },
    }),
    firstPostTransferEvents,
  );
  assert.equal(duplicate.reversals.every((reversal) => reversal.stripeTransferReversalId === null), true);
});

test("transferred seller and partner legs alone or together create only pending reversal work", async () => {
  const cases = [
    ["SELLER_PAYABLE"],
    ["PARTNER_REFERRAL"],
    ["SELLER_PAYABLE", "PARTNER_REFERRAL"],
  ] as const;

  for (const transferredTypes of cases) {
    const transferredTypeSet = new Set<string>(transferredTypes);
    const { paymentRequest, evidence, settlement } = await createReconciliableSettlement(
      `settlement-transferred-${transferredTypes.join("-")}`,
      { withReferral: true },
    );
    const paymentIntentId = evidence.paymentIntentId;
    assert.ok(paymentIntentId);
    await db.settlementLeg.updateMany({
      where: { settlementId: settlement.id, type: { in: [...transferredTypes] } },
      data: { status: "TRANSFERRED" },
    });
    await db.settlement.update({ where: { id: settlement.id }, data: { status: "TRANSFERRED" } });

    await withStripeConnectSettlementMode("on", () => paymentRequests.syncPaymentRequestRefund(stripeRefund({
      id: `re_${unique("transferred-leg")}`,
      paymentIntentId,
      amount: paymentRequest.grossAmount,
    }), stripeWebhookEvent("refund.created")));

    const after = await db.settlement.findUniqueOrThrow({
      where: { id: settlement.id },
      include: { legs: true, reversals: true },
    });
    assert.equal(after.status, "REVERSAL_PENDING");
    for (const leg of after.legs.filter((candidate) => candidate.type !== "PLATFORM_FEE")) {
      const reversal = after.reversals.find((candidate) => candidate.settlementLegId === leg.id);
      assert.ok(reversal);
      assert.equal(reversal.stripeTransferReversalId, null);
      if (transferredTypeSet.has(leg.type)) {
        assert.equal(leg.status, "REVERSAL_PENDING");
        assert.equal(reversal.status, "PENDING");
      } else {
        assert.equal(reversal.status, "ACCOUNTING_APPLIED");
      }
    }
    assert.equal(
      after.reversals.some((reversal) => after.legs.find((leg) => leg.id === reversal.settlementLegId)?.type === "PLATFORM_FEE"),
      false,
    );
  }
});

test("dispute reconciliation rejects stale Stripe events and retains favorable outcomes on hold", async () => {
  const lostFixture = await createReconciliableSettlement("settlement-dispute-event-order-lost", { withReferral: true });
  const lostIntentId = lostFixture.evidence.paymentIntentId;
  assert.ok(lostIntentId);
  const lostDisputeId = `dp_${unique("ordered-lost")}`;
  const lostAt = new Date("2026-07-16T12:03:00.000Z");

  await withStripeConnectSettlementMode("on", () => paymentRequests.syncPaymentRequestDispute(stripeDispute({
    id: lostDisputeId,
    paymentIntentId: lostIntentId,
    amount: 2_750,
    status: "lost",
  }), stripeWebhookEvent("charge.dispute.closed", lostAt)));
  const reversalCountAfterLoss = await db.settlementReversal.count({ where: { settlementId: lostFixture.settlement.id } });

  await withStripeConnectSettlementMode("on", () => Promise.all([
    paymentRequests.syncPaymentRequestDispute(stripeDispute({
      id: lostDisputeId,
      paymentIntentId: lostIntentId,
      amount: 2_750,
      status: "won",
    }), stripeWebhookEvent("charge.dispute.closed", new Date("2026-07-16T12:02:00.000Z"))),
    paymentRequests.syncPaymentRequestDispute(stripeDispute({
      id: lostDisputeId,
      paymentIntentId: lostIntentId,
      amount: 2_750,
      status: "needs_response",
    }), stripeWebhookEvent("charge.dispute.updated", new Date("2026-07-16T12:01:00.000Z"))),
  ]));
  const persistedLoss = await db.paymentDispute.findUniqueOrThrow({ where: { stripeDisputeId: lostDisputeId } });
  assert.equal(persistedLoss.status, "lost");
  assert.equal(await db.settlementReversal.count({ where: { settlementId: lostFixture.settlement.id } }), reversalCountAfterLoss);
  await withStripeConnectSettlementMode("on", () => paymentRequests.syncPaymentRequestDispute(stripeDispute({
    id: lostDisputeId,
    paymentIntentId: lostIntentId,
    amount: 2_750,
    status: "won",
  }), stripeWebhookEvent("charge.dispute.closed", lostAt)));
  assert.equal((await db.paymentDispute.findUniqueOrThrow({ where: { stripeDisputeId: lostDisputeId } })).status, "lost");

  const wonFixture = await createReconciliableSettlement("settlement-dispute-event-order-won", { withReferral: true });
  const wonIntentId = wonFixture.evidence.paymentIntentId;
  assert.ok(wonIntentId);
  const wonDisputeId = `dp_${unique("ordered-won")}`;
  const wonAt = new Date("2026-07-16T12:05:00.000Z");
  await withStripeConnectSettlementMode("on", () => paymentRequests.syncPaymentRequestDispute(stripeDispute({
    id: wonDisputeId,
    paymentIntentId: wonIntentId,
    amount: wonFixture.paymentRequest.grossAmount,
    status: "won",
  }), stripeWebhookEvent("charge.dispute.closed", wonAt)));
  await withStripeConnectSettlementMode("on", () => paymentRequests.syncPaymentRequestDispute(stripeDispute({
    id: wonDisputeId,
    paymentIntentId: wonIntentId,
    amount: wonFixture.paymentRequest.grossAmount,
    status: "needs_response",
  }), stripeWebhookEvent("charge.dispute.updated", new Date("2026-07-16T12:04:00.000Z"))));
  const persistedWin = await db.paymentDispute.findUniqueOrThrow({ where: { stripeDisputeId: wonDisputeId } });
  assert.equal(persistedWin.status, "won");
  assert.equal((await db.settlement.findUniqueOrThrow({ where: { id: wonFixture.settlement.id } })).status, "HOLD");

  await withStripeConnectSettlementMode("on", () => paymentRequests.syncPaymentRequestDispute(stripeDispute({
    id: wonDisputeId,
    paymentIntentId: wonIntentId,
    amount: wonFixture.paymentRequest.grossAmount,
    status: "lost",
  }), stripeWebhookEvent("charge.dispute.closed", wonAt)));
  assert.equal((await db.paymentDispute.findUniqueOrThrow({ where: { stripeDisputeId: wonDisputeId } })).status, "lost");
});

test("dispute status transitions are auditable, idempotent, and cannot restore while another dispute is open", async () => {
  const { paymentRequest, evidence, settlement } = await createReconciliableSettlement(
    "settlement-dispute-audit-transitions",
    { withReferral: true },
  );
  const paymentIntentId = evidence.paymentIntentId;
  assert.ok(paymentIntentId);
  const disputeId = `dp_${unique("audited-dispute")}`;
  const openedEvent = stripeWebhookEvent("charge.dispute.created", new Date("2026-07-16T13:00:00.000Z"));
  const updatedEvent = stripeWebhookEvent("charge.dispute.updated", new Date("2026-07-16T13:01:00.000Z"));

  await withStripeConnectSettlementMode("on", () => paymentRequests.syncPaymentRequestDispute(stripeDispute({
    id: disputeId,
    paymentIntentId,
    amount: paymentRequest.grossAmount,
    status: "needs_response",
  }), openedEvent));
  await withStripeConnectSettlementMode("on", () => paymentRequests.syncPaymentRequestDispute(stripeDispute({
    id: disputeId,
    paymentIntentId,
    amount: paymentRequest.grossAmount,
    status: "under_review",
  }), updatedEvent));
  await withStripeConnectSettlementMode("on", () => paymentRequests.syncPaymentRequestDispute(stripeDispute({
    id: disputeId,
    paymentIntentId,
    amount: paymentRequest.grossAmount,
    status: "under_review",
  }), updatedEvent));

  await db.paymentDispute.create({
    data: {
      paymentRequestId: paymentRequest.id,
      stripeDisputeId: `dp_${unique("still-open")}`,
      amount: paymentRequest.grossAmount,
      status: "needs_response",
      lastStripeEventCreatedAt: new Date("2026-07-16T13:01:30.000Z"),
      lastStripeEventId: `evt_${unique("still-open")}`,
    },
  });
  await withStripeConnectSettlementMode("on", () => paymentRequests.syncPaymentRequestDispute(stripeDispute({
    id: disputeId,
    paymentIntentId,
    amount: paymentRequest.grossAmount,
    status: "won",
  }), stripeWebhookEvent("charge.dispute.closed", new Date("2026-07-16T13:02:00.000Z"))));

  const events = await db.settlementEvent.findMany({
    where: { settlementId: settlement.id, eventType: { in: ["DISPUTE_OPENED", "DISPUTE_UPDATED", "DISPUTE_WON"] } },
    orderBy: { createdAt: "asc" },
  });
  assert.equal(events.filter((event) => event.eventType === "DISPUTE_OPENED").length, 1);
  assert.equal(events.filter((event) => event.eventType === "DISPUTE_UPDATED").length, 1);
  assert.equal(events.filter((event) => event.eventType === "DISPUTE_WON").length, 1);
  assert.equal((await db.paymentDispute.findUniqueOrThrow({ where: { stripeDisputeId: disputeId } })).status, "won");
  assert.equal((await db.paymentRequest.findUniqueOrThrow({ where: { id: paymentRequest.id } })).status, "DISPUTED");
  assert.equal((await db.settlement.findUniqueOrThrow({ where: { id: settlement.id } })).status, "HOLD");
  for (const event of events) {
    const metadata = event.metadata as Record<string, unknown>;
    assert.equal(metadata.stripeDisputeId, disputeId);
    assert.equal(typeof metadata.stripeEventId, "string");
    assert.equal(typeof metadata.stripeEventType, "string");
    assert.equal(typeof metadata.stripeEventCreatedAt, "string");
    assert.equal(metadata.amount, paymentRequest.grossAmount);
    assert.equal(metadata.currency, "usd");
  }
});

test("concurrent refund and dispute losses cap every transferable-leg reversal at its original amount", async () => {
  const { evidence, settlement } = await createReconciliableSettlement(
    "settlement-refund-dispute-concurrency",
    { withReferral: true },
  );
  const paymentIntentId = evidence.paymentIntentId;
  assert.ok(paymentIntentId);
  await withStripeConnectSettlementMode("on", () => Promise.all([
    paymentRequests.syncPaymentRequestRefund(stripeRefund({
      id: `re_${unique("combined-refund")}`,
      paymentIntentId,
      amount: 2_750,
    }), stripeWebhookEvent("refund.created")),
    paymentRequests.syncPaymentRequestDispute(stripeDispute({
      id: `dp_${unique("combined-dispute")}`,
      paymentIntentId,
      amount: 8_250,
      status: "lost",
    }), stripeWebhookEvent("charge.dispute.closed")),
  ]));
  const after = await db.settlement.findUniqueOrThrow({
    where: { id: settlement.id },
    include: { legs: true, reversals: true },
  });
  for (const leg of after.legs.filter((candidate) => candidate.type !== "PLATFORM_FEE")) {
    const total = after.reversals
      .filter((reversal) => reversal.settlementLegId === leg.id)
      .reduce((sum, reversal) => sum + reversal.amount, 0);
    assert.ok(total <= leg.amount);
  }
  assert.equal(
    after.reversals.some((reversal) => after.legs.find((leg) => leg.id === reversal.settlementLegId)?.type === "PLATFORM_FEE"),
    false,
  );
});

test("feature-off refund synchronization leaves existing settlement ledger records untouched", async () => {
  const { paymentRequest, evidence, settlement } = await createReconciliableSettlement("settlement-feature-off");
  const paymentIntentId = evidence.paymentIntentId;
  assert.ok(paymentIntentId);
  const before = await db.settlement.findUniqueOrThrow({
    where: { id: settlement.id },
    include: { legs: true, reversals: true, events: true },
  });
  await withStripeConnectSettlementMode("off", () => paymentRequests.syncPaymentRequestRefund(stripeRefund({
    id: `re_${unique("feature-off")}`,
    paymentIntentId,
    amount: paymentRequest.grossAmount,
  }), {
    stripeEventId: `evt_${unique("feature-off")}`,
    stripeEventType: "refund.created",
    stripeEventCreatedAt: new Date(),
  }));
  const after = await db.settlement.findUniqueOrThrow({
    where: { id: settlement.id },
    include: { legs: true, reversals: true, events: true },
  });
  assert.equal(after.status, before.status);
  assert.deepEqual(after.legs.map((leg) => leg.status), before.legs.map((leg) => leg.status));
  assert.equal(after.reversals.length, before.reversals.length);
  assert.equal(after.events.length, before.events.length);
});

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
      lastStripeEventCreatedAt: new Date(),
      lastStripeEventId: `evt_${unique("processing-active")}`,
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
      data: {
        paymentRequestId: dispute.order.paymentRequestId,
        stripeDisputeId: `dp_${unique("dispute")}`,
        amount: 11_000,
        status: "needs_response",
        lastStripeEventCreatedAt: new Date(),
        lastStripeEventId: `evt_${unique("dispute")}`,
      },
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
  const firstAccount = "1000000000001234";
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
        accountNumber: "2000000000009876",
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

test("settlement hold release evaluates transferable legs independently and records one release event", async () => {
  const beforeHold = await createReconciliableSettlement("settlement-release-before-hold");
  await enableCompanyTransfers(beforeHold.fixture.sellerCompany.id);
  const beforeResult = await settlementRelease.evaluateSettlementReleaseEligibility({
    settlementId: beforeHold.settlement.id,
    now: new Date(),
  });
  assert.deepEqual(beforeResult.readyLegIds, []);

  const { fixture, settlement } = await createReconciliableSettlement(
    "settlement-release-independent",
    { withReferral: true },
  );
  const current = await db.settlement.findUniqueOrThrow({
    where: { id: settlement.id },
    select: { referralPartnerProfileId: true },
  });
  assert.ok(current.referralPartnerProfileId);
  await enableCompanyTransfers(fixture.sellerCompany.id);
  await expireSettlementHold(settlement.id);

  const [first, second] = await Promise.all([
    settlementRelease.releaseEligibleSettlementLegs(),
    settlementRelease.releaseEligibleSettlementLegs(),
  ]);
  assert.ok(first.length + second.length >= 1);

  const after = await db.settlement.findUniqueOrThrow({
    where: { id: settlement.id },
    include: { legs: true, events: true },
  });
  const sellerLeg = after.legs.find((leg) => leg.type === "SELLER_PAYABLE");
  const partnerLeg = after.legs.find((leg) => leg.type === "PARTNER_REFERRAL");
  const platformLeg = after.legs.find((leg) => leg.type === "PLATFORM_FEE");
  assert.equal(sellerLeg?.status, "READY");
  assert.equal(partnerLeg?.status, "HOLD");
  assert.equal(platformLeg?.status, "HOLD");
  assert.equal(after.status, "READY");
  assert.equal(
    after.events.filter((event) => event.eventType === "HOLD_RELEASED" && event.settlementLegId === sellerLeg?.id).length,
    1,
  );
});

test("settlement hold release excludes reconciliation, disputes, pending reversals, and full refunds while retaining partial net amounts", async () => {
  const partial = await createReconciliableSettlement("settlement-release-partial");
  await enableCompanyTransfers(partial.fixture.sellerCompany.id);
  await expireSettlementHold(partial.settlement.id);
  const partialSellerLeg = await db.settlementLeg.findFirstOrThrow({
    where: { settlementId: partial.settlement.id, type: "SELLER_PAYABLE" },
  });
  await db.settlementReversal.create({
    data: {
      settlementId: partial.settlement.id,
      settlementLegId: partialSellerLeg.id,
      amount: 500,
      reason: "REFUND",
      idempotencyKey: unique("partial-release-reversal"),
      stripeRefundId: `re_${unique("partial-release")}`,
    },
  });
  await settlementRelease.releaseEligibleSettlementLegs();
  const partialEvent = await db.settlementEvent.findFirstOrThrow({
    where: { settlementId: partial.settlement.id, settlementLegId: partialSellerLeg.id, eventType: "HOLD_RELEASED" },
  });
  assert.equal((partialEvent.metadata as { netAmount?: number }).netAmount, partialSellerLeg.amount - 500);

  const pendingReversal = await createReconciliableSettlement("settlement-release-pending-reversal");
  await enableCompanyTransfers(pendingReversal.fixture.sellerCompany.id);
  await expireSettlementHold(pendingReversal.settlement.id);
  const pendingReversalLeg = await db.settlementLeg.findFirstOrThrow({
    where: { settlementId: pendingReversal.settlement.id, type: "SELLER_PAYABLE" },
  });
  await db.settlementReversal.create({
    data: {
      settlementId: pendingReversal.settlement.id,
      settlementLegId: pendingReversalLeg.id,
      amount: 100,
      reason: "REFUND",
      status: "PENDING",
      idempotencyKey: unique("pending-release-reversal"),
      stripeRefundId: `re_${unique("pending-release")}`,
    },
  });
  await settlementRelease.releaseEligibleSettlementLegs();
  assert.equal(
    (await db.settlementLeg.findUniqueOrThrow({ where: { id: pendingReversalLeg.id } })).status,
    "HOLD",
  );

  const disputed = await createReconciliableSettlement("settlement-release-dispute");
  await enableCompanyTransfers(disputed.fixture.sellerCompany.id);
  await expireSettlementHold(disputed.settlement.id);
  await db.paymentDispute.create({
    data: {
      paymentRequestId: disputed.paymentRequest.id,
      stripeDisputeId: `dp_${unique("release-open")}`,
      amount: disputed.paymentRequest.grossAmount,
      status: "needs_response",
      lastStripeEventCreatedAt: new Date(),
      lastStripeEventId: `evt_${unique("release-open")}`,
    },
  });
  await settlementRelease.releaseEligibleSettlementLegs();
  assert.equal(
    (await db.settlementLeg.findFirstOrThrow({ where: { settlementId: disputed.settlement.id, type: "SELLER_PAYABLE" } })).status,
    "HOLD",
  );

  const reconciliation = await createReconciliableSettlement("settlement-release-reconciliation");
  await enableCompanyTransfers(reconciliation.fixture.sellerCompany.id);
  await expireSettlementHold(reconciliation.settlement.id);
  await db.paymentRequest.update({
    where: { id: reconciliation.paymentRequest.id },
    data: { requiresManualReconciliation: true },
  });
  await settlementRelease.releaseEligibleSettlementLegs();
  assert.equal(
    (await db.settlementLeg.findFirstOrThrow({ where: { settlementId: reconciliation.settlement.id, type: "SELLER_PAYABLE" } })).status,
    "HOLD",
  );

  const cancelled = await createReconciliableSettlement("settlement-release-full-refund");
  await db.$transaction([
    db.paymentRequest.update({
      where: { id: cancelled.paymentRequest.id },
      data: { status: "REFUNDED", refundAmount: cancelled.paymentRequest.grossAmount },
    }),
    db.settlement.update({ where: { id: cancelled.settlement.id }, data: { status: "CANCELLED" } }),
    db.settlementLeg.updateMany({ where: { settlementId: cancelled.settlement.id }, data: { status: "CANCELLED" } }),
  ]);
  await settlementRelease.releaseEligibleSettlementLegs();
  assert.equal((await db.settlement.findUniqueOrThrow({ where: { id: cancelled.settlement.id } })).status, "CANCELLED");
});

test("admin release actions preserve amounts and record approval, hold, and reevaluation events", async () => {
  const release = await createReconciliableSettlement("settlement-release-admin");
  await enableCompanyTransfers(release.fixture.sellerCompany.id);
  await expireSettlementHold(release.settlement.id);

  await settlementRelease.holdSettlementRelease({
    settlementId: release.settlement.id,
    actorUserId: release.fixture.admin.id,
    reason: "Awaiting internal compliance review.",
  });
  const held = await db.settlement.findUniqueOrThrow({ where: { id: release.settlement.id } });
  assert.equal(held.holdReason, "Awaiting internal compliance review.");
  assert.equal(held.status, "HOLD");

  await settlementRelease.approveSettlementRelease({
    settlementId: release.settlement.id,
    actorUserId: release.fixture.admin.id,
  });
  const approved = await db.settlement.findUniqueOrThrow({ where: { id: release.settlement.id } });
  assert.equal(approved.approvedByUserId, release.fixture.admin.id);
  assert.ok(approved.approvedAt);
  assert.equal(approved.holdReason, null);

  await settlementRelease.reevaluateSettlementRelease({
    settlementId: release.settlement.id,
    actorUserId: release.fixture.admin.id,
  });
  const after = await db.settlement.findUniqueOrThrow({
    where: { id: release.settlement.id },
    include: { events: true, legs: true },
  });
  assert.equal(after.legs.find((leg) => leg.type === "SELLER_PAYABLE")?.amount, 10_450);
  assert.ok(after.events.some((event) => event.eventType === "ADMIN_HELD"));
  assert.ok(after.events.some((event) => event.eventType === "ADMIN_APPROVED"));
  assert.ok(after.events.some((event) => event.eventType === "ADMIN_REEVALUATED"));
});

test("a committed settlement hold prevents a later transfer claim", async () => {
  const release = await createReconciliableSettlement("settlement-release-hold-before-claim");
  await enableCompanyTransfers(release.fixture.sellerCompany.id);
  await expireSettlementHold(release.settlement.id);
  await settlementRelease.approveSettlementRelease({
    settlementId: release.settlement.id,
    actorUserId: release.fixture.admin.id,
  });
  await settlementRelease.holdSettlementRelease({
    settlementId: release.settlement.id,
    actorUserId: release.fixture.admin.id,
    reason: "Manual hold before transfer claim.",
  });

  let stripeCallCount = 0;
  const result = await transferExecution.executeSettlementLegTransfer({
    settlementLegId: (await db.settlementLeg.findFirstOrThrow({
      where: { settlementId: release.settlement.id, type: "SELLER_PAYABLE" },
      select: { id: true },
    })).id,
    actorUserId: release.fixture.admin.id,
    mode: "manual",
    stripe: {
      transfers: {
        create: async () => {
          stripeCallCount += 1;
          return { id: "tr_should_not_create" };
        },
      },
    } as never,
    assertRuntime: () => undefined,
  });
  assert.equal(result.status, "ineligible");
  assert.equal(stripeCallCount, 0);
  const after = await db.settlement.findUniqueOrThrow({
    where: { id: release.settlement.id },
    include: { legs: true },
  });
  assert.equal(after.status, "HOLD");
  assert.equal(after.legs.find((leg) => leg.type === "SELLER_PAYABLE")?.status, "HOLD");
});

test("a transfer claim blocks a later hold and keeps transfer pending until finalization", async () => {
  const release = await createReconciliableSettlement("settlement-release-claim-before-hold");
  await enableCompanyTransfers(release.fixture.sellerCompany.id);
  await expireSettlementHold(release.settlement.id);
  await settlementRelease.approveSettlementRelease({
    settlementId: release.settlement.id,
    actorUserId: release.fixture.admin.id,
  });
  const leg = await db.settlementLeg.findFirstOrThrow({
    where: { settlementId: release.settlement.id, type: "SELLER_PAYABLE" },
    select: { id: true },
  });

  let holdError: unknown;
  const result = await transferExecution.executeSettlementLegTransfer({
    settlementLegId: leg.id,
    actorUserId: release.fixture.admin.id,
    mode: "manual",
    stripe: {
      transfers: {
        create: async () => {
          try {
            await settlementRelease.holdSettlementRelease({
              settlementId: release.settlement.id,
              actorUserId: release.fixture.admin.id,
              reason: "Hold during transfer claim.",
            });
          } catch (error) {
            holdError = error;
          }
          return { id: "tr_claimed_before_hold" };
        },
      },
    } as never,
    assertRuntime: () => undefined,
  });

  assert.match(String(holdError), /transfer is pending/i);
  assert.equal(result.status, "transferred");
  const after = await db.settlement.findUniqueOrThrow({
    where: { id: release.settlement.id },
    include: { legs: true },
  });
  assert.equal(after.legs.find((item) => item.id === leg.id)?.status, "TRANSFERRED");
});

test("admin approval, hold, and reevaluation reject transferable pending settlements", async () => {
  const release = await createReconciliableSettlement("settlement-release-pending-admin-actions");
  const sellerLeg = await db.settlementLeg.findFirstOrThrow({
    where: { settlementId: release.settlement.id, type: "SELLER_PAYABLE" },
    select: { id: true },
  });
  const pendingAt = new Date();
  await db.$transaction([
    db.settlement.update({ where: { id: release.settlement.id }, data: { status: "TRANSFER_PENDING" } }),
    db.settlementLeg.update({
      where: { id: sellerLeg.id },
      data: { status: "TRANSFER_PENDING", transferLockedAt: pendingAt },
    }),
  ]);

  await assert.rejects(() => settlementRelease.approveSettlementRelease({
    settlementId: release.settlement.id,
    actorUserId: release.fixture.admin.id,
  }), /cannot be approved/i);
  await assert.rejects(() => settlementRelease.holdSettlementRelease({
    settlementId: release.settlement.id,
    actorUserId: release.fixture.admin.id,
    reason: "Pending transfer must remain untouched.",
  }), /transfer is pending/i);
  await assert.rejects(() => settlementRelease.reevaluateSettlementRelease({
    settlementId: release.settlement.id,
    actorUserId: release.fixture.admin.id,
  }), /transfer is pending/i);

  const after = await db.settlement.findUniqueOrThrow({
    where: { id: release.settlement.id },
    include: { legs: true },
  });
  assert.equal(after.status, "TRANSFER_PENDING");
  assert.equal(after.legs.find((leg) => leg.id === sellerLeg.id)?.status, "TRANSFER_PENDING");
});

test("settlement release cron rejects invalid CRON_SECRET without evaluating a batch", async () => {
  const previous = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "local-cron-secret";
  try {
    const response = await settlementReleaseCron.GET(new Request("http://localhost/api/cron/settlements/release"));
    assert.equal(response.status, 401);
  } finally {
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  }
});

test("manual reversal execution handles seller and partner legs with one idempotent row per leg", async () => {
  const { fixture, settlement } = await createReconciliableSettlement(
    "settlement-manual-reversal-both-legs",
    { withReferral: true },
  );
  const legs = await db.settlementLeg.findMany({
    where: { settlementId: settlement.id },
    select: { id: true, type: true },
  });
  const sellerLeg = legs.find((leg) => leg.type === "SELLER_PAYABLE");
  const partnerLeg = legs.find((leg) => leg.type === "PARTNER_REFERRAL");
  assert.ok(sellerLeg);
  assert.ok(partnerLeg);
  const sellerTransferId = `tr_${unique("manual-seller-original")}`;
  const partnerTransferId = `tr_${unique("manual-partner-original")}`;
  await db.$transaction([
    db.settlement.update({ where: { id: settlement.id }, data: { status: "REVERSAL_PENDING" } }),
    db.settlementLeg.update({ where: { id: sellerLeg.id }, data: { status: "REVERSAL_PENDING", stripeTransferId: sellerTransferId, transferredAt: new Date() } }),
    db.settlementLeg.update({ where: { id: partnerLeg.id }, data: { status: "REVERSAL_PENDING", stripeTransferId: partnerTransferId, transferredAt: new Date() } }),
  ]);

  const refundId = `re_${unique("manual-reversal")}`;
  const sellerReversal = await db.settlementReversal.create({
    data: {
      settlementId: settlement.id,
      settlementLegId: sellerLeg.id,
      amount: 100,
      requestedAmount: 100,
      currency: "usd",
      reason: "REFUND",
      sourceType: "REFUND",
      stripeSourceObjectId: refundId,
      stripeRefundId: refundId,
      originalStripeTransferId: sellerTransferId,
      status: "PENDING",
      idempotencyKey: unique("seller-reversal-execution"),
    },
  });
  const partnerReversal = await db.settlementReversal.create({
    data: {
      settlementId: settlement.id,
      settlementLegId: partnerLeg.id,
      amount: 50,
      requestedAmount: 50,
      currency: "usd",
      reason: "REFUND",
      sourceType: "REFUND",
      stripeSourceObjectId: refundId,
      stripeRefundId: refundId,
      originalStripeTransferId: partnerTransferId,
      status: "PENDING",
      idempotencyKey: unique("partner-reversal-execution"),
    },
  });

  const calls: Array<{ transferId: string; amount: number; idempotencyKey: string }> = [];
  const stripe = {
    transfers: {
      listReversals: async () => ({ data: [] }),
      createReversal: async (
        transferId: string,
        params: { amount?: number },
        options: { idempotencyKey?: string },
      ) => {
        calls.push({ transferId, amount: params.amount ?? 0, idempotencyKey: options.idempotencyKey ?? "" });
        return { id: `trr_${unique("manual-reversal")}`, amount: params.amount };
      },
    },
  } as never;

  const sellerResult = await reversalExecution.executeSettlementReversal({
    settlementReversalId: sellerReversal.id,
    actorUserId: fixture.admin.id,
    mode: "manual",
    stripe,
  });
  const partnerResult = await reversalExecution.executeSettlementReversal({
    settlementReversalId: partnerReversal.id,
    actorUserId: fixture.admin.id,
    mode: "manual",
    stripe,
  });
  assert.equal(sellerResult.status, "reversed");
  assert.equal(partnerResult.status, "reversed");
  assert.equal(calls.length, 2);
  assert.equal(calls[0]?.idempotencyKey, reversalExecution.settlementReversalIdempotencyKey(sellerReversal.id));
  assert.equal(calls[1]?.idempotencyKey, reversalExecution.settlementReversalIdempotencyKey(partnerReversal.id));
  assert.equal(await db.settlementReversal.count({ where: { stripeRefundId: refundId } }), 2);

  const duplicate = await reversalExecution.executeSettlementReversal({
    settlementReversalId: sellerReversal.id,
    actorUserId: fixture.admin.id,
    mode: "manual",
    stripe,
  });
  assert.equal(duplicate.status, "ineligible");
  assert.equal(calls.length, 2);
});

test("manual reversals remain pending through a partial reversal and close the leg at the cumulative cap", async () => {
  const { fixture, settlement } = await createReconciliableSettlement("settlement-manual-reversal-cumulative");
  const sellerLeg = await db.settlementLeg.findFirstOrThrow({
    where: { settlementId: settlement.id, type: "SELLER_PAYABLE" },
  });
  await db.$transaction([
    db.settlement.update({ where: { id: settlement.id }, data: { status: "REVERSAL_PENDING" } }),
    db.settlementLeg.update({
      where: { id: sellerLeg.id },
      data: { status: "REVERSAL_PENDING", stripeTransferId: `tr_${unique("cumulative-original")}`, transferredAt: new Date() },
    }),
  ]);
  const first = await db.settlementReversal.create({
    data: {
      settlementId: settlement.id,
      settlementLegId: sellerLeg.id,
      amount: 100,
      requestedAmount: 100,
      currency: "usd",
      reason: "REFUND",
      sourceType: "REFUND",
      stripeSourceObjectId: `re_${unique("cumulative-first")}`,
      originalStripeTransferId: `tr_${unique("cumulative-original-first")}`,
      status: "PENDING",
      idempotencyKey: unique("cumulative-first"),
    },
  });
  const second = await db.settlementReversal.create({
    data: {
      settlementId: settlement.id,
      settlementLegId: sellerLeg.id,
      amount: sellerLeg.amount - 100,
      requestedAmount: sellerLeg.amount - 100,
      currency: "usd",
      reason: "REFUND",
      sourceType: "REFUND",
      stripeSourceObjectId: `re_${unique("cumulative-second")}`,
      originalStripeTransferId: `tr_${unique("cumulative-original-second")}`,
      status: "PENDING",
      idempotencyKey: unique("cumulative-second"),
    },
  });
  const stripe = {
    transfers: {
      listReversals: async () => ({ data: [] }),
      createReversal: async (
        _transferId: string,
        params: { amount?: number },
      ) => ({ id: `trr_${unique("cumulative")}`, amount: params.amount }),
    },
  } as never;

  const partial = await reversalExecution.executeSettlementReversal({
    settlementReversalId: first.id,
    actorUserId: fixture.admin.id,
    mode: "manual",
    stripe,
  });
  assert.equal(partial.status, "reversed");
  const partialLeg = await db.settlementLeg.findUniqueOrThrow({ where: { id: sellerLeg.id } });
  assert.equal(partialLeg.status, "REVERSAL_PENDING");

  const complete = await reversalExecution.executeSettlementReversal({
    settlementReversalId: second.id,
    actorUserId: fixture.admin.id,
    mode: "manual",
    stripe,
  });
  assert.equal(complete.status, "reversed");
  const [finalLeg, finalSettlement] = await Promise.all([
    db.settlementLeg.findUniqueOrThrow({ where: { id: sellerLeg.id } }),
    db.settlement.findUniqueOrThrow({ where: { id: settlement.id } }),
  ]);
  assert.equal(finalLeg.status, "REVERSED");
  assert.equal(finalSettlement.status, "REVERSED");
});

test("attempt-five reversal recovery keeps uncertainty pending and reuses its idempotency key", async () => {
  const { fixture, settlement } = await createReconciliableSettlement("settlement-manual-reversal-recovery");
  const sellerLeg = await db.settlementLeg.findFirstOrThrow({
    where: { settlementId: settlement.id, type: "SELLER_PAYABLE" },
  });
  await db.$transaction([
    db.settlement.update({ where: { id: settlement.id }, data: { status: "REVERSAL_PENDING" } }),
    db.settlementLeg.update({
      where: { id: sellerLeg.id },
      data: { status: "REVERSAL_PENDING", stripeTransferId: `tr_${unique("recovery-original")}`, transferredAt: new Date() },
    }),
  ]);
  const reversal = await db.settlementReversal.create({
    data: {
      settlementId: settlement.id,
      settlementLegId: sellerLeg.id,
      amount: 100,
      requestedAmount: 100,
      currency: "usd",
      reason: "REFUND",
      sourceType: "REFUND",
      stripeSourceObjectId: `re_${unique("recovery-source")}`,
      originalStripeTransferId: `tr_${unique("recovery-original")}`,
      status: "PENDING",
      reversalAttemptCount: 5,
      nextReversalAttemptAt: new Date("2026-07-18T11:00:00.000Z"),
      idempotencyKey: unique("recovery-reversal"),
    },
  });
  const now = new Date("2026-07-18T12:00:00.000Z");
  const idempotencyKeys: string[] = [];
  let shouldFail = true;
  const stripe = {
    transfers: {
      listReversals: async () => ({ data: [] }),
      createReversal: async (
        _transferId: string,
        params: { amount?: number },
        options: { idempotencyKey?: string },
      ) => {
        idempotencyKeys.push(options.idempotencyKey ?? "");
        if (shouldFail) {
          shouldFail = false;
          throw { type: "api_connection_error" };
        }
        return { id: `trr_${unique("recovery")}`, amount: params.amount };
      },
    },
  } as never;

  const failed = await reversalExecution.executeSettlementReversal({
    settlementReversalId: reversal.id,
    actorUserId: fixture.admin.id,
    mode: "manual",
    stripe,
    now,
  });
  assert.equal(failed.status, "retry_scheduled");
  const afterFailure = await db.settlementReversal.findUniqueOrThrow({ where: { id: reversal.id } });
  assert.equal(afterFailure.status, "PENDING");
  assert.equal(afterFailure.reversalAttemptCount, 5);
  assert.equal(afterFailure.reversalLockedAt, null);
  assert.match(afterFailure.reversalLastError ?? "", /^uncertain:/);

  await db.settlementReversal.update({
    where: { id: reversal.id },
    data: { nextReversalAttemptAt: new Date("2026-07-18T11:59:00.000Z") },
  });
  const recovered = await reversalExecution.executeSettlementReversal({
    settlementReversalId: reversal.id,
    actorUserId: fixture.admin.id,
    mode: "manual",
    stripe,
    now,
  });
  assert.equal(recovered.status, "reversed");
  assert.equal(idempotencyKeys.length, 2);
  assert.equal(idempotencyKeys[0], reversalExecution.settlementReversalIdempotencyKey(reversal.id));
  assert.equal(idempotencyKeys[1], idempotencyKeys[0]);
  assert.equal((await db.settlementReversal.findUniqueOrThrow({ where: { id: reversal.id } })).reversalAttemptCount, 5);
});
