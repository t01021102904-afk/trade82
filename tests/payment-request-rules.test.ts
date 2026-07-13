import assert from "node:assert/strict";
import test from "node:test";

const checkout = await import(
  new URL("../src/lib/payment-request-checkout.ts", import.meta.url).href,
);
const rules = await import(
  new URL("../src/lib/payment-request-rules.ts", import.meta.url).href,
);
const {
  calculatePaymentAmounts,
  cappedCumulativeRefundAmount,
  checkoutIdempotencyKey,
  isPaymentRequestPayableState,
  parseUsdMinorUnits,
  PaymentRequestValidationError,
  paymentReleaseBlockReason,
  statusAfterClosedDispute,
  statusAfterRefund,
} = rules;
const { claimPaymentRequestCheckout } = checkout;

test("USD parsing accepts cents and rejects malformed numeric input", () => {
  assert.equal(parseUsdMinorUnits("1000.00", "productAmount", 1), 100_000);
  assert.equal(parseUsdMinorUnits("0", "shippingAmount"), 0);
  for (const input of ["1e3", "1,000", "-1", " 1.00", "1.000", ".50", "01.00"]) {
    assert.throws(
      () => parseUsdMinorUnits(input, "amount"),
      PaymentRequestValidationError as typeof Error,
      input,
    );
  }
});

test("five percent fee leaves the seller payable at ninety-five percent", () => {
  assert.deepEqual(calculatePaymentAmounts(100_000, 0), {
    grossAmount: 100_000,
    platformFeeAmount: 5_000,
    sellerPayableAmount: 95_000,
  });
  assert.throws(() => calculatePaymentAmounts(0, 0), PaymentRequestValidationError as typeof Error);
  assert.throws(() => calculatePaymentAmounts(100, -1), PaymentRequestValidationError as typeof Error);
});

test("checkout idempotency keys stay stable for recovery and change for a new attempt", () => {
  assert.equal(
    checkoutIdempotencyKey("payment_123", 1),
    checkoutIdempotencyKey("payment_123", 1),
  );
  assert.notEqual(checkoutIdempotencyKey("payment_123", 1), checkoutIdempotencyKey("payment_123", 2));
});

test("only pending, unexpired payment requests are payable", () => {
  const now = new Date("2026-07-13T12:00:00.000Z");
  assert.equal(isPaymentRequestPayableState("PENDING", new Date(now.getTime() + 1), now.getTime()), true);
  assert.equal(isPaymentRequestPayableState("CANCELLED", new Date(now.getTime() + 1), now.getTime()), false);
  assert.equal(isPaymentRequestPayableState("PENDING", new Date(now.getTime() - 1), now.getTime()), false);
});

test("manual release only permits a clean paid payment", () => {
  assert.equal(
    paymentReleaseBlockReason({
      status: "PAID",
      refundAmount: 0,
      requiresManualReconciliation: false,
      disputeStatuses: [],
    }),
    null,
  );
  assert.equal(
    paymentReleaseBlockReason({
      status: "RELEASED",
      refundAmount: 0,
      requiresManualReconciliation: false,
      disputeStatuses: [],
    }),
    "not_paid",
  );
  assert.equal(
    paymentReleaseBlockReason({
      status: "PAID",
      refundAmount: 1,
      requiresManualReconciliation: false,
      disputeStatuses: [],
    }),
    "refunded",
  );
  assert.equal(
    paymentReleaseBlockReason({
      status: "PAID",
      refundAmount: 0,
      requiresManualReconciliation: false,
      disputeStatuses: ["needs_response"],
    }),
    "active_dispute",
  );
});

test("refund and dispute state calculations cap totals and preserve an external release", () => {
  assert.equal(cappedCumulativeRefundAmount(120_000, 100_000), 100_000);
  assert.equal(statusAfterRefund(20_000, 100_000), "PARTIALLY_REFUNDED");
  assert.equal(statusAfterRefund(100_000, 100_000), "REFUNDED");
  assert.equal(
    statusAfterClosedDispute({
      releasedAt: new Date("2026-07-13T12:00:00.000Z"),
      refundAmount: 0,
      grossAmount: 100_000,
    }),
    "RELEASED",
  );
});

