import assert from "node:assert/strict";
import { after, test } from "node:test";
import type { Prisma, PrismaClient } from "../src/generated/prisma/client.ts";
import type { createTradeOrderForPaymentRequest } from "../src/lib/trade-orders.ts";

type TradeOrdersModule = { createTradeOrderForPaymentRequest: typeof createTradeOrderForPaymentRequest };

function assertDisposableDatabase() {
  const value = process.env.DATABASE_URL;
  assert.ok(value, "DATABASE_URL is required for the worker integration suite.");
  const url = new URL(value);
  assert.ok(["127.0.0.1", "localhost"].includes(url.hostname), "The worker integration database must be localhost only.");
  assert.match(url.pathname.slice(1), /^trade82_settlement_operations_worker_test_[a-z0-9_-]+$/i);
  assert.doesNotMatch(url.hostname, /supabase|neon|aws|vercel|render|railway|fly/i);
}

assertDisposableDatabase();
process.env.DATABASE_POOL_MAX = "12";
process.env.STRIPE_CONNECT_RUNTIME_MODE = "test";
process.env.STRIPE_SECRET_KEY = "sk_test_worker_fixture";

const [{ getDb }, tradeOrdersModule, financials, operations, settlementRules] = await Promise.all([
  import(new URL("../src/lib/db.ts", import.meta.url).href),
  import(new URL("../src/lib/trade-orders.ts", import.meta.url).href),
  import(new URL("../src/lib/order-financials.ts", import.meta.url).href),
  import(new URL("../src/lib/settlement-operations-control-plane.ts", import.meta.url).href),
  import(new URL("../src/lib/stripe-connect-settlement-financials.ts", import.meta.url).href),
]);

const db = getDb() as PrismaClient;
const tradeOrders = tradeOrdersModule as TradeOrdersModule;
let sequence = 0;

function unique(prefix: string) {
  sequence += 1;
  return `${prefix}-${Date.now().toString(36)}-${sequence}`;
}

function envWithModes<T>(callback: () => Promise<T>) {
  const previous = {
    transfer: process.env.STRIPE_CONNECT_TRANSFER_EXECUTION_MODE,
    reversal: process.env.STRIPE_CONNECT_REVERSAL_EXECUTION_MODE,
  };
  process.env.STRIPE_CONNECT_TRANSFER_EXECUTION_MODE = "auto";
  process.env.STRIPE_CONNECT_REVERSAL_EXECUTION_MODE = "auto";
  return callback().finally(() => {
    if (previous.transfer === undefined) delete process.env.STRIPE_CONNECT_TRANSFER_EXECUTION_MODE;
    else process.env.STRIPE_CONNECT_TRANSFER_EXECUTION_MODE = previous.transfer;
    if (previous.reversal === undefined) delete process.env.STRIPE_CONNECT_REVERSAL_EXECUTION_MODE;
    else process.env.STRIPE_CONNECT_REVERSAL_EXECUTION_MODE = previous.reversal;
  });
}

