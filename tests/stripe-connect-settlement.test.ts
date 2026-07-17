import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import {
  calculateBasisPointShare,
  calculateStripeConnectSettlementFinancials,
  REFERRAL_PARTNER_SHARE_OF_PLATFORM_FEE_BPS,
} from "../src/lib/stripe-connect-settlement-financials.ts";
import { getStripeConnectSettlementMode } from "../src/lib/stripe-connect-settlement-feature.ts";
import {
  selectLockedReferralAttribution,
} from "../src/lib/stripe-connect-settlement-referral.ts";
import { ReferralSubjectType } from "../src/generated/prisma/client.ts";
import {
  calculateSettlementHoldUntil,
  settlementIdempotencyKey,
  settlementLegIdempotencyKey,
} from "../src/lib/stripe-connect-settlement-rules.ts";
import {
  calculateCumulativeSettlementReversalTargets,
} from "../src/lib/stripe-connect-settlement-reconciliation.ts";
import {
  calculateSettlementLegNetAmount,
  isOpenSettlementDispute,
  isTransferAccountReady,
} from "../src/lib/stripe-connect-settlement-release.ts";
import { getStripeConnectTransferExecutionMode } from "../src/lib/stripe-connect-transfer-execution-mode.ts";
import { StripeConnectedAccountStatus } from "../src/generated/prisma/client.ts";

test("settlement financials preserve the exact 95 / 4.5 / 0.5 gross split", () => {
  const financials = calculateStripeConnectSettlementFinancials({
    grossAmount: 100_000,
    currency: "USD",
    hasReferralAttribution: true,
  });

  assert.deepEqual(financials, {
    grossAmount: 100_000,
    platformFeeAmount: 5_000,
    sellerPayableAmount: 95_000,
    partnerReferralAmount: 500,
    trade82RetainedAmountBeforeStripeFees: 4_500,
    currency: "usd",
  });
  assert.equal(
    calculateBasisPointShare(financials.platformFeeAmount, REFERRAL_PARTNER_SHARE_OF_PLATFORM_FEE_BPS),
    financials.partnerReferralAmount,
  );
});

test("settlement financials omit only the referral leg when no attribution is locked", () => {
  const financials = calculateStripeConnectSettlementFinancials({
    grossAmount: 10_001,
    currency: "usd",
    hasReferralAttribution: false,
  });

  assert.equal(
    financials.sellerPayableAmount + financials.trade82RetainedAmountBeforeStripeFees,
    financials.grossAmount,
  );
  assert.equal(financials.partnerReferralAmount, 0);
  assert.equal(financials.trade82RetainedAmountBeforeStripeFees, financials.platformFeeAmount);
});

test("settlement calculations reject non-USD or non-integer minor units", () => {
  assert.throws(() => calculateStripeConnectSettlementFinancials({
    grossAmount: 100_000.5,
    currency: "usd",
    hasReferralAttribution: false,
  }));
  assert.throws(() => calculateStripeConnectSettlementFinancials({
    grossAmount: 100_000,
    currency: "krw",
    hasReferralAttribution: false,
  }));
});

test("cumulative refund allocation uses the original settlement split without rounding drift", () => {
  const first = calculateCumulativeSettlementReversalTargets({
    grossAmount: 11_000,
    currency: "usd",
    hasReferralAttribution: true,
    cumulativeRefundAmount: 2_750,
  });
  const final = calculateCumulativeSettlementReversalTargets({
    grossAmount: 11_000,
    currency: "usd",
    hasReferralAttribution: true,
    cumulativeRefundAmount: 11_000,
  });

  assert.equal(first.get("SELLER_PAYABLE"), 2_612);
  assert.equal(first.get("PARTNER_REFERRAL"), 14);
  assert.equal(final.get("SELLER_PAYABLE"), 10_450);
  assert.equal(final.get("PARTNER_REFERRAL"), 55);
  assert.throws(() => calculateCumulativeSettlementReversalTargets({
    grossAmount: 11_000,
    currency: "usd",
    hasReferralAttribution: false,
    cumulativeRefundAmount: 0,
  }));
});

test("settlement hold is exactly fourteen days from verified payment confirmation", () => {
  assert.equal(
    calculateSettlementHoldUntil(new Date("2026-07-15T12:00:00.000Z")).toISOString(),
    "2026-07-29T12:00:00.000Z",
  );
});