type CheckoutState = {
  checkoutAttempt: number;
  stripeCheckoutSessionId: string | null;
  checkoutLockExpiresAt: Date | null;
};

function createAtomicLocker(state: CheckoutState) {
  const locker = {
    paymentRequest: {
      async updateMany({ where, data }: { where: unknown; data: unknown }) {
        const record = where as Record<string, unknown>;
        const now = ((record.OR as Array<{ checkoutLockExpiresAt?: { lt?: Date } | null }> | undefined)?.[1]
          ?.checkoutLockExpiresAt as { lt?: Date } | undefined)?.lt;
        const lockAvailable =
          state.checkoutLockExpiresAt === null || Boolean(now && state.checkoutLockExpiresAt < now);
        const sessionMatches =
          record.stripeCheckoutSessionId === undefined ||
          record.stripeCheckoutSessionId === state.stripeCheckoutSessionId;
        const attemptRule = record.checkoutAttempt as { gt?: number } | number | undefined;
        const attemptMatches =
          attemptRule === undefined ||
          (typeof attemptRule === "number"
            ? state.checkoutAttempt === attemptRule
            : attemptRule.gt === undefined || state.checkoutAttempt > attemptRule.gt);
        if (!lockAvailable || !sessionMatches || !attemptMatches) return { count: 0 };

        const mutation = data as Record<string, unknown>;
        if (mutation.stripeCheckoutSessionId === null) state.stripeCheckoutSessionId = null;
        const increment = mutation.checkoutAttempt as { increment?: number } | undefined;
        if (increment?.increment) state.checkoutAttempt += increment.increment;
        state.checkoutLockExpiresAt = mutation.checkoutLockExpiresAt as Date;
        return { count: 1 };
      },
    },
  };
  return locker;
}

test("concurrent checkout claims allow exactly one Stripe session attempt", async () => {
  const state: CheckoutState = {
    checkoutAttempt: 0,
    stripeCheckoutSessionId: null,
    checkoutLockExpiresAt: null,
  };
  const now = new Date("2026-07-13T12:00:00.000Z");
  const [first, second] = await Promise.all([
    claimPaymentRequestCheckout({
      locker: createAtomicLocker(state),
      paymentRequestId: "payment_123",
      now,
      checkoutLockToken: "lock_a",
      checkoutLockExpiresAt: new Date(now.getTime() + 120_000),
    }),
    claimPaymentRequestCheckout({
      locker: createAtomicLocker(state),
      paymentRequestId: "payment_123",
      now,
      checkoutLockToken: "lock_b",
      checkoutLockExpiresAt: new Date(now.getTime() + 120_000),
    }),
  ]);
  assert.equal([first, second].filter((result) => result.claimed).length, 1);
  assert.equal(state.checkoutAttempt, 1);
});

test("an ambiguous checkout retry reuses its attempt while an expired session starts a new one", async () => {
  const now = new Date("2026-07-13T12:00:00.000Z");
  const recoverState: CheckoutState = {
    checkoutAttempt: 3,
    stripeCheckoutSessionId: null,
    checkoutLockExpiresAt: new Date(now.getTime() - 1),
  };
  const recovered = await claimPaymentRequestCheckout({
    locker: createAtomicLocker(recoverState),
    paymentRequestId: "payment_123",
    now,
    checkoutLockToken: "lock_recover",
    checkoutLockExpiresAt: new Date(now.getTime() + 120_000),
  });
  assert.equal(recovered.claimed, true);
  assert.equal(recovered.reusedAttempt, true);
  assert.equal(recoverState.checkoutAttempt, 3);

  const expiredState: CheckoutState = {
    checkoutAttempt: 3,
    stripeCheckoutSessionId: "cs_expired",
    checkoutLockExpiresAt: new Date(now.getTime() - 1),
  };
  const replaced = await claimPaymentRequestCheckout({
    locker: createAtomicLocker(expiredState),
    paymentRequestId: "payment_123",
    now,
    checkoutLockToken: "lock_replace",
    checkoutLockExpiresAt: new Date(now.getTime() + 120_000),
    expectedExpiredSessionId: "cs_expired",
  });
  assert.equal(replaced.claimed, true);
  assert.equal(replaced.reusedAttempt, false);
  assert.equal(expiredState.checkoutAttempt, 4);
});
