import { calculateOrderFinancials, PLATFORM_FEE_BPS } from "./order-financials.ts";

export const PAYMENT_REQUEST_CURRENCY = "usd";
export const PLATFORM_FEE_BASIS_POINTS = PLATFORM_FEE_BPS;
export const MAX_PAYMENT_AMOUNT_MINOR = 2_000_000_000;

export class PaymentRequestValidationError extends Error {}

export function parseUsdMinorUnits(value: unknown, field: string, minimum = 0) {
  if (typeof value !== "string") {
    throw new PaymentRequestValidationError(`${field} must be an amount in USD.`);
  }

  // Deliberately reject whitespace, signs, separators, and exponent notation. Checkout uses USD cents.
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) {
    throw new PaymentRequestValidationError(`${field} must use up to two decimal places.`);
  }

  const dollars = BigInt(match[1]);
  const cents = BigInt((match[2] ?? "").padEnd(2, "0") || "0");
  const amount = dollars * BigInt(100) + cents;
  if (amount > BigInt(MAX_PAYMENT_AMOUNT_MINOR)) {
    throw new PaymentRequestValidationError(`${field} is too large.`);
  }

  const parsed = Number(amount);
  if (!Number.isSafeInteger(parsed) || parsed < minimum) {
    throw new PaymentRequestValidationError(
      `${field} must be at least ${(minimum / 100).toFixed(2)}.`,
    );
  }

  return parsed;
}

export function calculatePaymentAmounts(productAmount: number, shippingAmount: number) {
  if (
    !Number.isSafeInteger(productAmount) ||
    !Number.isSafeInteger(shippingAmount) ||
    productAmount <= 0 ||
    shippingAmount < 0
  ) {
    throw new PaymentRequestValidationError("Payment amounts are invalid.");
  }

  const grossAmount = productAmount + shippingAmount;
  if (
    !Number.isSafeInteger(grossAmount) ||
    grossAmount <= 0 ||
    grossAmount > MAX_PAYMENT_AMOUNT_MINOR
  ) {
    throw new PaymentRequestValidationError("The total payment amount is too large.");
  }

  return calculateOrderFinancials(productAmount, shippingAmount);
}

export function checkoutIdempotencyKey(paymentRequestId: string, checkoutAttempt: number) {
  return `message-payment-request:${paymentRequestId}:checkout:${checkoutAttempt}`;
}

export function chargeMatchesPaymentIntent(
  chargePaymentIntentId: string | null | undefined,
  paymentIntentId: string,
) {
  return chargePaymentIntentId === paymentIntentId;
}

export type PaymentIntentMetadataExpectation = {
  paymentRequestId: string;
  inquiryId: string;
  buyerCompanyId: string;
  sellerCompanyId: string;
};

export type PaymentIntentMetadata = {
  paymentRequestId?: string;
  inquiryId?: string;
  buyerCompanyId?: string;
  sellerCompanyId?: string;
};

export type StoredCheckoutSessionExpectation = PaymentIntentMetadataExpectation & {
  checkoutSessionId: string;
  paymentIntentId: string;
};

export type StoredCheckoutSessionEvidence = {
  id: string;
  paymentIntentId: string | null;
  metadata: PaymentIntentMetadata | null | undefined;
};

export function decidePaymentIntentCheckoutSession(
  storedCheckoutSessionId: string | null,
  storedCheckoutSessionLookupFailed = false,
) {
  if (!storedCheckoutSessionId) return { action: "WAIT_FOR_CHECKOUT_SESSION" } as const;
  if (storedCheckoutSessionLookupFailed) {
    return { action: "RECONCILE_STORED_CHECKOUT_SESSION" } as const;
  }
  return { action: "VERIFY_STORED_CHECKOUT_SESSION" } as const;
}

// The payment request ID is mandatory. The other identifiers are optional in Stripe
// metadata, but must agree with the request whenever they are present.
export function paymentIntentMetadataMismatchReasons(
  expected: PaymentIntentMetadataExpectation,
  metadata: PaymentIntentMetadata | null | undefined,
) {
  const mismatches: string[] = [];
  if (!metadata || metadata.paymentRequestId !== expected.paymentRequestId) {
    mismatches.push("payment_intent_metadata_payment_request");
    return mismatches;
  }
  if (metadata.inquiryId && metadata.inquiryId !== expected.inquiryId) {
    mismatches.push("payment_intent_metadata_inquiry");
  }
  if (metadata.buyerCompanyId && metadata.buyerCompanyId !== expected.buyerCompanyId) {
    mismatches.push("payment_intent_metadata_buyer");
  }
  if (metadata.sellerCompanyId && metadata.sellerCompanyId !== expected.sellerCompanyId) {
    mismatches.push("payment_intent_metadata_seller");
  }
  return mismatches;
}

export function storedCheckoutSessionMismatchReasons(
  expected: StoredCheckoutSessionExpectation,
  session: StoredCheckoutSessionEvidence,
) {
  const mismatches: string[] = [];
  if (session.id !== expected.checkoutSessionId) {
    mismatches.push("stored_checkout_session_id");
  }
  if (session.paymentIntentId !== expected.paymentIntentId) {
    mismatches.push("stored_checkout_payment_intent");
  }
  mismatches.push(
    ...paymentIntentMetadataMismatchReasons(expected, session.metadata).map(
      (reason) => `checkout_${reason}`,
    ),
  );
  return mismatches;
}

export function isPaymentRequestPayableState(
  status: string,
  paymentDueDate: Date,
  now = Date.now(),
) {
  return status === "PENDING" && paymentDueDate.getTime() > now;
}

export function paymentReleaseBlockReason({
  status,
  refundAmount,
  requiresManualReconciliation,
  disputeStatuses,
}: {
  status: string;
  refundAmount: number;
  requiresManualReconciliation: boolean;
  disputeStatuses: string[];
}) {
  if (status !== "PAID") return "not_paid" as const;
  if (refundAmount > 0) return "refunded" as const;
  if (requiresManualReconciliation) return "reconciliation_required" as const;
  if (
    disputeStatuses.some(
      (disputeStatus) =>
        !["won", "lost", "prevented", "warning_closed", "charge_refunded"].includes(
          disputeStatus,
        ),
    )
  ) {
    return "active_dispute" as const;
  }
  return null;
}

export function cappedCumulativeRefundAmount(totalRefunded: number, grossAmount: number) {
  if (!Number.isSafeInteger(totalRefunded) || !Number.isSafeInteger(grossAmount)) {
    throw new PaymentRequestValidationError("Refund amounts are invalid.");
  }
  return Math.min(Math.max(totalRefunded, 0), grossAmount);
}

export function statusAfterRefund(refundAmount: number, grossAmount: number) {
  return refundAmount >= grossAmount ? "REFUNDED" : "PARTIALLY_REFUNDED";
}

export function statusAfterClosedDispute({
  releasedAt,
  refundAmount,
  grossAmount,
}: {
  releasedAt: Date | null;
  refundAmount: number;
  grossAmount: number;
}) {
  if (releasedAt) return "RELEASED";
  if (refundAmount >= grossAmount) return "REFUNDED";
  if (refundAmount > 0) return "PARTIALLY_REFUNDED";
  return "PAID";
}