test("settlement idempotency keys are deterministic per payment request and leg", () => {
  assert.equal(settlementIdempotencyKey("payment_123"), settlementIdempotencyKey("payment_123"));
  assert.notEqual(settlementIdempotencyKey("payment_123"), settlementIdempotencyKey("payment_456"));
  assert.notEqual(
    settlementLegIdempotencyKey("payment_123", "SELLER_PAYABLE"),
    settlementLegIdempotencyKey("payment_123", "PARTNER_REFERRAL"),
  );
});

test("missing and invalid settlement modes fail closed", () => {
  assert.equal(getStripeConnectSettlementMode({}), "off");
  assert.equal(getStripeConnectSettlementMode({ STRIPE_CONNECT_SETTLEMENT_MODE: "unexpected" }), "off");
  assert.equal(getStripeConnectSettlementMode({ STRIPE_CONNECT_SETTLEMENT_MODE: "ON" }), "off");
  assert.equal(getStripeConnectSettlementMode({ STRIPE_CONNECT_SETTLEMENT_MODE: " on " }), "off");
  assert.equal(getStripeConnectSettlementMode({ STRIPE_CONNECT_SETTLEMENT_MODE: "on" }), "on");
});

test("transfer execution mode defaults to off and only accepts explicit manual or auto modes", () => {
  assert.equal(getStripeConnectTransferExecutionMode({}), "off");
  assert.equal(getStripeConnectTransferExecutionMode({ STRIPE_CONNECT_TRANSFER_EXECUTION_MODE: "invalid" }), "off");
  assert.equal(getStripeConnectTransferExecutionMode({ STRIPE_CONNECT_TRANSFER_EXECUTION_MODE: " MANUAL " }), "manual");
  assert.equal(getStripeConnectTransferExecutionMode({ STRIPE_CONNECT_TRANSFER_EXECUTION_MODE: "auto" }), "auto");
});

test("release eligibility requires an enabled transfer account and uses reversal-adjusted net amounts", () => {
  assert.equal(isTransferAccountReady(null), false);
  assert.equal(isTransferAccountReady({
    status: StripeConnectedAccountStatus.RESTRICTED,
    payoutsEnabled: true,
    transfersEnabled: true,
  }), false);
  assert.equal(isTransferAccountReady({
    status: StripeConnectedAccountStatus.ENABLED,
    payoutsEnabled: false,
    transfersEnabled: true,
  }), false);
  assert.equal(isTransferAccountReady({
    status: StripeConnectedAccountStatus.ENABLED,
    payoutsEnabled: true,
    transfersEnabled: true,
  }), true);
  assert.equal(calculateSettlementLegNetAmount({ amount: 9_500, reversalAmounts: [1_000, 500] }), 8_000);
  assert.equal(calculateSettlementLegNetAmount({ amount: 500, reversalAmounts: [800] }), 0);
  assert.equal(isOpenSettlementDispute("needs_response"), true);
  assert.equal(isOpenSettlementDispute("won"), false);
});

test("settlement referral selection uses the earliest lock then a stable attribution ID", () => {
  const buyer = {
    id: "attribution-buyer",
    referredUserId: "buyer-user",
    lockedAt: new Date("2026-07-16T10:00:00.000Z"),
    subjectType: ReferralSubjectType.BUYER,
  };
  const seller = {
    id: "attribution-seller",
    referredUserId: "seller-user",
    lockedAt: new Date("2026-07-16T09:00:00.000Z"),
    subjectType: ReferralSubjectType.SELLER,
  };
  assert.deepEqual(selectLockedReferralAttribution([buyer, seller]), seller);

  const laterId = { ...buyer, id: "z-attribution", lockedAt: seller.lockedAt };
  const earlierId = { ...seller, id: "a-attribution" };
  assert.deepEqual(selectLockedReferralAttribution([laterId, earlierId]), earlierId);
  assert.equal(selectLockedReferralAttribution([]), null);
});

