import assert from "node:assert/strict";
import { after, test } from "node:test";

import type { PrismaClient } from "../src/generated/prisma/client.ts";

function assertDisposableDatabase() {
  const value = process.env.DATABASE_URL;
  assert.ok(value, "DATABASE_URL is required for the integration suite.");
  const url = new URL(value);
  assert.ok(["127.0.0.1", "localhost"].includes(url.hostname), "The integration suite must use localhost PostgreSQL.");
  assert.match(url.pathname.slice(1), /^trade82_order_payout_test_[a-z0-9_-]+$/i);
  assert.doesNotMatch(url.hostname, /supabase|neon|aws|vercel|render|railway|fly/i);
}

assertDisposableDatabase();
process.env.DATABASE_POOL_MAX = "12";
process.env.PAYOUT_DATA_ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString("base64");
process.env.PAYOUT_DATA_ENCRYPTION_KEY_VERSION ??= "integration-test-v1";

const { getDb } = await import(new URL("../src/lib/db.ts", import.meta.url).href);
const { createTradeOrderForPaymentRequest } = await import(new URL("../src/lib/trade-orders.ts", import.meta.url).href);
const { listAdminPayoutReviewTransactions } = await import(new URL("../src/lib/admin-payout-review.ts", import.meta.url).href);
const { markPartnerPayoutSent, revealPartnerPayoutInstructions, setPartnerPayoutStatus } = await import(new URL("../src/lib/partner-payouts.ts", import.meta.url).href);
const { encryptPayoutData } = await import(new URL("../src/lib/payout-crypto.ts", import.meta.url).href);
const db = getDb() as PrismaClient;

let sequence = 0;
function unique(prefix: string) {
  sequence += 1;
  return `${prefix}-${Date.now().toString(36)}-${sequence}`;
}

