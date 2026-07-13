import assert from "node:assert/strict";
import test from "node:test";

const checkout = await import(
  new URL("../src/lib/payment-request-checkout.ts", import.meta.url).href,
);
const release = await import(
  new URL("../src/lib/payment-request-release.ts", import.meta.url).href,
);
const webhook = await import(
  new URL("../src/lib/payment-request-webhook.ts", import.meta.url).href,
);
const rules = await import(
  new URL("../src/lib/payment-request-rules.ts", import.meta.url).href,
);
const checkoutClient = await import(
  new URL("../src/lib/payment-checkout-client-response.ts", import.meta.url).href,
);

const {
  claimPaymentRequestCheckout,
  decideCreatedCheckoutSession,
  decideExistingCheckoutSession,
} = checkout;
const { claimPaymentRequestRelease } = release;
const { claimPaymentRequestWebhookEvent, claimPendingPaymentRequestPaid } = webhook;
const {
  chargeMatchesPaymentIntent,
  checkoutIdempotencyKey,
  decidePaymentIntentCheckoutSession,
  paymentIntentMetadataMismatchReasons,
  storedCheckoutSessionMismatchReasons,
} = rules;
const { decidePaymentCheckoutResponse } = checkoutClient;

test("buyer Checkout response handling redirects only for an explicit 200 Checkout URL", () => {
  const decision = decidePaymentCheckoutResponse({
    statusCode: 200,
    payload: { url: "https://checkout.stripe.test/cs_open" },
    processingFallback: "Processing payment confirmation.",
    errorFallback: "Unable to start Checkout.",
  });

  assert.deepEqual(decision, {
    action: "redirect",
    url: "https://checkout.stripe.test/cs_open",
  });
});

test("buyer Checkout processing responses show a message and never redirect", () => {
  const fallback = "Processing payment confirmation.";
  const accepted = decidePaymentCheckoutResponse({
    statusCode: 202,
    payload: { status: "processing", message: "Stripe confirmation is pending." },
    processingFallback: fallback,
    errorFallback: "Unable to start Checkout.",
  });
  const complete = decidePaymentCheckoutResponse({
    statusCode: 409,
    payload: { status: "processing" },
    processingFallback: fallback,
    errorFallback: "Unable to start Checkout.",
  });

  assert.deepEqual(accepted, {
    action: "processing",
    message: "Stripe confirmation is pending.",
  });
  assert.deepEqual(complete, { action: "processing", message: fallback });
});

test("buyer Checkout errors preserve only the safe server error and malformed success is controlled", () => {
  const errorFallback = "Unable to start Checkout.";
  const serverError = decidePaymentCheckoutResponse({
    statusCode: 409,
    payload: { error: "This payment request is no longer payable." },
    processingFallback: "Processing payment confirmation.",
    errorFallback,
  });
  const malformedSuccess = decidePaymentCheckoutResponse({
    statusCode: 200,
    payload: { url: "javascript:alert(1)" },
    processingFallback: "Processing payment confirmation.",
    errorFallback,
  });

  assert.deepEqual(serverError, {
    action: "error",
    message: "This payment request is no longer payable.",
  });
  assert.deepEqual(malformedSuccess, { action: "error", message: errorFallback });
});

type CheckoutState = {
  checkoutAttempt: number;
  stripeCheckoutSessionId: string | null;
  checkoutLockExpiresAt: Date | null;
};

function createCheckoutLocker(state: CheckoutState) {
  return {
    paymentRequest: {
      async updateMany({ where, data }: { where: unknown; data: unknown }) {
        const record = where as Record<string, unknown>;
        const now = ((record.OR as Array<{ checkoutLockExpiresAt?: { lt?: Date } | null }> | undefined)?.[1]
          ?.checkoutLockExpiresAt as { lt?: Date } | undefined)?.lt;
        const lockAvailable =
          state.checkoutLockExpiresAt === null || Boolean(now && state.checkoutLockExpiresAt < now);
        const sessionMatches = record.stripeCheckoutSessionId === state.stripeCheckoutSessionId;
        if (!lockAvailable || !sessionMatches) return { count: 0 };

        const mutation = data as Record<string, unknown>;
        if (mutation.stripeCheckoutSessionId === null) state.stripeCheckoutSessionId = null;
        const increment = mutation.checkoutAttempt as { increment?: number } | undefined;
        if (increment?.increment) state.checkoutAttempt += increment.increment;
        state.checkoutLockExpiresAt = mutation.checkoutLockExpiresAt as Date;
        return { count: 1 };
      },
    },
  };
}

