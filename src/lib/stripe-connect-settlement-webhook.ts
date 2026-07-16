import "server-only";

import { maybeCreatePendingSettlementForVerifiedPayment } from "@/lib/stripe-connect-settlements";

// This bridge intentionally has no Stripe client dependency. Webhook signature,
// amount, currency, metadata, Checkout Session, PaymentIntent, and Charge checks
// remain exclusively in the existing payment-confirmation path.
export async function createSettlementLedgerAfterVerifiedPayment(paymentRequestId: string) {
  return maybeCreatePendingSettlementForVerifiedPayment({ paymentRequestId });
}