async function createFixture({
  paymentFlow = "SCT",
  legType = "SELLER_PAYABLE",
  legStatus = "READY",
  settlementStatus = "READY",
  transferState = false,
  transferLockedAt,
  paymentCurrency = "usd",
  legCurrency = "usd",
  manualReviewRequired = false,
  transferAttemptCount = 0,
  reversalSource,
  disputeStatus,
  reversalAmount = 4_000,
  successfullyReversedAmount = 0,
  reversalStatus = "PENDING",
  reversalAttemptCount = 0,
  nextReversalAttemptAt,
  reversalLockedAt,
}: {
  paymentFlow?: "SCT" | "DIRECT_CHARGE";
  legType?: "SELLER_PAYABLE" | "PARTNER_REFERRAL" | "PLATFORM_FEE";
  legStatus?: "READY" | "HOLD" | "TRANSFER_PENDING" | "TRANSFERRED" | "REVERSAL_PENDING";
  settlementStatus?: "READY" | "HOLD" | "TRANSFER_PENDING" | "TRANSFERRED" | "REVERSAL_PENDING";
  transferState?: boolean;
  transferLockedAt?: Date;
  paymentCurrency?: string;
  legCurrency?: string;
  manualReviewRequired?: boolean;
  transferAttemptCount?: number;
  reversalSource?: "REFUND" | "DISPUTE_LOST";
  disputeStatus?: "open" | "lost";
  reversalAmount?: number;
  successfullyReversedAmount?: number;
  reversalStatus?: "PENDING" | "FAILED" | "NEEDS_MANUAL_REVIEW";
  reversalAttemptCount?: number;
  nextReversalAttemptAt?: Date | null;
  reversalLockedAt?: Date;
} = {}) {
  const suffix = unique("worker");
  const [buyer, seller] = await Promise.all([
    db.userProfile.create({
      data: {
        clerkUserId: `worker-buyer-${suffix}`,
        email: `worker-buyer-${suffix}@example.test`,
        displayName: "Worker buyer",
        country: "US",
        role: "buyer",
      },
    }),
    db.userProfile.create({
      data: {
        clerkUserId: `worker-seller-${suffix}`,
        email: `worker-seller-${suffix}@example.test`,
        displayName: "Worker seller",
        country: "KR",
        role: "seller",
      },
    }),
  ]);
  const [buyerCompany, sellerCompany] = await Promise.all([
    db.company.create({
      data: {
        ownerUserId: buyer.id,
        companyRole: "buyer",
        legalName: `Worker buyer ${suffix}`,
        tradeName: `Worker buyer ${suffix}`,
        country: "US",
        businessAddress: "Buyer address",
      },
    }),
    db.company.create({
      data: {
        ownerUserId: seller.id,
        companyRole: "seller",
        legalName: `Worker seller ${suffix}`,
        tradeName: `Worker seller ${suffix}`,
        country: "KR",
        businessAddress: "Seller address",
      },
    }),
  ]);
  const product = await db.product.create({
    data: {
      sellerCompanyId: sellerCompany.id,
      name: `Worker product ${suffix}`,
      slug: `worker-product-${suffix}`,
      category: "Beauty",
      shortDescription: "Worker fixture",
      detailedDescription: "Worker fixture",
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
      message: "Worker fixture inquiry",
    },
  });
  const amounts = financials.calculateOrderFinancials(10_000, 1_000);
  const paymentRequest = await db.paymentRequest.create({
    data: {
      inquiryId: inquiry.id,
      buyerCompanyId: buyerCompany.id,
      sellerCompanyId: sellerCompany.id,
      createdByUserId: seller.id,
      productName: product.name,
      quantity: "10",
      unit: "units",
      productAmount: 10_000,
      shippingAmount: 1_000,
      grossAmount: amounts.grossAmount,
      platformFeeAmount: amounts.platformFeeAmount,
      sellerPayableAmount: amounts.sellerPayableAmount,
      currency: "usd",
      paymentDueDate: new Date("2026-08-01T00:00:00.000Z"),
      orderTerms: "Worker fixture terms",
      status: "PAID",
      paidAt: new Date("2026-07-19T10:00:00.000Z"),
      stripePaymentIntentId: `pi_${suffix}`,
      stripeCheckoutSessionId: `cs_${suffix}`,
      stripeChargeId: `ch_${suffix}`,
    },
  });
  const paidAt = paymentRequest.paidAt;
  assert.ok(paidAt);
  const order = await db.$transaction((tx: Prisma.TransactionClient) => tradeOrders.createTradeOrderForPaymentRequest(tx, paymentRequest.id, paidAt));
  await db.tradeOrder.update({
    where: { id: order.id },
    data: { orderStatus: "PAID", paymentStatus: disputeStatus ? "DISPUTED" : "PAID", paidAt: paymentRequest.paidAt },
  });
  const persistedPaymentRequest = paymentCurrency === "usd"
    ? paymentRequest
    : await db.paymentRequest.update({ where: { id: paymentRequest.id }, data: { currency: paymentCurrency } });
  if (disputeStatus) {
    await db.paymentRequest.update({ where: { id: paymentRequest.id }, data: { status: disputeStatus === "lost" ? "DISPUTED" : "DISPUTED" } });
    await db.paymentDispute.create({
      data: {
        paymentRequestId: paymentRequest.id,
        stripeDisputeId: `dp_${suffix}`,
        amount: 11_000,
        status: disputeStatus,
        lastStripeEventCreatedAt: paidAt,
        lastStripeEventId: `evt_${suffix}`,
      },
    });
  }
  const partnerUser = legType === "PARTNER_REFERRAL"
    ? await db.userProfile.create({
        data: {
          clerkUserId: `worker-partner-${suffix}`,
          email: `worker-partner-${suffix}@example.test`,
          displayName: "Worker partner",
          country: "US",
          role: "user",
        },
      })
    : null;
  const partner = partnerUser
    ? await db.partnerProfile.create({ data: { userId: partnerUser.id, referralCode: `WORKER${sequence}` } })
    : null;
  if (legType === "PARTNER_REFERRAL" && partner) {
    await db.stripeConnectedAccount.create({
      data: {
        partnerProfileId: partner.id,
        stripeAccountId: `acct_partner_${suffix}`,
        status: "ENABLED",
        transfersEnabled: true,
        payoutsEnabled: true,
        detailsSubmitted: true,
        onboardingComplete: true,
      },
    });
  }
  const referralAttribution = partner
    ? await db.referralAttribution.create({
        data: {
          referredUserId: seller.id,
          partnerProfileId: partner.id,
          referralCode: partner.referralCode,
          status: "LOCKED",
          lockedAt: paidAt,
        },
      })
    : null;
  if (legType === "SELLER_PAYABLE" || legType === "PLATFORM_FEE") {
    await db.stripeConnectedAccount.create({
      data: {
        companyId: sellerCompany.id,
        stripeAccountId: `acct_seller_${suffix}`,
        status: "ENABLED",
        transfersEnabled: true,
        payoutsEnabled: true,
        detailsSubmitted: true,
        onboardingComplete: true,
      },
    });
  }
  const now = new Date("2026-07-19T12:00:00.000Z");
  const financialsForSettlement = settlementRules.calculateStripeConnectSettlementFinancials({
    grossAmount: amounts.grossAmount,
    currency: "usd",
    hasReferralAttribution: legType === "PARTNER_REFERRAL",
  });
  const settlement = await db.settlement.create({
    data: {
      paymentRequestId: paymentRequest.id,
      tradeOrderId: order.id,
      ...financialsForSettlement,
      currency: "usd",
      paymentFlow,
      ...(referralAttribution
        ? {
            referralAttributionId: referralAttribution.id,
            referralPartnerProfileId: referralAttribution.partnerProfileId,
            referralCodeSnapshot: referralAttribution.referralCode,
            referralSubjectType: "SELLER",
            referredUserIdSnapshot: referralAttribution.referredUserId,
          }
        : {}),
      holdUntil: new Date(now.getTime() - 60_000),
      status: settlementStatus,
      ...(settlementStatus === "HOLD" ? { holdReason: "Worker fixture hold" } : {}),
      approvedAt: new Date(now.getTime() - 60_000),
      idempotencyKey: `worker-settlement-${suffix}`,
      legs: {
        create: {
          type: legType,
          ...(legType === "SELLER_PAYABLE" ? { recipientCompanyId: sellerCompany.id } : {}),
          ...(legType === "PARTNER_REFERRAL" && partner ? { recipientUserId: partner.userId, partnerProfileId: partner.id } : {}),
          amount: legType === "PLATFORM_FEE" ? financialsForSettlement.platformFeeAmount : legType === "PARTNER_REFERRAL" ? financialsForSettlement.partnerReferralAmount : financialsForSettlement.sellerPayableAmount,
          currency: legCurrency,
          holdUntil: new Date(now.getTime() - 60_000),
          status: legStatus,
          idempotencyKey: `worker-leg-${suffix}`,
          manualReviewRequired,
          transferAttemptCount,
          ...(transferState ? { stripeTransferId: `tr_${suffix}`, transferredAt: new Date(now.getTime() - 30_000) } : {}),
          ...(transferLockedAt ? { transferLockedAt } : {}),
        },
      },
    },
    include: { legs: true },
  });
  const leg = settlement.legs[0];
  const reversal = reversalSource
    ? await db.settlementReversal.create({
        data: {
          settlementId: settlement.id,
          settlementLegId: leg.id,
          amount: reversalAmount,
          requestedAmount: reversalAmount,
          successfullyReversedAmount,
          currency: legCurrency,
          reason: reversalSource === "REFUND" ? "REFUND" : "DISPUTE",
          sourceType: reversalSource,
          stripeSourceObjectId: reversalSource === "REFUND" ? `re_${suffix}` : `dp_${suffix}`,
          originalStripeTransferId: `tr_${suffix}`,
          status: reversalStatus,
          reversalAttemptCount,
          nextReversalAttemptAt,
          ...(reversalLockedAt ? { reversalLockedAt } : {}),
          idempotencyKey: `worker-reversal-${suffix}`,
        },
      })
    : null;
  return { suffix, buyer, seller, buyerCompany, sellerCompany, paymentRequest: persistedPaymentRequest, order, settlement, leg, reversal, now };
}