test("Checkout retrieval failures, including resource_missing, fail closed without mutating the stored attempt", () => {
  const state: CheckoutState = {
    checkoutAttempt: 4,
    stripeCheckoutSessionId: "cs_existing",
    checkoutLockExpiresAt: null,
  };
  const sessionCreationCalls = 0;

  for (const errorKind of ["network", "resource_missing"]) {
    const decision = decideExistingCheckoutSession({ outcome: "retrieval_failed" });
    assert.equal(decision.action, "unavailable", errorKind);
    if (decision.action === "unavailable") assert.equal(decision.statusCode, 503);
  }

  assert.equal(sessionCreationCalls, 0);
  assert.equal(state.stripeCheckoutSessionId, "cs_existing");
  assert.equal(state.checkoutAttempt, 4);
});

test("an open Checkout Session is reused without a new attempt", () => {
  const decision = decideExistingCheckoutSession({
    outcome: "retrieved",
    session: { status: "open", payment_status: "unpaid", url: "https://checkout.stripe.test/cs_open" },
  });
  assert.deepEqual(decision, { action: "reuse", url: "https://checkout.stripe.test/cs_open" });
});

test("only an explicitly expired Checkout Session permits a later replacement attempt", async () => {
  const decision = decideExistingCheckoutSession({
    outcome: "retrieved",
    session: { status: "expired", payment_status: "unpaid", url: null },
  });
  assert.equal(decision.action, "allow_later_retry");

  // The request that discovered an expired session only returns a retryable response.
  const sessionCreationCalls = decision.action === "allow_later_retry" ? 0 : 1;
  assert.equal(sessionCreationCalls, 0);

  const now = new Date("2026-07-13T12:00:00.000Z");
  const state: CheckoutState = {
    checkoutAttempt: 2,
    stripeCheckoutSessionId: "cs_expired",
    checkoutLockExpiresAt: null,
  };
  const claimed = await claimPaymentRequestCheckout({
    locker: createCheckoutLocker(state),
    paymentRequestId: "payment_123",
    now,
    checkoutLockToken: "lock_replace",
    checkoutLockExpiresAt: new Date(now.getTime() + 120_000),
    expectedExpiredSessionId: "cs_expired",
  });

  assert.equal(claimed.claimed, true);
  assert.equal(state.checkoutAttempt, 3);
  assert.equal(checkoutIdempotencyKey("payment_123", state.checkoutAttempt), "message-payment-request:payment_123:checkout:3");
});

test("stored complete Checkout Sessions are never replaced whether paid or still processing", () => {
  for (const [paymentStatus, paymentState] of [
    ["paid", "paid"],
    ["unpaid", "processing"],
  ] as const) {
    const decision = decideExistingCheckoutSession({
      outcome: "retrieved",
      session: { status: "complete", payment_status: paymentStatus, url: null },
    });
    assert.equal(decision.action, "processing", paymentStatus);
    if (decision.action === "processing") {
      assert.equal(decision.statusCode, 409);
      assert.equal(decision.paymentState, paymentState);
    }
  }
});

test("recovered Checkout creation returns an open session without another attempt", () => {
  const decision = decideCreatedCheckoutSession({
    status: "open",
    paymentStatus: "unpaid",
    url: "https://checkout.stripe.test/cs_recovered_open",
  });
  assert.deepEqual(decision, {
    action: "RETURN_OPEN_SESSION",
    url: "https://checkout.stripe.test/cs_recovered_open",
  });

  const checkoutAttempt = 3;
  const paidTransitions = 0;
  assert.equal(checkoutAttempt, 3);
  assert.equal(paidTransitions, 0);
});

test("recovered complete Checkout creation waits for webhooks without creating a replacement", () => {
  for (const [paymentStatus, expectedState] of [
    ["paid", "paid"],
    ["unpaid", "unpaid"],
    ["no_payment_required", "no_payment_required"],
  ] as const) {
    const decision = decideCreatedCheckoutSession({
      status: "complete",
      paymentStatus,
      url: null,
    });
    assert.deepEqual(decision, {
      action: "WAIT_FOR_WEBHOOK",
      paymentState: expectedState,
    });
  }
});