async function createFixture({
  withPartner = false,
  currency = "usd",
  paymentFlow = "SCT",
  status = "READY",
  withRefund = false,
  withDispute = false,
}: {
  withPartner?: boolean;
  currency?: string;
  paymentFlow?: "SCT" | "DIRECT_CHARGE";
  status?: "READY" | "HOLD";
  withRefund?: boolean;
  withDispute?: boolean;
} = {}) {
  const suffix = unique("payout-review");
  const [buyer, seller, admin] = await Promise.all([
    db.userProfile.create({
      data: {
        clerkUserId: `integration-buyer-${suffix}`,
        email: `buyer-${suffix}@example.test`,
        displayName: "Integration Buyer",
        country: "US",
        role: "buyer",
      },
    }),
    db.userProfile.create({
      data: {
        clerkUserId: `integration-seller-${suffix}`,
        email: `seller-${suffix}@example.test`,
        displayName: "Integration Seller",
        country: "KR",
        role: "seller",
      },
    }),
    db.userProfile.create({
      data: {
        clerkUserId: `integration-admin-${suffix}`,
        email: `admin-${suffix}@example.test`,
        displayName: "Integration Admin",
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
        legalName: `Integration Buyer ${suffix}`,
        tradeName: `Buyer ${suffix}`,
        country: "US",
        businessAddress: "Buyer address",
      },
    }),
    db.company.create({
      data: {
        ownerUserId: seller.id,
        companyRole: "seller",
        legalName: `Integration Seller ${suffix}`,
        tradeName: `Seller ${suffix}`,
        country: "KR",
        businessAddress: "Seller address",
      },
    }),
  ]);
  const product = await db.product.create({
    data: {
      sellerCompanyId: sellerCompany.id,
      name: `Integration Serum ${suffix}`,
      slug: `integration-serum-${suffix}`,
      category: "Beauty",
      shortDescription: "Integration product",
      detailedDescription: "Integration product details",
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
      message: "Integration inquiry",
    },
  });
  const grossAmount = 10_000;
  const platformFeeAmount = 500;
  const partnerReferralAmount = withPartner ? 50 : 0;
  const retained = platformFeeAmount - partnerReferralAmount;
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
      shippingAmount: 0,
      grossAmount,
      platformFeeAmount,
      sellerPayableAmount: grossAmount - platformFeeAmount,
      stripeProcessingFeeAmount: 300,
      currency,
      paymentDueDate: new Date("2026-08-01T00:00:00.000Z"),
      orderTerms: "Integration terms",
      status: withRefund ? "REFUNDED" : withDispute ? "DISPUTED" : "PAID",
      paidAt: new Date("2026-07-20T12:00:00.000Z"),
      refundAmount: withRefund ? grossAmount : 0,
      stripePaymentIntentId: `pi_${suffix}`,
      stripeCheckoutSessionId: `cs_${suffix}`,
      stripeChargeId: `ch_${suffix}`,
    },
  });
  const order = (await db.$transaction((tx) => createTradeOrderForPaymentRequest(tx, paymentRequest.id, paymentRequest.paidAt!))) as { id: string };
  await db.tradeOrder.update({
    where: { id: order.id },
    data: {
      orderStatus: withRefund ? "REFUNDED" : withDispute ? "DISPUTED" : "PAID",
      paymentStatus: withRefund ? "REFUNDED" : withDispute ? "DISPUTED" : "PAID",
      refundAmount: withRefund ? grossAmount : 0,
      paidAt: paymentRequest.paidAt,
    },
  });
  if (withDispute) {
    await db.paymentDispute.create({
      data: {
        paymentRequestId: paymentRequest.id,
        stripeDisputeId: `dp_${suffix}`,
        amount: grossAmount,
        status: "needs_response",
        lastStripeEventCreatedAt: paymentRequest.paidAt!,
        lastStripeEventId: `evt_${suffix}`,
      },
    });
  }
  let partnerProfile: { id: string } | null = null;
  let partnerPayoutProfileId: string | null = null;
  let attributionId: string | null = null;
  if (withPartner) {
    const partnerUser = await db.userProfile.create({
      data: {
        clerkUserId: `integration-partner-${suffix}`,
        email: `partner-${suffix}@example.test`,
        displayName: "Integration Partner",
        country: "US",
        role: "user",
      },
    });
    const partner = await db.partnerProfile.create({
      data: {
        userId: partnerUser.id,
        referralCode: unique("partner-code"),
        displayName: "Integration Partner",
        legalName: "Integration Partner LLC",
        contactEmail: partnerUser.email,
        status: "ACTIVE",
      },
    });
    partnerProfile = partner;
    const attribution = await db.referralAttribution.create({
      data: {
        referredUserId: seller.id,
        partnerProfileId: partner.id,
        referralCode: partner.referralCode,
        lockedAt: paymentRequest.paidAt!,
        status: "LOCKED",
      },
    });
    attributionId = attribution.id;
  }
  const holdUntil = new Date("2026-07-21T12:00:00.000Z");
  const settlement = await db.settlement.create({
    data: {
      paymentRequestId: paymentRequest.id,
      tradeOrderId: order.id,
      referralAttributionId: attributionId,
      referralPartnerProfileId: partnerProfile?.id ?? null,
      referralCodeSnapshot: withPartner ? "integration-code" : null,
      referralSubjectType: withPartner ? "SELLER" : null,
      referredUserIdSnapshot: withPartner ? seller.id : null,
      grossAmount,
      platformFeeAmount,
      sellerPayableAmount: grossAmount - platformFeeAmount,
      partnerReferralAmount,
      trade82RetainedAmountBeforeStripeFees: retained,
      currency,
      paymentFlow,
      holdUntil,
      status,
      idempotencyKey: `integration-settlement-${suffix}`,
      legs: {
        create: [
          {
            type: "SELLER_PAYABLE",
            recipientCompanyId: sellerCompany.id,
            amount: grossAmount - platformFeeAmount,
            currency,
            holdUntil,
            status,
            idempotencyKey: `integration-seller-leg-${suffix}`,
          },
          ...(withPartner && partnerProfile
            ? [{
                type: "PARTNER_REFERRAL" as const,
                recipientUserId: (await db.partnerProfile.findUniqueOrThrow({ where: { id: partnerProfile.id }, select: { userId: true } })).userId,
                partnerProfileId: partnerProfile.id,
                amount: partnerReferralAmount,
                currency,
                holdUntil,
                status,
                idempotencyKey: `integration-partner-leg-${suffix}`,
              }]
            : []),
        ],
      },
    },
    include: { legs: true },
  });
  await db.settlementEvent.create({
    data: {
      settlementId: settlement.id,
      eventType: "CREATED",
      message: "Integration settlement created",
      idempotencyKey: `integration-settlement-event-${suffix}`,
    },
  });
  const sellerProfile = await db.sellerPayoutProfile.create({
    data: {
      companyId: sellerCompany.id,
      country: "KR",
      bankName: "Integration Bank",
      accountHolder: "Integration Seller",
      accountNumberCiphertext: Buffer.from("ciphertext-fixture"),
      accountNumberIv: Buffer.from("iv-fixture"),
      accountNumberAuthTag: Buffer.from("tag-fixture"),
      accountNumberKeyVersion: "integration-test-v1",
      accountNumberLast4: "1234",
      accountNumberMasked: "••••1234",
      payoutCurrency: currency,
      supportedCurrencies: [currency],
      accountBelongsToCompany: true,
      status: "VERIFIED",
      verifiedAt: new Date("2026-07-20T13:00:00.000Z"),
      verifiedByUserId: admin.id,
    },
  });
  const sellerPayout = await db.sellerPayout.create({
    data: {
      orderId: order.id,
      sellerCompanyId: sellerCompany.id,
      payoutProfileId: sellerProfile.id,
      payoutNumber: `SP-${suffix}`,
      status: "READY",
      currency,
      grossAmount,
      platformFeeAmount,
      sellerPayableAmount: grossAmount - platformFeeAmount,
      finalPayoutAmount: grossAmount - platformFeeAmount,
      bankNameSnapshot: "Integration Bank",
      accountNumberLast4: "1234",
      beneficiarySnapshotEncrypted: Buffer.from("encrypted-beneficiary"),
      beneficiarySnapshotIv: Buffer.from("beneficiary-iv"),
      beneficiarySnapshotAuthTag: Buffer.from("beneficiary-tag"),
      beneficiarySnapshotKeyVersion: "integration-test-v1",
      preparedAt: new Date("2026-07-20T13:00:00.000Z"),
      approvedAt: new Date("2026-07-20T14:00:00.000Z"),
    },
  });
  let partnerPayout: { id: string } | null = null;
  if (withPartner && partnerProfile) {
    const bank = await db.bankDirectory.create({
      data: { countryCode: "KR", bankNameLocal: "통합은행", bankNameEnglish: `Integration Bank ${suffix}` },
    });
    const payoutProfile = await db.partnerPayoutProfile.create({
      data: {
        partnerProfileId: partnerProfile.id,
        bankDirectoryId: bank.id,
        country: "KR",
        bankName: "Integration Bank",
        accountHolder: "Integration Partner",
        accountNumberCiphertext: Buffer.from("ciphertext-fixture"),
        accountNumberIv: Buffer.alloc(12, 2),
        accountNumberAuthTag: Buffer.alloc(16, 3),
        accountNumberKeyVersion: "integration-test-v1",
        accountNumberLast4: "5678",
        accountNumberMasked: "•••• 5678",
        accountType: "LOCAL",
        payoutCurrency: "krw",
        supportedCurrencies: ["krw"],
        accountBelongsToPartner: true,
        status: "VERIFIED",
        verifiedAt: new Date("2026-07-20T13:00:00.000Z"),
        verifiedByUserId: admin.id,
      },
    });
    partnerPayoutProfileId = payoutProfile.id;
    const snapshot = encryptPayoutData("01012345678");
    const partnerLeg = settlement.legs.find((leg) => leg.type === "PARTNER_REFERRAL");
    assert.ok(partnerLeg);
    partnerPayout = await db.partnerPayout.create({
      data: {
        settlementId: settlement.id,
        settlementLegId: partnerLeg.id,
        orderId: order.id,
        partnerProfileId: partnerProfile.id,
        payoutProfileId: payoutProfile.id,
        payoutNumber: `PP-${suffix}`,
        status: "READY",
        currency,
        originalCommissionAmount: partnerReferralAmount,
        finalPayoutAmount: partnerReferralAmount,
        holdUntil,
        accountCountrySnapshot: "KR",
        payoutCurrencySnapshot: "krw",
        bankNameSnapshot: "Integration Bank",
        accountHolderSnapshot: "Integration Partner",
        accountNumberSnapshotEncrypted: Buffer.from(snapshot.ciphertext),
        accountNumberSnapshotIv: Buffer.from(snapshot.iv),
        accountNumberSnapshotAuthTag: Buffer.from(snapshot.authTag),
        accountNumberSnapshotKeyVersion: snapshot.keyVersion,
        accountNumberLast4: "5678",
        accountNumberMasked: "••••5678",
        partnerLegalNameSnapshot: "Integration Partner LLC",
        partnerDisplayNameSnapshot: "Integration Partner",
        partnerOrganizationSnapshot: "Integration Partner LLC",
        partnerEmailSnapshot: `partner-${suffix}@example.test`,
        partnerResidenceCountrySnapshot: "US",
        snapshotCapturedAt: new Date("2026-07-20T14:00:00.000Z"),
      },
    });
  }
  if (withRefund) {
    await db.paymentRequest.update({ where: { id: paymentRequest.id }, data: { refundAmount: grossAmount } });
  }
  return { order, paymentRequest, settlement, sellerPayout, partnerPayout, partnerProfileId: partnerProfile?.id ?? null, partnerPayoutProfileId };
}