function requiredReversalId(fixture: { reversal: { id: string } | null }) {
  assert.ok(fixture.reversal);
  return fixture.reversal.id;
}

type TestStripeCall = {
  params: { amount: number; currency?: string; source_transaction?: string; destination?: string };
  options: { idempotencyKey: string };
  transferId?: string;
};

function transferStripe(calls: TestStripeCall[]) {
  return {
    transfers: {
      create: async (params: TestStripeCall["params"], options: TestStripeCall["options"]) => {
        calls.push({ params, options });
        return { id: `tr_worker_${calls.length}` };
      },
    },
  } as never;
}

function reversalStripe(calls: TestStripeCall[]) {
  return {
    transfers: {
      createReversal: async (transferId: string, params: TestStripeCall["params"], options: TestStripeCall["options"]) => {
        calls.push({ transferId, params, options });
        return { id: `trr_worker_${calls.length}`, amount: params.amount };
      },
      listReversals: async () => ({ data: [], has_more: false }),
    },
  } as never;
}

function fixedClock(now: Date) {
  return () => new Date(now.getTime());
}

after(async () => {
  await db.$disconnect();
});

test("runs seller and partner transfers with immutable USD/source/idempotency values", async () => {
  await envWithModes(async () => {
    const sellerFixture = await createFixture();
    const partnerFixture = await createFixture({ legType: "PARTNER_REFERRAL" });
    const calls: TestStripeCall[] = [];
    const result = await operations.runSettlementTransferBatch({ db, stripe: transferStripe(calls), now: sellerFixture.now, clock: fixedClock(sellerFixture.now), batchSize: 20 });

    assert.equal(result.succeededCount, 2);
    assert.equal(calls.length, 2);
    assert.deepEqual(calls.map((call) => [call.params.currency, call.params.source_transaction]), [["usd", sellerFixture.paymentRequest.stripeChargeId], ["usd", partnerFixture.paymentRequest.stripeChargeId]]);
    assert.ok(calls.every((call) => call.params.amount > 0 && call.params.destination?.startsWith("acct_") && call.options.idempotencyKey.startsWith("stripe-connect-transfer:settlement-leg:")));
    const stored = await db.settlementLeg.findMany({ where: { id: { in: [sellerFixture.leg.id, partnerFixture.leg.id] } }, select: { status: true, transferLockedAt: true, transferredAt: true, stripeTransferId: true } });
    assert.equal(stored.filter((row) => row.status === "TRANSFERRED").length, 2);
    assert.ok(stored.every((row) => row.transferLockedAt === null && row.transferredAt && row.stripeTransferId));
    assert.equal(result.status, "SUCCEEDED");
  });
});