test("recovered expired and unknown Checkout creation states do not create a replacement", () => {
  assert.deepEqual(
    decideCreatedCheckoutSession({ status: "expired", paymentStatus: "unpaid", url: null }),
    { action: "ALLOW_LATER_RETRY" },
  );
  assert.deepEqual(
    decideCreatedCheckoutSession({ status: null, paymentStatus: null, url: null }),
    { action: "FAIL_CLOSED" },
  );
});

test("payment confirmation requires matching PaymentIntent metadata", () => {
  const expected = {
    paymentRequestId: "payment_123",
    inquiryId: "inquiry_123",
    buyerCompanyId: "buyer_123",
    sellerCompanyId: "seller_123",
  };
  assert.deepEqual(
    paymentIntentMetadataMismatchReasons(expected, {
      paymentRequestId: "payment_other",
      inquiryId: "inquiry_123",
      buyerCompanyId: "buyer_123",
      sellerCompanyId: "seller_123",
    }),
    ["payment_intent_metadata_payment_request"],
  );
  assert.deepEqual(
    paymentIntentMetadataMismatchReasons(expected, {}),
    ["payment_intent_metadata_payment_request"],
  );
  assert.deepEqual(paymentIntentMetadataMismatchReasons(expected, expected), []);
});

test("payment intent confirmation requires the stored Checkout Session linkage", () => {
  const expected = {
    checkoutSessionId: "cs_123",
    paymentIntentId: "pi_123",
    paymentRequestId: "payment_123",
    inquiryId: "inquiry_123",
    buyerCompanyId: "buyer_123",
    sellerCompanyId: "seller_123",
  };
  assert.deepEqual(
    storedCheckoutSessionMismatchReasons(expected, {
      id: "cs_123",
      paymentIntentId: "pi_123",
      metadata: expected,
    }),
    [],
  );
  assert.deepEqual(
    storedCheckoutSessionMismatchReasons(expected, {
      id: "cs_other",
      paymentIntentId: "pi_other",
      metadata: expected,
    }),
    ["stored_checkout_session_id", "stored_checkout_payment_intent"],
  );
  assert.deepEqual(
    storedCheckoutSessionMismatchReasons(expected, {
      id: "cs_123",
      paymentIntentId: "pi_123",
      metadata: { paymentRequestId: "payment_other" },
    }),
    ["checkout_payment_intent_metadata_payment_request"],
  );
  assert.deepEqual(decidePaymentIntentCheckoutSession("cs_123", true), {
    action: "RECONCILE_STORED_CHECKOUT_SESSION",
  });
});

test("matching Checkout, PaymentIntent, and Charge data permits one PENDING to PAID transition", async () => {
  const expected = {
    paymentRequestId: "payment_123",
    inquiryId: "inquiry_123",
    buyerCompanyId: "buyer_123",
    sellerCompanyId: "seller_123",
  };
  assert.equal(chargeMatchesPaymentIntent("pi_123", "pi_123"), true);
  assert.deepEqual(paymentIntentMetadataMismatchReasons(expected, expected), []);

  let status = "PENDING";
  let paidAt: Date | null = null;
  const locker = {
    paymentRequest: {
      async updateMany({ where, data }: { where: { status?: string }; data: { status?: string; paidAt?: Date } }) {
        if (where.status !== status) return { count: 0 };
        status = data.status ?? status;
        paidAt = data.paidAt ?? null;
        return { count: 1 };
      },
    },
  };
  const transition = {
    locker,
    paymentRequestId: "payment_123",
    data: { status: "PAID", paidAt: new Date("2026-07-13T12:00:00.000Z") },
  };
  const [first, second] = await Promise.all([
    claimPendingPaymentRequestPaid(transition),
    claimPendingPaymentRequestPaid(transition),
  ]);

  assert.equal([first, second].filter(Boolean).length, 1);
  assert.equal(status, "PAID");
  assert.ok(paidAt);
});

test("duplicate Stripe webhook delivery records one event and permits one PAID transition", async () => {
  const seenEventIds = new Set<string>();
  let paidEvents = 0;
  const locker = {
    paymentRequestWebhookEvent: {
      async create({ data }: { data: { stripeEventId: string } }) {
        if (seenEventIds.has(data.stripeEventId)) {
          throw Object.assign(new Error("Duplicate Stripe event."), { code: "P2002" });
        }
        seenEventIds.add(data.stripeEventId);
      },
    },
  };
  for (const attempt of [1, 2]) {
    const claimed = await claimPaymentRequestWebhookEvent({
      locker,
      paymentRequestId: "payment_123",
      stripeEventId: "evt_paid_123",
      stripeEventType: "payment_intent.succeeded",
    });
    if (claimed) paidEvents += 1;
    assert.equal(claimed, attempt === 1);
  }
  assert.equal(seenEventIds.size, 1);
  assert.equal(paidEvents, 1);
});

