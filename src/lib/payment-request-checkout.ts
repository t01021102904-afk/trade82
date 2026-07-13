import type { PaymentRequestStatus, Prisma } from "@/generated/prisma/client";

const PENDING_STATUS: PaymentRequestStatus = "PENDING";

export type PaymentRequestCheckoutLocker = {
  paymentRequest: {
    updateMany(args: {
      where: Prisma.PaymentRequestWhereInput;
      data: Prisma.PaymentRequestUpdateManyMutationInput;
    }): Promise<{ count: number }>;
  };
};

export type CheckoutClaimResult = {
  claimed: boolean;
  reusedAttempt: boolean;
};

export type ExistingCheckoutSession = {
  status: string | null;
  payment_status: string | null;
  url: string | null;
};

export type ExistingCheckoutDecision =
  | { action: "reuse"; url: string }
  | { action: "allow_later_retry" }
  | { action: "processing"; paymentState: "paid" | "processing"; statusCode: 409 }
  | { action: "unavailable"; statusCode: 503 };

export type CreatedCheckoutSession = {
  status: string | null;
  paymentStatus: string | null;
  url: string | null;
};

export type CreatedCheckoutDecision =
  | { action: "RETURN_OPEN_SESSION"; url: string }
  | {
      action: "WAIT_FOR_WEBHOOK";
      paymentState: "paid" | "unpaid" | "no_payment_required" | "processing";
    }
  | { action: "ALLOW_LATER_RETRY" }
  | { action: "FAIL_CLOSED" };

// A stored session is authoritative until Stripe explicitly confirms that it expired.
// Unknown states and retrieval failures must never create a second payable session.
export function decideExistingCheckoutSession(
  result:
    | { outcome: "retrieved"; session: ExistingCheckoutSession }
    | { outcome: "retrieval_failed" },
): ExistingCheckoutDecision {
  if (result.outcome === "retrieval_failed") return { action: "unavailable", statusCode: 503 };

  const { session } = result;
  if (session.status === "open" && session.url) {
    return { action: "reuse", url: session.url };
  }
  if (session.status === "expired") return { action: "allow_later_retry" };
  if (session.status === "complete") {
    return {
      action: "processing",
      paymentState: session.payment_status === "paid" ? "paid" : "processing",
      statusCode: 409,
    };
  }

  return { action: "unavailable", statusCode: 503 };
}

// A session returned by an idempotent create may be from an earlier ambiguous
// create. Its state is authoritative and must never be treated as expired by default.
export function decideCreatedCheckoutSession(
  session: CreatedCheckoutSession,
): CreatedCheckoutDecision {
  if (session.status === "open" && session.url) {
    return { action: "RETURN_OPEN_SESSION", url: session.url };
  }
  if (session.status === "complete") {
    const paymentState =
      session.paymentStatus === "paid" ||
      session.paymentStatus === "unpaid" ||
      session.paymentStatus === "no_payment_required"
        ? session.paymentStatus
        : "processing";
    return { action: "WAIT_FOR_WEBHOOK", paymentState };
  }
  if (session.status === "expired") return { action: "ALLOW_LATER_RETRY" };
  return { action: "FAIL_CLOSED" };
}

function availableCheckoutLock(now: Date) {
  return {
    OR: [{ checkoutLockExpiresAt: null }, { checkoutLockExpiresAt: { lt: now } }],
  };
}

// This helper intentionally makes the race-sensitive state transition one updateMany operation.
// Stripe is called only after this claim has succeeded; no database transaction is held open for it.
export async function claimPaymentRequestCheckout({
  locker,
  paymentRequestId,
  now,
  checkoutLockToken,
  checkoutLockExpiresAt,
  expectedExpiredSessionId,
}: {
  locker: PaymentRequestCheckoutLocker;
  paymentRequestId: string;
  now: Date;
  checkoutLockToken: string;
  checkoutLockExpiresAt: Date;
  // This path is only used after a later HTTP request explicitly retrieves the
  // stored Checkout Session from Stripe and receives status=expired. It is not
  // used for an ambiguous session returned by the current create call.
  expectedExpiredSessionId?: string | null;
}): Promise<CheckoutClaimResult> {
  const baseWhere = {
    id: paymentRequestId,
    status: PENDING_STATUS,
    paymentDueDate: { gt: now },
    ...availableCheckoutLock(now),
  };

  if (expectedExpiredSessionId) {
    const replacementAttempt = await locker.paymentRequest.updateMany({
      where: {
        ...baseWhere,
        stripeCheckoutSessionId: expectedExpiredSessionId,
      },
      data: {
        stripeCheckoutSessionId: null,
        checkoutAttempt: { increment: 1 },
        checkoutLockToken,
        checkoutLockExpiresAt,
      },
    });
    return {
      claimed: replacementAttempt.count === 1,
      reusedAttempt: false,
    };
  }

  const firstAttempt = await locker.paymentRequest.updateMany({
    where: { ...baseWhere, stripeCheckoutSessionId: null, checkoutAttempt: 0 },
    data: {
      checkoutAttempt: { increment: 1 },
      checkoutLockToken,
      checkoutLockExpiresAt,
    },
  });
  if (firstAttempt.count === 1) return { claimed: true, reusedAttempt: false };

  const recoveryAttempt = await locker.paymentRequest.updateMany({
    where: {
      ...baseWhere,
      stripeCheckoutSessionId: null,
      checkoutAttempt: { gt: 0 },
    },
    data: { checkoutLockToken, checkoutLockExpiresAt },
  });
  return { claimed: recoveryAttempt.count === 1, reusedAttempt: recoveryAttempt.count === 1 };
}