after(async () => {
  await db.$disconnect();
});

test("lists one transaction with complete masked seller payout details", async () => {
  const fixture = await createFixture();
  const before = await db.sellerPayout.findUniqueOrThrow({ where: { id: fixture.sellerPayout.id } });
  const [transaction] = await listAdminPayoutReviewTransactions(fixture.order.id);
  assert.ok(transaction);
  assert.equal(transaction.orderId, fixture.order.id);
  assert.equal(transaction.transaction.totalBuyerCharge, 10_000);
  assert.equal(transaction.transaction.merchandiseAmount, 10_000);
  assert.equal(transaction.sellerPayout?.accountNumberLast4, "1234");
  assert.equal(transaction.sellerPayout?.accountHolder, "Integration Seller");
  assert.equal(transaction.sellerPayout?.accountCountry, "KR");
  assert.equal(transaction.sellerPayout?.payoutCurrency, "usd");
  assert.equal("beneficiarySnapshotEncrypted" in (transaction.sellerPayout ?? {}), false);
  const afterRecord = await db.sellerPayout.findUniqueOrThrow({ where: { id: fixture.sellerPayout.id } });
  assert.deepEqual(afterRecord, before);
});

test("returns referral allocation and immutable attribution without subtracting Stripe fees", async () => {
  const fixture = await createFixture({ withPartner: true });
  const [transaction] = await listAdminPayoutReviewTransactions(fixture.order.id);
  assert.ok(transaction?.partnerPayout);
  assert.equal(transaction.partnerPayout.attributionId, fixture.settlement.referralAttributionId);
  assert.equal(transaction.reconciliation.buyerTotalCharge, 10_000);
  assert.equal(transaction.reconciliation.sellerPayout, 9_500);
  assert.equal(transaction.reconciliation.partnerCommission, 50);
  assert.equal(transaction.reconciliation.trade82Retained, 450);
  assert.equal(transaction.reconciliation.stripeProcessingFee, 300);
  assert.equal(transaction.reconciliation.grossAllocationDifference, 0);
  assert.equal(transaction.reconciliation.platformFeeAllocationDifference, 0);
  assert.equal(transaction.reconciliation.balanced, true);
});