test("excludes Direct Charge and platform-fee legs without Stripe calls", async () => {
  await envWithModes(async () => {
    const direct = await createFixture({ paymentFlow: "DIRECT_CHARGE" });
    const platform = await createFixture({ legType: "PLATFORM_FEE" });
    const wrongPaymentCurrency = await createFixture({ paymentCurrency: "eur" });
    const calls: TestStripeCall[] = [];
    const result = await operations.runSettlementTransferBatch({ db, stripe: transferStripe(calls), now: direct.now, clock: fixedClock(direct.now) });

    assert.equal(calls.length, 0);
    assert.equal(result.succeededCount, 0);
    assert.equal(await db.settlementLeg.count({ where: { id: { in: [direct.leg.id, platform.leg.id, wrongPaymentCurrency.leg.id] }, status: "READY" } }), 3);
  });
});

test("two concurrent transfer workers claim one leg and make one mocked call", async () => {
  await envWithModes(async () => {
    const fixture = await createFixture();
    const calls: TestStripeCall[] = [];
    const [first, second] = await Promise.all([
      operations.runSettlementTransferBatch({ db, stripe: transferStripe(calls), now: fixture.now, clock: fixedClock(fixture.now), batchSize: 1 }),
      operations.runSettlementTransferBatch({ db, stripe: transferStripe(calls), now: fixture.now, clock: fixedClock(fixture.now), batchSize: 1 }),
    ]);
    assert.equal(calls.length, 1);
    assert.equal(first.succeededCount + second.succeededCount, 1);
    assert.equal(await db.settlementLeg.count({ where: { id: fixture.leg.id, status: "TRANSFERRED" } }), 1);
  });
});

