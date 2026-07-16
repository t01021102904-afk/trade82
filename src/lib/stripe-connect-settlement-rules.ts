import "server-only";

export const SETTLEMENT_HOLD_DAYS = 14;

export function calculateSettlementHoldUntil(paidAt: Date) {
  if (!(paidAt instanceof Date) || Number.isNaN(paidAt.getTime())) {
    throw new Error("A verified payment timestamp is required for settlement hold calculation.");
  }
  return new Date(paidAt.getTime() + SETTLEMENT_HOLD_DAYS * 24 * 60 * 60 * 1_000);
}

export function settlementIdempotencyKey(paymentRequestId: string) {
  return `stripe-connect-settlement:payment-request:${paymentRequestId}`;
}

export function settlementLegIdempotencyKey(
  paymentRequestId: string,
  type: string,
) {
  return `${settlementIdempotencyKey(paymentRequestId)}:leg:${type}`;
}