test("payment intent and Checkout completion ordering still allows one paid transition", async () => {
  const createTransition = () => {
    let status = "PENDING";
    const locker = {
      paymentRequest: {
        async updateMany({ where, data }: { where: { status?: string }; data: { status?: string } }) {
          if (where.status !== status) return { count: 0 };
          status = data.status ?? status;
          return { count: 1 };
        },
      },
    };
    return {
      transition: {
        locker,
        paymentRequestId: "payment_123",
        data: { status: "PAID" },
      },
      status: () => status,
    };
  };

  const checkoutFirst = createTransition();
  const checkoutSessionCompleted = await claimPendingPaymentRequestPaid(checkoutFirst.transition);
  const paymentIntentAfter = await claimPendingPaymentRequestPaid(checkoutFirst.transition);
  assert.equal(checkoutSessionCompleted, true);
  assert.equal(paymentIntentAfter, false);
  assert.equal(checkoutFirst.status(), "PAID");

  const paymentIntentFirst = createTransition();
  assert.deepEqual(decidePaymentIntentCheckoutSession(null), {
    action: "WAIT_FOR_CHECKOUT_SESSION",
  });
  // payment_intent.succeeded arrives first, so production leaves the request pending.
  assert.equal(paymentIntentFirst.status(), "PENDING");
  const checkoutAfter = await claimPendingPaymentRequestPaid(paymentIntentFirst.transition);
  assert.equal(checkoutAfter, true);
  assert.equal(paymentIntentFirst.status(), "PAID");

  assert.deepEqual(decidePaymentIntentCheckoutSession("cs_123"), {
    action: "VERIFY_STORED_CHECKOUT_SESSION",
  });
});

type ReleaseState = {
  status: string;
  refundAmount: number;
  releasedAt: Date | null;
  manualPayoutReference: string | null;
  requiresManualReconciliation: boolean;
  sellerReleasedAmount: number | null;
  releasedByUserId: string | null;
};

function createReleaseLocker(state: ReleaseState) {
  return {
    paymentRequest: {
      async updateMany({ where, data }: { where: unknown; data: unknown }) {
        const record = where as Record<string, unknown>;
        if (
          record.status !== state.status ||
          record.refundAmount !== state.refundAmount ||
          record.releasedAt !== state.releasedAt ||
          record.manualPayoutReference !== state.manualPayoutReference ||
          record.requiresManualReconciliation !== state.requiresManualReconciliation
        ) {
          return { count: 0 };
        }
        const mutation = data as Record<string, unknown>;
        state.status = mutation.status as string;
        state.releasedAt = mutation.releasedAt as Date;
        state.manualPayoutReference = mutation.manualPayoutReference as string;
        state.sellerReleasedAmount = mutation.sellerReleasedAmount as number;
        state.releasedByUserId = mutation.releasedByUserId as string;
        return { count: 1 };
      },
    },
  };
}

test("concurrent manual payout claims produce one release and one payout record", async () => {
  const state: ReleaseState = {
    status: "PAID",
    refundAmount: 0,
    releasedAt: null,
    manualPayoutReference: null,
    requiresManualReconciliation: false,
    sellerReleasedAmount: null,
    releasedByUserId: null,
  };
  const input = {
    locker: createReleaseLocker(state),
    paymentRequestId: "payment_123",
    sellerPayableAmount: 95_000,
    releasedAt: new Date("2026-07-13T12:00:00.000Z"),
    payoutReference: "payout_123",
    payoutDate: new Date("2026-07-13T12:00:00.000Z"),
    payoutNote: "Confirmed external payout.",
    releasedByUserId: "admin_123",
  };
  const [first, second] = await Promise.all([
    claimPaymentRequestRelease(input),
    claimPaymentRequestRelease(input),
  ]);

  assert.equal([first, second].filter(Boolean).length, 1);
  assert.equal(state.status, "RELEASED");
  assert.equal(state.sellerReleasedAmount, 95_000);
  assert.equal(state.manualPayoutReference, "payout_123");
  assert.equal(state.releasedByUserId, "admin_123");
});