test("transfer workers recover stale claims but leave active claims and Direct Charge rows untouched", async () => {
  await envWithModes(async () => {
    const now = new Date("2026-07-19T12:00:00.000Z");
    const stale = await createFixture({
      legStatus: "TRANSFER_PENDING",
      settlementStatus: "TRANSFER_PENDING",
      transferLockedAt: new Date(now.getTime() - operations.SETTLEMENT_WORKER_STALE_LOCK_MS - 1),
    });
    const active = await createFixture({
      legStatus: "TRANSFER_PENDING",
      settlementStatus: "TRANSFER_PENDING",
      transferLockedAt: new Date(now.getTime() - 1_000),
    });
    const direct = await createFixture({ paymentFlow: "DIRECT_CHARGE" });
    const calls: TestStripeCall[] = [];
    const result = await operations.runSettlementTransferBatch({ db, stripe: transferStripe(calls), now, clock: fixedClock(now), batchSize: 20 });

    assert.equal(calls.length, 1);
    assert.equal(result.staleRecoveredCount, 1);
    assert.equal(await db.settlementLeg.count({ where: { id: stale.leg.id, status: "TRANSFERRED" } }), 1);
    assert.equal(await db.settlementLeg.count({ where: { id: active.leg.id, status: "TRANSFER_PENDING" } }), 1);
    assert.equal(await db.settlementLeg.count({ where: { id: direct.leg.id, status: "READY" } }), 1);
  });
});

