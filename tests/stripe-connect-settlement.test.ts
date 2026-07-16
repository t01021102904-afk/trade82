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
    trade82NetAmount: 4_500,
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

  assert.equal(financials.sellerPayableAmount + financials.trade82NetAmount, financials.grossAmount);
  assert.equal(financials.partnerReferralAmount, 0);
  assert.equal(financials.trade82NetAmount, financials.platformFeeAmount);
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
});