test("the additive migration creates a restricted ledger without Stripe transfer operations", async () => {
  const migration = await readFile(
    new URL("../prisma/migrations/20260715090000_add_stripe_connect_settlement_ledger/migration.sql", import.meta.url),
    "utf8",
  );
  for (const table of [
    "PartnerProfile",
    "ReferralAttribution",
    "StripeConnectedAccount",
    "Settlement",
    "SettlementLeg",
    "SettlementEvent",
    "SettlementReversal",
  ]) {
    assert.match(migration, new RegExp(`CREATE TABLE \\"${table}\\"`));
    assert.match(migration, new RegExp(`ALTER TABLE \\"${table}\\" ENABLE ROW LEVEL SECURITY`));
    assert.match(migration, new RegExp(`REVOKE ALL PRIVILEGES ON TABLE \\"${table}\\" FROM anon, authenticated`));
  }
  assert.doesNotMatch(migration, /^\s*(DROP|DELETE FROM|TRUNCATE)\b/m);
  assert.doesNotMatch(migration, /stripe\.transfers/i);
  assert.match(migration, /"PartnerProfile_userId_fkey"/);
  assert.match(migration, /"ReferralAttribution_referredUserId_fkey"/);
  assert.match(migration, /"StripeConnectedAccount_owner_xor_check"/);
  assert.match(migration, /"Settlement_amount_currency_check"/);
  assert.match(migration, /"SettlementLeg_amount_currency_recipient_check"/);
  assert.match(migration, /"SettlementReversal_stripeRefundId_settlementLegId_key"/);
  assert.match(migration, /"stripeTransferReversalId"/);
  assert.match(migration, /CREATE TYPE "ReferralSubjectType" AS ENUM \('BUYER', 'SELLER'\)/);
  assert.match(migration, /"SettlementLeg_settlementId_id_key"/);
  assert.match(migration, /"SettlementReversal_settlementId_settlementLegId_fkey"/);
  assert.match(migration, /"SettlementReversal_transferable_leg_trigger"/);
  assert.match(migration, /"settlementLegId" TEXT NOT NULL/);
});

test("the settlement reversal hardening migration fixes the trigger search path and adds the composite foreign key index", async () => {
  const migration = await readFile(
    new URL("../prisma/migrations/20260715110000_harden_settlement_reversal_function_and_index/migration.sql", import.meta.url),
    "utf8",
  );

  assert.match(
    migration,
    /ALTER FUNCTION public\."checkSettlementReversalLeg"\(\) SET search_path = pg_catalog, public;/,
  );
  assert.match(
    migration,
    /CREATE INDEX "SettlementReversal_settlementId_settlementLegId_idx"\s+ON "SettlementReversal"\("settlementId", "settlementLegId"\);/,
  );
  assert.doesNotMatch(migration, /(^|\n)\s*(DROP|TRUNCATE|DELETE)\b/im);
});

test("the reconciliation migration adds pending reversal states and auditable refund and dispute events", async () => {
  const migration = await readFile(
    new URL("../prisma/migrations/20260716120000_add_settlement_refund_dispute_reconciliation/migration.sql", import.meta.url),
    "utf8",
  );

  for (const value of [
    "REVERSAL_PENDING",
    "REFUND_RECONCILIATION_STARTED",
    "PARTIAL_REFUND_RECONCILED",
    "FULL_REFUND_CANCELLED",
    "DISPUTE_OPENED",
    "DISPUTE_UPDATED",
    "DISPUTE_WON",
    "DISPUTE_LOST",
    "POST_TRANSFER_REVERSAL_REQUIRED",
  ]) {
    assert.match(migration, new RegExp(`ADD VALUE IF NOT EXISTS '${value}'`));
  }
  assert.match(
    migration,
    /CREATE TYPE "SettlementReversalStatus" AS ENUM \('ACCOUNTING_APPLIED', 'PENDING', 'COMPLETED'\)/,
  );
  assert.match(migration, /ADD COLUMN "stripeDisputeId" TEXT/);
  assert.match(migration, /ADD COLUMN "lastStripeEventCreatedAt" TIMESTAMP\(3\)/);
  assert.match(migration, /ADD COLUMN "lastStripeEventId" TEXT/);
  assert.match(migration, /SET\s+"lastStripeEventCreatedAt" = "createdAt"/);
  assert.match(migration, /"lastStripeEventId" = "stripeDisputeId"/);
  assert.match(migration, /ALTER COLUMN "lastStripeEventCreatedAt" SET NOT NULL/);
  assert.match(migration, /ALTER COLUMN "lastStripeEventId" SET NOT NULL/);
  assert.match(migration, /ALTER TABLE "PaymentRefund"[\s\S]*ADD COLUMN "lastStripeEventCreatedAt" TIMESTAMP\(3\)/);
  assert.match(migration, /UPDATE "PaymentRefund"[\s\S]*"lastStripeEventId" = "stripeRefundId"/);
  assert.match(migration, /ALTER TABLE "PaymentRefund"[\s\S]*ALTER COLUMN "lastStripeEventCreatedAt" SET NOT NULL/);
  assert.match(migration, /ALTER TABLE "PaymentRefund"[\s\S]*ALTER COLUMN "lastStripeEventId" SET NOT NULL/);
  assert.match(migration, /SettlementReversal_stripeTransferReversalId_status_check/);
  assert.match(migration, /SettlementReversal_stripeDisputeId_settlementLegId_key/);
  assert.doesNotMatch(migration, /(^|\n)\s*(DROP|TRUNCATE|DELETE)\b/im);
});