test("independent refund and dispute reversals preserve remaining amounts and finalize safely", async () => {
  await envWithModes(async () => {
    const partialRefund = await createFixture({ legStatus: "TRANSFERRED", settlementStatus: "REVERSAL_PENDING", transferState: true, reversalSource: "REFUND", reversalAmount: 10_450, successfullyReversedAmount: 4_000 });
    const fullRefund = await createFixture({ legStatus: "TRANSFERRED", settlementStatus: "REVERSAL_PENDING", transferState: true, reversalSource: "REFUND", reversalAmount: 10_450 });
    const partialDispute = await createFixture({ legStatus: "TRANSFERRED", settlementStatus: "REVERSAL_PENDING", transferState: true, reversalSource: "DISPUTE_LOST", disputeStatus: "lost", reversalAmount: 10_450, successfullyReversedAmount: 3_000 });
    const fullDispute = await createFixture({ legStatus: "TRANSFERRED", settlementStatus: "REVERSAL_PENDING", transferState: true, reversalSource: "DISPUTE_LOST", disputeStatus: "lost", reversalAmount: 10_450 });
    const calls: TestStripeCall[] = [];
    const fixtures = [partialRefund, fullRefund, partialDispute, fullDispute];
    const result = await operations.runSettlementReversalBatch({ db, stripe: reversalStripe(calls), now: partialRefund.now, clock: fixedClock(partialRefund.now), batchSize: 20 });

    assert.equal(result.succeededCount, 4);
    assert.equal(calls.length, 4);
    assert.deepEqual(calls.map((call) => call.params.amount).sort((left, right) => left - right), [6_450, 7_450, 10_450, 10_450]);
    assert.ok(calls.every((call) => call.params.currency === undefined && call.options.idempotencyKey.startsWith("stripe-connect-transfer-reversal:settlement-reversal:")));
    const stored = await db.settlementReversal.findMany({
      where: { id: { in: fixtures.map(requiredReversalId) } },
      select: { id: true, status: true, amount: true, requestedAmount: true, successfullyReversedAmount: true, reversalAttemptCount: true, reversalLockedAt: true, nextReversalAttemptAt: true, reversalLastError: true, completedAt: true, stripeTransferReversalId: true, idempotencyKey: true },
    });
    assert.equal(stored.length, 4);
    assert.ok(stored.every((row) => row.status === "COMPLETED" && row.reversalLockedAt === null && row.nextReversalAttemptAt === null && row.reversalLastError === null && row.completedAt && row.stripeTransferReversalId));
    assert.ok(stored.every((row) => row.successfullyReversedAmount === row.requestedAmount && row.reversalAttemptCount === 1 && row.idempotencyKey));
    assert.equal(new Set(calls.map((call) => call.options.idempotencyKey)).size, 4);
    for (const fixture of fixtures) {
      assert.equal(await db.settlementLeg.count({ where: { id: fixture.leg.id, status: "REVERSED" } }), 1);
      assert.equal(await db.settlement.count({ where: { id: fixture.settlement.id, status: "REVERSED" } }), 1);
    }
  });
});

test("two concurrent reversal workers claim one reversal and make one mocked call", async () => {
  await envWithModes(async () => {
    const fixture = await createFixture({ legStatus: "TRANSFERRED", settlementStatus: "REVERSAL_PENDING", transferState: true, reversalSource: "REFUND" });
    const calls: TestStripeCall[] = [];
    assert.ok(fixture.reversal);
    const [first, second] = await Promise.all([
      operations.runSettlementReversalBatch({ db, stripe: reversalStripe(calls), now: fixture.now, clock: fixedClock(fixture.now), batchSize: 1 }),
      operations.runSettlementReversalBatch({ db, stripe: reversalStripe(calls), now: fixture.now, clock: fixedClock(fixture.now), batchSize: 1 }),
    ]);
    assert.equal(calls.length, 1);
    assert.equal(first.succeededCount + second.succeededCount, 1);
    assert.equal(await db.settlementReversal.count({ where: { id: fixture.reversal.id, status: "COMPLETED" } }), 1);
  });
});

test("an exhausted READY transfer is held for manual review without a Stripe call", async () => {
  await envWithModes(async () => {
    const fixture = await createFixture({ transferAttemptCount: 5 });
    const calls: TestStripeCall[] = [];
    const result = await operations.runSettlementTransferBatch({ db, stripe: transferStripe(calls), now: fixture.now, clock: fixedClock(fixture.now), batchSize: 20 });

    assert.equal(calls.length, 0);
    assert.equal(result.failedCount, 1);
    assert.equal(result.manualReviewCount, 1);
    assert.equal(result.skippedCount, 0);
    assert.equal(result.claimedCount, 0);
    assert.equal(result.status, "FAILED");
    assert.equal((await db.settlementLeg.findUnique({ where: { id: fixture.leg.id }, select: { manualReviewRequired: true } }))?.manualReviewRequired, true);
    assert.equal(await db.settlementOperationalAlert.count({ where: { settlementLegId: fixture.leg.id, alertType: "TRANSFER_RETRY_EXHAUSTED" } }), 1);
  });
});

