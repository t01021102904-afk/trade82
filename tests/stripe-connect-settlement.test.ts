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
  calculateSettlementHoldUntil,
  settlementIdempotencyKey,
  settlementLegIdempotencyKey,
} from "../src/lib/stripe-connect-settlement-rules.ts";

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
  assert.equal(getStripeConnectSettlementMode({ STRIPE_CONNECT_SETTLEMENT_MODE: "on" }), "on");
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

test("settlement creation snapshots only an explicitly selected referral attribution", async () => {
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
