import assert from "node:assert/strict";
import { test } from "node:test";

import { calculateCumulativeSettlementReversalTargets } from "../src/lib/stripe-connect-settlement-reconciliation.ts";
import {
  executeSettlementReversal,
  isStaleSettlementReversal,
  nextReversalRetryAt,
  sanitizeStripeTransferReversalError,
  settlementReversalIdempotencyKey,
} from "../src/lib/stripe-connect-transfer-reversal-execution.ts";
import { getStripeConnectTransferReversalExecutionMode } from "../src/lib/stripe-connect-transfer-reversal-mode.ts";
import { settlementReversalHttpStatus } from "../src/lib/stripe-connect-transfer-reversal-response.ts";

test("reversal allocation uses immutable original leg amounts and closes rounding at full refund", () => {
  const partial = calculateCumulativeSettlementReversalTargets({
    grossAmount: 11_000,
    currency: "usd",
    hasReferralAttribution: true,
    cumulativeRefundAmount: 2_750,
  });
  const full = calculateCumulativeSettlementReversalTargets({
    grossAmount: 11_000,
    currency: "usd",
    hasReferralAttribution: true,
    cumulativeRefundAmount: 11_000,
  });

  assert.equal(partial.get("SELLER_PAYABLE"), 2_613);
  assert.equal(partial.get("PARTNER_REFERRAL"), 14);
  assert.equal(full.get("SELLER_PAYABLE"), 10_450);
  assert.equal(full.get("PARTNER_REFERRAL"), 55);
});

test("reversal execution is manual-only and fails closed for missing or invalid modes", async () => {
  assert.equal(getStripeConnectTransferReversalExecutionMode({}), "off");
  assert.equal(getStripeConnectTransferReversalExecutionMode({ STRIPE_CONNECT_REVERSAL_EXECUTION_MODE: "auto" }), "off");
  assert.equal(getStripeConnectTransferReversalExecutionMode({ STRIPE_CONNECT_REVERSAL_EXECUTION_MODE: " MANUAL " }), "manual");

  let databaseCalled = false;
  let stripeCalled = false;
  const result = await executeSettlementReversal({
    settlementReversalId: "reversal_off",
    actorUserId: "admin_off",
    mode: "off",
    db: (() => {
      databaseCalled = true;
      throw new Error("database must not be queried while disabled");
    }) as never,
    stripe: {
      transfers: {
        listReversals: async () => {
          stripeCalled = true;
          return { data: [] } as never;
        },
        createReversal: async () => {
          stripeCalled = true;
          throw new Error("Stripe must not be called while disabled");
        },
      },
    } as never,
  });

  assert.equal(result.status, "disabled");
  assert.equal(databaseCalled, false);
  assert.equal(stripeCalled, false);
});

test("reversal idempotency and stale recovery keys are deterministic", () => {
  assert.equal(
    settlementReversalIdempotencyKey("reversal_123"),
    settlementReversalIdempotencyKey("reversal_123"),
  );
  assert.notEqual(
    settlementReversalIdempotencyKey("reversal_123"),
    settlementReversalIdempotencyKey("reversal_456"),
  );

  const now = new Date("2026-07-18T12:00:00.000Z");
  const retryAt = nextReversalRetryAt({ attemptCount: 4, now, retryable: true });
  assert.ok(retryAt && retryAt > now);
  assert.equal(nextReversalRetryAt({ attemptCount: 5, now, retryable: true }), null);
  assert.equal(nextReversalRetryAt({ attemptCount: 5, now, retryable: false }), null);
  assert.equal(isStaleSettlementReversal({
    status: "PENDING",
    reversalAttemptCount: 5,
    reversalLockedAt: new Date("2026-07-18T11:00:00.000Z"),
    nextReversalAttemptAt: new Date("2026-07-18T11:30:00.000Z"),
  }, now), true);
  assert.equal(isStaleSettlementReversal({
    status: "PENDING",
    reversalAttemptCount: 5,
    reversalLockedAt: null,
    nextReversalAttemptAt: null,
    reversalLastError: null,
  }, now), false);
  assert.equal(isStaleSettlementReversal({
    status: "PENDING",
    reversalAttemptCount: 5,
    reversalLockedAt: new Date("2026-07-18T11:55:00.000Z"),
    nextReversalAttemptAt: new Date("2026-07-18T11:30:00.000Z"),
  }, now), false);
  assert.equal(isStaleSettlementReversal({
    status: "PENDING",
    reversalAttemptCount: 1,
    reversalLockedAt: new Date("2026-07-18T11:00:00.000Z"),
    nextReversalAttemptAt: null,
    reversalLastError: null,
  }, now), true);
});

test("reversal errors are reduced to allowlisted, secret-safe classifications", () => {
  const error = sanitizeStripeTransferReversalError({
    type: "api_connection_error",
    code: "balance_insufficient",
    statusCode: 503,
    message: "secret connection string should never be copied",
    requestId: "req_secret",
  });
  assert.deepEqual(error, {
    retryable: true,
    code: "balance_insufficient",
    sanitizedMessage: "retryable:balance_insufficient",
  });
  assert.doesNotMatch(error.sanitizedMessage, /secret|req_/i);
});

test("reversal response statuses keep unsuccessful outcomes non-2xx", () => {
  assert.equal(settlementReversalHttpStatus({ status: "reversed" } as never), 200);
  assert.equal(settlementReversalHttpStatus({ status: "disabled" } as never), 403);
  assert.equal(settlementReversalHttpStatus({ status: "ineligible" } as never), 409);
  assert.equal(settlementReversalHttpStatus({ status: "claim_lost" } as never), 409);
  assert.equal(settlementReversalHttpStatus({ status: "retry_scheduled" } as never), 503);
  assert.equal(settlementReversalHttpStatus({ status: "failed", retryable: true } as never), 502);
  assert.equal(settlementReversalHttpStatus({ status: "failed", retryable: false } as never), 422);
  assert.equal(settlementReversalHttpStatus({ status: "persistence_failed" } as never), 500);
  assert.equal(settlementReversalHttpStatus({ status: "finalization_failed" } as never), 500);
  assert.equal(settlementReversalHttpStatus({ status: "needs_manual_review" } as never), 422);
  assert.equal(settlementReversalHttpStatus({ status: "recovery_pending" } as never), 503);
  assert.equal(settlementReversalHttpStatus({ status: "requeued" } as never), 200);
});