test("reversal candidates enforce retry, lock, flow, status, dispute, and currency guards", async () => {
  await envWithModes(async () => {
    const now = new Date("2026-07-19T12:00:00.000Z");
    const stale = await createFixture({
      legStatus: "TRANSFERRED",
      settlementStatus: "REVERSAL_PENDING",
      transferState: true,
      reversalSource: "REFUND",
      reversalLockedAt: new Date(now.getTime() - operations.SETTLEMENT_WORKER_STALE_LOCK_MS - 1),
    });
    const active = await createFixture({
      legStatus: "TRANSFERRED",
      settlementStatus: "REVERSAL_PENDING",
      transferState: true,
      reversalSource: "REFUND",
      reversalLockedAt: new Date(now.getTime() - 1_000),
    });
    const openDispute = await createFixture({
      legStatus: "TRANSFERRED",
      settlementStatus: "REVERSAL_PENDING",
      transferState: true,
      reversalSource: "REFUND",
      disputeStatus: "open",
    });
    const retryNotDue = await createFixture({
      legStatus: "TRANSFERRED",
      settlementStatus: "REVERSAL_PENDING",
      transferState: true,
      reversalSource: "REFUND",
      nextReversalAttemptAt: new Date(now.getTime() + 60_000),
    });
    const exhausted = await createFixture({
      legStatus: "TRANSFERRED",
      settlementStatus: "REVERSAL_PENDING",
      transferState: true,
      reversalSource: "REFUND",
      reversalAttemptCount: 5,
    });
    const manualReview = await createFixture({
      legStatus: "TRANSFERRED",
      settlementStatus: "REVERSAL_PENDING",
      transferState: true,
      reversalSource: "REFUND",
      reversalStatus: "NEEDS_MANUAL_REVIEW",
    });
    const direct = await createFixture({ paymentFlow: "DIRECT_CHARGE", legStatus: "TRANSFERRED", settlementStatus: "REVERSAL_PENDING", transferState: true, reversalSource: "REFUND" });
    const platform = await createFixture({ legType: "PLATFORM_FEE", legStatus: "TRANSFERRED", settlementStatus: "REVERSAL_PENDING", transferState: true, reversalSource: "REFUND" });
    const wrongCurrency = await createFixture({ legStatus: "TRANSFERRED", settlementStatus: "REVERSAL_PENDING", transferState: true, reversalSource: "REFUND", legCurrency: "eur" });
    const calls: TestStripeCall[] = [];
    const result = await operations.runSettlementReversalBatch({ db, stripe: reversalStripe(calls), now, clock: fixedClock(now), batchSize: 20 });

    assert.equal(calls.length, 1);
    assert.equal(result.staleRecoveredCount, 1);
    assert.equal(result.manualReviewCount, 1);
    assert.equal(await db.settlementReversal.count({ where: { id: requiredReversalId(stale), status: "COMPLETED" } }), 1);
    assert.equal(await db.settlementReversal.count({ where: { id: requiredReversalId(active), status: "PENDING" } }), 1);
    assert.equal(await db.settlementReversal.count({ where: { id: requiredReversalId(openDispute), status: "PENDING" } }), 1);
    assert.equal(await db.settlementReversal.count({ where: { id: requiredReversalId(retryNotDue), status: "PENDING" } }), 1);
    assert.equal(await db.settlementReversal.count({ where: { id: requiredReversalId(manualReview), status: "NEEDS_MANUAL_REVIEW" } }), 1);
    assert.equal(await db.settlementReversal.count({ where: { id: requiredReversalId(direct), status: "PENDING" } }), 1);
    assert.equal(await db.settlementReversal.count({ where: { id: requiredReversalId(platform), status: "PENDING" } }), 1);
    assert.equal(await db.settlementReversal.count({ where: { id: requiredReversalId(wrongCurrency), status: "PENDING" } }), 1);
    assert.equal(await db.settlementReversal.count({ where: { id: requiredReversalId(exhausted), status: "NEEDS_MANUAL_REVIEW" } }), 1);
  });
});

