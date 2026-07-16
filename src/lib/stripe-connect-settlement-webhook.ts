import "server-only";

import {
  createPendingSettlementForVerifiedWebhookPayment,
  type VerifiedSettlementPaymentEvidence,
} from "@/lib/stripe-connect-settlements";

export type { VerifiedSettlementPaymentEvidence } from "@/lib/stripe-connect-settlements";

// This bridge intentionally has no Stripe client dependency. Existing payment
// verification remains authoritative; this adds a second persisted-evidence gate
// before local accounting records can be created or backfilled.
export async function createSettlementLedgerAfterVerifiedPayment(
  evidence: VerifiedSettlementPaymentEvidence,
) {
  return createPendingSettlementForVerifiedWebhookPayment(evidence);
}
