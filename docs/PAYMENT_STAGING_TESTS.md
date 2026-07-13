# Trade82 Phase 1 Message Payments: Staging Smoke Tests

Run these only against the isolated Preview deployment, separate staging Supabase project, and Stripe test-mode webhook endpoint described in `PAYMENT_STAGING_RUNBOOK.md`.

## A. Existing messaging regression

- [ ] The message list loads for an existing user.
- [ ] An existing conversation opens.
- [ ] Contact Seller creates or opens the expected conversation.
- [ ] A normal text message sends and appears once.
- [ ] Attachments continue to upload, open, and download when enabled.

## B. Payment request

- [ ] Only the seller sees **Request payment**.
- [ ] The buyer does not see **Request payment**.
- [ ] A seller creates a request with product name, quantity, unit, product amount, shipping amount, USD due date, and terms.
- [ ] USD 900.00 product amount plus USD 100.00 shipping stores gross `100000`, Trade82 fee `5000`, and seller payable `95000` minor units.
- [ ] The buyer sees the structured request card in the same conversation timeline.

## C. Checkout

- [ ] Only the buyer sees **Pay now** on a pending, unexpired request.
- [ ] A payment attempt creates one Stripe Checkout Session.
- [ ] Double-clicking Pay now does not create two Checkout Sessions.
- [ ] A stored open Session is reused.
- [ ] A completed Session displays processing and waits for the verified webhook; browser redirect alone does not mark it paid.
- [ ] An explicitly expired Session allows a later attempt.
- [ ] Stripe Session retrieval errors fail closed and do not create a replacement Session.

## D. Webhook confirmation and reconciliation

- [ ] The Stripe browser success URL does not set `PAID`.
- [ ] A verified `checkout.session.completed` or `payment_intent.succeeded` event sets `PAID` exactly once.
- [ ] A duplicate webhook does not add duplicate payment events.
- [ ] `payment_intent.succeeded` before `checkout.session.completed` remains safe and later confirms correctly.
- [ ] `checkout.session.completed` before `payment_intent.succeeded` remains safe and confirms correctly.
- [ ] Mismatched amount, lowercase currency, metadata, or Checkout/PaymentIntent/Charge linkage requires manual reconciliation rather than marking paid.

## E. Cancellation

- [ ] A seller can cancel only a pending request.
- [ ] A stored open Checkout Session is expired in Stripe before the request is cancelled.
- [ ] A paid or completed Session cannot be cancelled.

## F. Refunds and disputes

- [ ] A partial refund updates the request to `PARTIALLY_REFUNDED`.
- [ ] A full refund updates the request to `REFUNDED`.
- [ ] A dispute creation event sets the request to `DISPUTED`.
- [ ] A dispute update is stored idempotently.
- [ ] A dispute closure preserves the correct post-dispute status.
- [ ] A refund or dispute after manual release preserves payout data and creates a reconciliation requirement.

## G. Manual seller payout

- [ ] An admin must enter a payout reference, payout date, and required note.
- [ ] No seller bank details are collected or displayed.
- [ ] Two simultaneous release attempts produce one success and one conflict response.
- [ ] A refunded, disputed, or reconciliation-flagged request cannot be released.

## Evidence to retain

Record only non-secret staging evidence: payment request ID, Stripe test object IDs, webhook event IDs, timestamps, expected versus observed state, and screenshots without customer payment data. Do not copy API keys, webhook secrets, raw database URLs, or card details into test notes.