test("operational alerts reopen and deduplicate in PostgreSQL", async () => {
  const now = new Date("2026-07-19T12:00:00.000Z");
  const first = await operations.upsertSettlementOperationalAlert({
    db,
    alertType: "WORKER_FAILED",
    severity: "CRITICAL",
    deduplicationKey: "worker-integration-dedup",
    title: "Worker failed",
    sanitizedMessage: "A worker failed safely.",
    now,
  });
  await db.settlementOperationalAlert.update({ where: { id: first.id }, data: { status: "RESOLVED", resolvedAt: now } });
  const second = await operations.upsertSettlementOperationalAlert({
    db,
    alertType: "WORKER_FAILED",
    severity: "CRITICAL",
    deduplicationKey: "worker-integration-dedup",
    title: "Worker failed",
    sanitizedMessage: "A worker failed safely again.",
    now: new Date(now.getTime() + 1_000),
  });
  assert.equal(second.id, first.id);
  assert.equal(second.occurrenceCount, 2);
  const stored = await db.settlementOperationalAlert.findUnique({ where: { id: first.id }, select: { status: true, resolvedAt: true, sanitizedMessage: true } });
  assert.equal(stored?.status, "OPEN");
  assert.equal(stored?.resolvedAt, null);
  assert.equal(stored?.sanitizedMessage, "A worker failed safely again.");
});

test("retry timing and terminal/manual-review records do not make Stripe calls", async () => {
  await envWithModes(async () => {
    const retryNotDue = await createFixture();
    const exhausted = await createFixture();
    const manualReview = await createFixture();
    await db.settlementLeg.update({ where: { id: retryNotDue.leg.id }, data: { nextTransferAttemptAt: new Date(retryNotDue.now.getTime() + 60_000) } });
    await db.settlementLeg.update({ where: { id: exhausted.leg.id }, data: { transferAttemptCount: 5 } });
    await db.settlementLeg.update({ where: { id: manualReview.leg.id }, data: { manualReviewRequired: true } });
    const calls: TestStripeCall[] = [];
    const result = await operations.runSettlementTransferBatch({ db, stripe: transferStripe(calls), now: retryNotDue.now, clock: fixedClock(retryNotDue.now), batchSize: 20 });
    assert.equal(calls.length, 0);
    assert.equal(result.succeededCount, 0);
    assert.equal(result.skippedCount, 1);
    assert.ok(result.manualReviewCount >= 1);
  });
});

test("worker metrics use database aggregates and keep Direct Charge unavailable", async () => {
  await envWithModes(async () => {
    const now = new Date("2026-07-19T12:00:00.000Z");
    const before = await operations.getSettlementOperationsMetrics({ db, now });
    const ready = await createFixture();
    const held = await createFixture({ legStatus: "HOLD", settlementStatus: "HOLD" });
    const transferred = await createFixture({ legStatus: "TRANSFERRED", settlementStatus: "TRANSFERRED", transferState: true, transferAttemptCount: 1 });
    const reversal = await createFixture({ legStatus: "TRANSFERRED", settlementStatus: "REVERSAL_PENDING", transferState: true, reversalSource: "REFUND", reversalAmount: 4_000, successfullyReversedAmount: 1_000, reversalAttemptCount: 1 });
    const after = await operations.getSettlementOperationsMetrics({ db, now });

    assert.equal(after.flow.DIRECT_CHARGE.available, false);
    assert.equal(after.readyTransferCount - before.readyTransferCount, 1);
    assert.equal(after.heldSettlementCount - before.heldSettlementCount, 1);
    assert.equal(after.successfulTransferCount - before.successfulTransferCount, 1);
    assert.equal(after.pendingReversalCount - before.pendingReversalCount, 1);
    assert.equal(after.pendingReversalAmount.usd - before.pendingReversalAmount.usd, 3_000);
    assert.equal(after.sellerPayableAmount.usd - before.sellerPayableAmount.usd, ready.leg.amount + held.leg.amount + transferred.leg.amount + reversal.leg.amount);
  });
});

test("worker metrics preserve aggregate amounts above signed 32-bit range", async () => {
  await envWithModes(async () => {
    const now = new Date("2026-07-19T12:00:00.000Z");
    const first = await createFixture();
    const second = await createFixture();
    await db.settlementLeg.updateMany({
      where: { id: { in: [first.leg.id, second.leg.id] } },
      data: { amount: 2_000_000_000 },
    });
    const metrics = await operations.getSettlementOperationsMetrics({ db, now });
    assert.ok(metrics.readyTransferAmount.usd >= 4_000_000_000);
  });
});
