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
import {
  executeSettlementLegTransfer,
  isActivelyTransferLocked,
  nextTransferRetryAt,
  sanitizeStripeTransferError,
  settlementTransferIdempotencyKey,
  validateClaimedTransferLeg,
} from "../src/lib/stripe-connect-transfer-execution.ts";
import {
  PaymentRequestStatus,
  SettlementEventType,
  SettlementLegStatus,
  SettlementLegType,
  SettlementStatus,
  StripeConnectedAccountStatus,
} from "../src/generated/prisma/client.ts";

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

test("transfer execution mode defaults to off and only accepts explicit manual mode", () => {
  assert.equal(getStripeConnectTransferExecutionMode({}), "off");
  assert.equal(getStripeConnectTransferExecutionMode({ STRIPE_CONNECT_TRANSFER_EXECUTION_MODE: "invalid" }), "off");
  assert.equal(getStripeConnectTransferExecutionMode({ STRIPE_CONNECT_TRANSFER_EXECUTION_MODE: " MANUAL " }), "manual");
  assert.equal(getStripeConnectTransferExecutionMode({ STRIPE_CONNECT_TRANSFER_EXECUTION_MODE: "auto" }), "off");
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

function claimedTransferLeg(overrides: Partial<Parameters<typeof validateClaimedTransferLeg>[0]> = {}) {
  const now = new Date("2026-08-01T12:00:00.000Z");
  return {
    id: "leg_123",
    settlementId: "settlement_123",
    type: SettlementLegType.SELLER_PAYABLE,
    amount: 9_500,
    currency: "usd",
    holdUntil: new Date("2026-07-31T12:00:00.000Z"),
    status: SettlementLegStatus.TRANSFER_PENDING,
    idempotencyKey: "leg-key",
    stripeTransferId: null,
    transferAttemptCount: 1,
    nextTransferAttemptAt: null,
    transferLastError: null,
    transferLockedAt: now,
    transferredAt: null,
    createdAt: now,
    updatedAt: now,
    recipientCompanyId: "seller-company",
    recipientUserId: null,
    partnerProfileId: null,
    settlement: {
      id: "settlement_123",
      status: SettlementStatus.READY,
      approvedAt: now,
      holdReason: null,
      tradeOrderId: "order_123",
      paymentRequest: {
        id: "payment_123",
        status: PaymentRequestStatus.PAID,
        stripeChargeId: "ch_123",
        requiresManualReconciliation: false,
      },
    },
    recipientCompany: {
      stripeConnectedAccount: {
        stripeAccountId: "acct_seller",
        status: StripeConnectedAccountStatus.ENABLED,
        payoutsEnabled: true,
        transfersEnabled: true,
      },
    },
    partnerProfile: null,
    ...overrides,
  } as Parameters<typeof validateClaimedTransferLeg>[0];
}

test("manual transfer eligibility requires approval, expired hold, charge evidence, and transfer-capable destination", () => {
  const now = new Date("2026-08-01T12:00:00.000Z");
  assert.equal(validateClaimedTransferLeg(claimedTransferLeg(), now), null);
  assert.equal(validateClaimedTransferLeg(claimedTransferLeg({
    settlement: { ...claimedTransferLeg().settlement, approvedAt: null },
  }), now), "not_approved");
  assert.equal(validateClaimedTransferLeg(claimedTransferLeg({
    holdUntil: new Date("2026-08-02T12:00:00.000Z"),
  }), now), "hold_not_expired");
  assert.equal(validateClaimedTransferLeg(claimedTransferLeg({
    settlement: {
      ...claimedTransferLeg().settlement,
      paymentRequest: { ...claimedTransferLeg().settlement.paymentRequest, stripeChargeId: null },
    },
  }), now), "missing_source_charge");
  assert.equal(validateClaimedTransferLeg(claimedTransferLeg({
    recipientCompany: {
      stripeConnectedAccount: {
        stripeAccountId: "acct_seller",
        status: StripeConnectedAccountStatus.RESTRICTED,
        payoutsEnabled: true,
        transfersEnabled: true,
      },
    },
  }), now), "destination_not_transfer_capable");
  assert.equal(validateClaimedTransferLeg(claimedTransferLeg({
    settlement: { ...claimedTransferLeg().settlement, status: SettlementStatus.HOLD },
  }), now), "settlement_not_ready");
});

test("partner transfer eligibility uses partner connected accounts independently", () => {
  const now = new Date("2026-08-01T12:00:00.000Z");
  assert.equal(validateClaimedTransferLeg(claimedTransferLeg({
    type: SettlementLegType.PARTNER_REFERRAL,
    recipientCompany: null,
    partnerProfileId: "partner_123",
    partnerProfile: {
      stripeConnectedAccount: {
        stripeAccountId: "acct_partner",
        status: StripeConnectedAccountStatus.ENABLED,
        payoutsEnabled: true,
        transfersEnabled: true,
      },
    },
  }), now), null);
  assert.equal(validateClaimedTransferLeg(claimedTransferLeg({
    type: SettlementLegType.PARTNER_REFERRAL,
    recipientCompany: null,
    partnerProfileId: "partner_123",
    partnerProfile: {
      stripeConnectedAccount: {
        stripeAccountId: "acct_partner",
        status: StripeConnectedAccountStatus.ENABLED,
        payoutsEnabled: false,
        transfersEnabled: true,
      },
    },
  }), now), "destination_not_transfer_capable");
});

function readyTransferLeg(overrides: Partial<Parameters<typeof validateClaimedTransferLeg>[0]> = {}) {
  return claimedTransferLeg({
    status: SettlementLegStatus.READY,
    transferAttemptCount: 0,
    transferLockedAt: null,
    ...overrides,
  });
}

function createTransferExecutionDb(initialLeg: Parameters<typeof validateClaimedTransferLeg>[0]) {
  let leg = structuredClone(initialLeg) as Parameters<typeof validateClaimedTransferLeg>[0];
  const events: Array<{ data: Record<string, unknown> }> = [];
  const settlementUpdates: Array<Record<string, unknown>> = [];

  const tx = {
    settlementLeg: {
      updateMany: async () => {
        if (
          leg.status !== SettlementLegStatus.READY ||
          leg.stripeTransferId ||
          leg.transferredAt ||
          leg.transferAttemptCount >= 5
        ) {
          return { count: 0 };
        }
        leg = {
          ...leg,
          status: SettlementLegStatus.TRANSFER_PENDING,
          transferAttemptCount: leg.transferAttemptCount + 1,
          transferLockedAt: new Date("2026-08-01T12:00:00.000Z"),
          transferLastError: null,
        };
        return { count: 1 };
      },
      findUniqueOrThrow: async () => leg,
      update: async ({ data }: { data: Record<string, unknown> }) => {
        leg = { ...leg, ...data };
        return leg;
      },
      findMany: async () => [{ status: leg.status }],
    },
    settlementEvent: {
      findUnique: async ({ where }: { where: { idempotencyKey: string } }) => (
        events.some((event) => event.data.idempotencyKey === where.idempotencyKey)
          ? { id: "existing-event" }
          : null
      ),
      create: async ({ data }: { data: Record<string, unknown> }) => {
        events.push({ data });
        return data;
      },
    },
    settlement: {
      update: async ({ data }: { data: Record<string, unknown> }) => {
        settlementUpdates.push(data);
        leg = {
          ...leg,
          settlement: {
            ...leg.settlement,
            ...(typeof data.status === "string" ? { status: data.status as SettlementStatus } : {}),
          },
        };
        return leg.settlement;
      },
    },
  };

  return {
    db: {
      $transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
    },
    events,
    settlementUpdates,
    getLeg: () => leg,
  };
}

test("manual seller transfer success claims once, sends source transaction, and persists completion", async () => {
  const state = createTransferExecutionDb(readyTransferLeg());
  const stripeCalls: Array<{ params: Record<string, unknown>; options: Record<string, unknown> }> = [];
  const result = await executeSettlementLegTransfer({
    settlementLegId: "leg_123",
    actorUserId: "admin_123",
    mode: "manual",
    db: state.db as never,
    stripe: {
      transfers: {
        create: async (params: Record<string, unknown>, options: Record<string, unknown>) => {
          stripeCalls.push({ params, options });
          return { id: "tr_seller_123" };
        },
      },
    } as never,
    now: new Date("2026-08-01T12:00:00.000Z"),
  });

  assert.equal(result.status, "transferred");
  assert.equal(result.stripeTransferId, "tr_seller_123");
  assert.equal(stripeCalls.length, 1);
  assert.deepEqual(stripeCalls[0]?.params, {
    amount: 9_500,
    currency: "usd",
    destination: "acct_seller",
    source_transaction: "ch_123",
    metadata: {
      settlementId: "settlement_123",
      settlementLegId: "leg_123",
      paymentRequestId: "payment_123",
      tradeOrderId: "order_123",
      legType: "SELLER_PAYABLE",
    },
  });
  assert.deepEqual(stripeCalls[0]?.options, {
    idempotencyKey: settlementTransferIdempotencyKey("leg_123"),
  });
  assert.equal(state.getLeg().status, SettlementLegStatus.TRANSFERRED);
  assert.equal(state.getLeg().stripeTransferId, "tr_seller_123");
  assert.equal(state.getLeg().transferAttemptCount, 1);
  assert.equal(state.getLeg().transferLockedAt, null);
  assert.equal(state.getLeg().transferLastError, null);
  assert.equal(state.events.some((event) => event.data.eventType === SettlementEventType.TRANSFER_PENDING), true);
  assert.equal(state.events.some((event) => event.data.eventType === SettlementEventType.TRANSFERRED), true);
});

test("manual partner transfer success uses the partner connected account", async () => {
  const state = createTransferExecutionDb(readyTransferLeg({
    type: SettlementLegType.PARTNER_REFERRAL,
    amount: 500,
    recipientCompanyId: null,
    recipientCompany: null,
    partnerProfileId: "partner_123",
    partnerProfile: {
      stripeConnectedAccount: {
        stripeAccountId: "acct_partner",
        status: StripeConnectedAccountStatus.ENABLED,
        payoutsEnabled: true,
        transfersEnabled: true,
      },
    },
  }));
  const destinations: string[] = [];

  const result = await executeSettlementLegTransfer({
    settlementLegId: "leg_123",
    actorUserId: "admin_123",
    mode: "manual",
    db: state.db as never,
    stripe: {
      transfers: {
        create: async (params: Record<string, unknown>) => {
          destinations.push(String(params.destination));
          return { id: "tr_partner_123" };
        },
      },
    } as never,
    now: new Date("2026-08-01T12:00:00.000Z"),
  });

  assert.equal(result.status, "transferred");
  assert.deepEqual(destinations, ["acct_partner"]);
  assert.equal(state.getLeg().stripeTransferId, "tr_partner_123");
});

test("manual transfer rejects duplicate and not-approved claims before Stripe is called", async () => {
  const alreadyTransferred = createTransferExecutionDb(readyTransferLeg({
    stripeTransferId: "tr_existing",
    transferredAt: new Date("2026-08-01T12:00:00.000Z"),
  }));
  let stripeCallCount = 0;
  const duplicate = await executeSettlementLegTransfer({
    settlementLegId: "leg_123",
    actorUserId: "admin_123",
    mode: "manual",
    db: alreadyTransferred.db as never,
    stripe: {
      transfers: {
        create: async () => {
          stripeCallCount += 1;
          return { id: "tr_should_not_create" };
        },
      },
    } as never,
  });
  assert.equal(duplicate.status, "ineligible");
  assert.equal(duplicate.errorCode, "not_claimable");

  const notApproved = createTransferExecutionDb(readyTransferLeg({
    settlement: { ...readyTransferLeg().settlement, approvedAt: null },
  }));
  const rejected = await executeSettlementLegTransfer({
    settlementLegId: "leg_123",
    actorUserId: "admin_123",
    mode: "manual",
    db: notApproved.db as never,
    stripe: {
      transfers: {
        create: async () => {
          stripeCallCount += 1;
          return { id: "tr_should_not_create" };
        },
      },
    } as never,
    now: new Date("2026-08-01T12:00:00.000Z"),
  });
  assert.equal(rejected.status, "failed");
  assert.equal(rejected.errorCode, "not_approved");
  assert.equal(stripeCallCount, 0);
});

test("manual transfer schedules retryable failures and keeps permanent failures unscheduled", async () => {
  const retryableState = createTransferExecutionDb(readyTransferLeg());
  const retryable = await executeSettlementLegTransfer({
    settlementLegId: "leg_123",
    actorUserId: "admin_123",
    mode: "manual",
    db: retryableState.db as never,
    stripe: {
      transfers: {
        create: async () => {
          throw { type: "api_connection_error", code: "rate_limit", message: "hidden" };
        },
      },
    } as never,
    now: new Date("2026-08-01T12:00:00.000Z"),
  });
  assert.equal(retryable.status, "retry_scheduled");
  assert.equal(retryable.errorCode, "rate_limit");
  assert.equal(retryable.nextTransferAttemptAt, "2026-08-01T12:15:00.000Z");
  assert.equal(retryableState.getLeg().status, SettlementLegStatus.READY);
  assert.equal(retryableState.getLeg().transferLockedAt, null);
  assert.equal(retryableState.getLeg().transferLastError, "retryable:rate_limit");

  const permanentState = createTransferExecutionDb(readyTransferLeg());
  const permanent = await executeSettlementLegTransfer({
    settlementLegId: "leg_123",
    actorUserId: "admin_123",
    mode: "manual",
    db: permanentState.db as never,
    stripe: {
      transfers: {
        create: async () => {
          throw { type: "invalid_request_error", code: "account_invalid", message: "hidden" };
        },
      },
    } as never,
    now: new Date("2026-08-01T12:00:00.000Z"),
  });
  assert.equal(permanent.status, "failed");
  assert.equal(permanent.errorCode, "account_invalid");
  assert.equal(permanent.nextTransferAttemptAt, null);
  assert.equal(permanentState.getLeg().transferLastError, "permanent:account_invalid");
});

test("manual transfer retry and lock rules are bounded and deterministic", () => {
  const now = new Date("2026-08-01T12:00:00.000Z");
  assert.equal(isActivelyTransferLocked(new Date("2026-08-01T11:55:00.000Z"), now), true);
  assert.equal(isActivelyTransferLocked(new Date("2026-08-01T11:40:00.000Z"), now), false);
  assert.equal(nextTransferRetryAt({ attemptCount: 1, now, retryable: true })?.toISOString(), "2026-08-01T12:15:00.000Z");
  assert.equal(nextTransferRetryAt({ attemptCount: 5, now, retryable: true }), null);
  assert.equal(nextTransferRetryAt({ attemptCount: 1, now, retryable: false }), null);
  assert.equal(settlementTransferIdempotencyKey("leg_123"), settlementTransferIdempotencyKey("leg_123"));
  assert.notEqual(settlementTransferIdempotencyKey("leg_123"), settlementTransferIdempotencyKey("leg_456"));
});

test("Stripe transfer errors are sanitized and classified without raw messages", () => {
  const retryable = sanitizeStripeTransferError({
    type: "api_connection_error",
    code: "rate_limit",
    message: "contains remote details",
  });
  assert.deepEqual(retryable, {
    retryable: true,
    code: "rate_limit",
    sanitizedMessage: "retryable:rate_limit",
  });

  const permanent = sanitizeStripeTransferError({
    type: "invalid_request_error",
    code: "resource_missing",
    message: "No such charge: ch_secret",
  });
  assert.deepEqual(permanent, {
    retryable: false,
    code: "resource_missing",
    sanitizedMessage: "permanent:resource_missing",
  });

  const unknown = sanitizeStripeTransferError({
    type: "invalid_request_error",
    code: "unexpected_raw_code",
    message: "must not leak",
  });
  assert.equal(unknown.sanitizedMessage, "permanent:stripe_transfer_failed");
  assert.doesNotMatch(unknown.sanitizedMessage, /must not leak|unexpected_raw_code/);
});

test("off mode returns before database or Stripe clients are touched", async () => {
  const result = await executeSettlementLegTransfer({
    settlementLegId: "leg_123",
    actorUserId: "admin_123",
    mode: "off",
    db: {
      $transaction: () => {
        throw new Error("database must not be touched");
      },
    } as never,
    stripe: {
      transfers: {
        create: () => {
          throw new Error("Stripe must not be touched");
        },
      },
    } as never,
  });
  assert.deepEqual(result, {
    ok: false,
    settlementLegId: "leg_123",
    status: "disabled",
    retryable: false,
    errorCode: "transfer_execution_disabled",
  });
});

test("manual transfer endpoint requires same-origin admin authorization and returns sanitized payloads", async () => {
  const route = await readFile(
    new URL("../src/app/api/admin/settlements/legs/[id]/transfer/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(route, /assertSameOrigin\(request\)/);
  assert.match(route, /requireAdmin\(\)/);
  assert.match(route, /executeSettlementLegTransfer/);
  assert.match(route, /status === "disabled"[\s\S]*403/);
  assert.match(route, /status === "ineligible"[\s\S]*409/);
  assert.doesNotMatch(route, /error\.message|error\.stack|console\.(error|log)/);
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