test("the release and approval migration adds only ledger metadata and no transfer execution", async () => {
  const migration = await readFile(
    new URL("../prisma/migrations/20260717120000_add_settlement_release_approval/migration.sql", import.meta.url),
    "utf8",
  );
  for (const value of ["ADMIN_APPROVED", "ADMIN_HELD", "ADMIN_REEVALUATED"]) {
    assert.match(migration, new RegExp(`ADD VALUE IF NOT EXISTS '${value}'`));
  }
  for (const column of [
    "approvedAt",
    "approvedByUserId",
    "holdReason",
    "transferAttemptCount",
    "nextTransferAttemptAt",
    "transferLastError",
    "transferLockedAt",
    "transferredAt",
    "reversalAttemptCount",
    "nextReversalAttemptAt",
    "reversalLastError",
    "reversalLockedAt",
    "completedAt",
  ]) {
    assert.match(migration, new RegExp(`ADD COLUMN "${column}"`));
  }
  assert.match(migration, /SettlementLeg_status_holdUntil_idx/);
  assert.match(migration, /SettlementLeg_status_nextTransferAttemptAt_idx/);
  assert.match(migration, /SettlementReversal_status_nextReversalAttemptAt_idx/);
  assert.doesNotMatch(migration, /(^|\n)\s*(DROP|TRUNCATE|DELETE)\b/im);
  assert.doesNotMatch(migration, /stripe\.transfers|createReversal|stripe\.payouts/i);
});

test("settlement creation snapshots a validated referral attribution", async () => {
  const service = await readFile(
    new URL("../src/lib/stripe-connect-settlements.ts", import.meta.url),
    "utf8",
  );

  assert.match(service, /referralAttributionId\?: string \| null/);
  assert.match(service, /where: \{ id: referralAttributionId \}/);
  assert.match(service, /referralPartnerProfileId: attribution!\.partnerProfileId/);
  assert.match(service, /buyerCompany: \{ select: \{ ownerUserId: true \} \}/);
  assert.match(service, /sellerCompany: \{ select: \{ ownerUserId: true \} \}/);
  assert.match(service, /const refersBuyer = attribution\.referredUserId === paymentRequest\.buyerCompany\.ownerUserId/);
  assert.match(service, /const refersSeller = attribution\.referredUserId === paymentRequest\.sellerCompany\.ownerUserId/);
  assert.match(service, /referralSubjectType = refersBuyer \? ReferralSubjectType\.BUYER : ReferralSubjectType\.SELLER/);
  assert.match(service, /referredUserIdSnapshot: attribution!\.referredUserId/);
  assert.doesNotMatch(service, /referredCompanyId/);
});

test("settlement ledger code has no Stripe money-movement API dependency", async () => {
  const [webhookRoute, settlementService, settlementBridge, reconciliationService, releaseService] = await Promise.all([
    readFile(new URL("../src/app/api/stripe/webhook/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/stripe-connect-settlements.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/stripe-connect-settlement-webhook.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/stripe-connect-settlement-reconciliation.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/stripe-connect-settlement-release.ts", import.meta.url), "utf8"),
  ]);

  for (const source of [webhookRoute, settlementService, settlementBridge, reconciliationService, releaseService]) {
    assert.doesNotMatch(
      source,
      /\.transfers\.(create|createReversal)|\.accounts\.create|accountLinks\.create|\.payouts\.create/,
    );
  }
});