test("flags a currency mismatch instead of declaring the allocation balanced", async () => {
  const fixture = await createFixture({ currency: "usd" });
  await db.paymentRequest.update({ where: { id: fixture.paymentRequest.id }, data: { currency: "krw" } });
  const [transaction] = await listAdminPayoutReviewTransactions(fixture.order.id);
  assert.ok(transaction);
  assert.equal(transaction.reconciliation.currencyMismatch, true);
  assert.equal(transaction.reconciliation.balanced, false);
});

test("returns refund and dispute warnings without changing financial records", async () => {
  const refundFixture = await createFixture({ withRefund: true });
  const disputeFixture = await createFixture({ withDispute: true });
  const [refund] = await listAdminPayoutReviewTransactions(refundFixture.order.id);
  const [dispute] = await listAdminPayoutReviewTransactions(disputeFixture.order.id);
  assert.ok(refund?.warnings.includes("refund_present"));
  assert.ok(dispute?.warnings.includes("active_dispute"));
  assert.equal(refund?.transaction.refundAmount, 10_000);
  assert.equal(dispute?.payment.status, "DISPUTED");
});

test("keeps Direct Charge visibly separate from legacy SCT", async () => {
  const fixture = await createFixture({ paymentFlow: "DIRECT_CHARGE" });
  const [transaction] = await listAdminPayoutReviewTransactions(fixture.order.id);
  assert.equal(transaction?.transaction.paymentFlow, "DIRECT_CHARGE");
});

test("returns settlement audit events in newest-first order", async () => {
  const fixture = await createFixture();
  await db.settlementEvent.create({
    data: {
      settlementId: fixture.settlement.id,
      eventType: "ADMIN_HELD",
      message: "Integration hold",
      idempotencyKey: unique("audit-event"),
    },
  });
  const [transaction] = await listAdminPayoutReviewTransactions(fixture.order.id);
  assert.equal(transaction?.auditEvents[0]?.eventType, "ADMIN_HELD");
});

test("includes held settlements for review without mutating their status", async () => {
  const fixture = await createFixture({ status: "HOLD" });
  const [transaction] = await listAdminPayoutReviewTransactions(fixture.order.id);
  assert.equal(transaction?.sellerPayout?.status, "READY");
  assert.equal(transaction?.transaction.paymentStatus, "PAID");
  const settlement = await db.settlement.findUniqueOrThrow({ where: { id: fixture.settlement.id }, select: { status: true } });
  assert.equal(settlement.status, "HOLD");
});

test("repeated admin review reads are read-only and return no encrypted fields", async () => {
  const fixture = await createFixture({ withPartner: true });
  const before = await Promise.all([
    db.settlementEvent.count({ where: { settlementId: fixture.settlement.id } }),
    db.partnerPayoutEvent.count({ where: { payoutId: fixture.partnerPayout!.id } }),
    db.partnerPayout.findUniqueOrThrow({ where: { id: fixture.partnerPayout!.id }, select: { updatedAt: true } }),
  ]);
  const first = await listAdminPayoutReviewTransactions(fixture.order.id);
  const second = await listAdminPayoutReviewTransactions(fixture.order.id);
  const serialized = JSON.stringify([first, second]);
  assert.equal(first.length, 1);
  assert.equal(second.length, 1);
  assert.doesNotMatch(serialized, /accountNumberSnapshotEncrypted|accountNumberSnapshotIv|accountNumberSnapshotAuthTag|accountNumberSnapshotKeyVersion/);
  const after = await Promise.all([
    db.settlementEvent.count({ where: { settlementId: fixture.settlement.id } }),
    db.partnerPayoutEvent.count({ where: { payoutId: fixture.partnerPayout!.id } }),
    db.partnerPayout.findUniqueOrThrow({ where: { id: fixture.partnerPayout!.id }, select: { updatedAt: true } }),
  ]);
  assert.deepEqual(after, before);
});

test("suspended partners cannot move a payout to processing or sent", async () => {
  const fixture = await createFixture({ withPartner: true });
  assert.ok(fixture.partnerProfileId);
  await db.partnerProfile.update({ where: { id: fixture.partnerProfileId }, data: { status: "SUSPENDED" } });
  const eventCount = await db.partnerPayoutEvent.count({ where: { payoutId: fixture.partnerPayout!.id } });
  await assert.rejects(
    setPartnerPayoutStatus({ payoutId: fixture.partnerPayout!.id, actorUserId: unique("admin"), status: "PROCESSING" }),
    /eligible|state changed/i,
  );
  await assert.rejects(
    markPartnerPayoutSent({
      payoutId: fixture.partnerPayout!.id,
      actorUserId: unique("admin"),
      externalTransferReference: "wire-suspended",
      confirmation: fixture.partnerPayout!.id,
    }),
    /eligible|state changed/i,
  );
  const [payout, profile, nextEventCount] = await Promise.all([
    db.partnerPayout.findUniqueOrThrow({ where: { id: fixture.partnerPayout!.id }, select: { status: true, sentAt: true } }),
    db.partnerProfile.findUniqueOrThrow({ where: { id: fixture.partnerProfileId }, select: { status: true } }),
    db.partnerPayoutEvent.count({ where: { payoutId: fixture.partnerPayout!.id } }),
  ]);
  assert.equal(payout.status, "READY");
  assert.equal(payout.sentAt, null);
  assert.equal(profile.status, "SUSPENDED");
  assert.equal(nextEventCount, eventCount);
});

test("partner account reveal creates one audited event", async () => {
  const fixture = await createFixture({ withPartner: true });
  const revealed = await revealPartnerPayoutInstructions({
    payoutId: fixture.partnerPayout!.id,
    actorUserId: unique("admin"),
    reason: "Review partner payout instructions",
  });
  assert.equal(revealed.accountNumber, "01012345678");
  assert.equal(
    await db.partnerPayoutEvent.count({ where: { payoutId: fixture.partnerPayout!.id, eventType: "ACCOUNT_REVEALED" } }),
    1,
  );
});
