# Phase 1 Message Payments: Direct Production Rollout

This runbook is for the Trade82 production environment only. It does not replace
the normal change-approval process.

## Guardrails

- The additive payment migration **must be applied before** payment code reaches production.
- Environment-variable changes require a new deployment.
- The first payment-code deployment must use `MESSAGE_PAYMENT_REQUEST_MODE=off`.
- A code rollback must not roll back or delete the additive payment tables.
- Never run `prisma migrate reset` or `prisma db push` against production.
- Do not enable `internal` or `on` until the prior step has been approved.

## Required order

1. Verify the production database backup.
2. Verify Stripe live webhook configuration.
3. Set `MESSAGE_PAYMENT_REQUEST_MODE=off` in Vercel Production.
4. Apply the additive payment migration to production.
5. Confirm payment tables exist.
6. Merge and deploy payment code while mode remains `off`.
7. Smoke-test existing messaging and Contact Seller.
8. Change mode to `internal` and redeploy.
9. Test with two internal Clerk accounts.
10. Test one controlled live payment.
11. Test webhook confirmation.
12. Refund the controlled payment.
13. Confirm admin payment and reconciliation records.
14. Change mode to `on` and redeploy only after approval.

## Before migration

1. Confirm the deployment is targeting `https://trade82.com` and production
   Supabase project `cjryteuoyiiwsxarblfd`.
2. In Vercel Production, set all required live Stripe variables, the production
   database URLs, `TRADE82_ENVIRONMENT=production`, and
   `TRADE82_PRODUCTION_SUPABASE_PROJECT=cjryteuoyiiwsxarblfd`.
3. Keep `MESSAGE_PAYMENT_REQUEST_MODE=off` and leave
   `MESSAGE_PAYMENT_INTERNAL_USER_IDS` empty for the initial deployment.
4. Run `npm run production:payments:check` in a production-equivalent shell.
   The command validates configuration only; it does not connect to Supabase or Stripe.
5. Confirm Stripe sends the required live events to the production webhook URL:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `payment_intent.succeeded`
   - `refund.created`
   - `refund.updated`
   - `charge.dispute.created`
   - `charge.dispute.updated`
   - `charge.dispute.closed`
   - existing subscription events: `customer.subscription.created`,
     `customer.subscription.updated`, `customer.subscription.deleted`,
     `invoice.payment_succeeded`, and `invoice.payment_failed`

## Migration and first deployment

1. Apply only `prisma/migrations/20260713090000_add_message_payment_requests/migration.sql`
   through the approved production migration process.
2. Confirm the new payment enums, tables, indexes, and foreign keys exist.
3. Deploy the payment code with `MESSAGE_PAYMENT_REQUEST_MODE=off`.
4. Confirm that ordinary messages, attachments, and Contact Seller work. Payment
   controls must not render and payment creation/Checkout must return 403.
5. Confirm the webhook endpoint remains reachable. Refund and dispute handling
   must remain enabled regardless of rollout mode.

## Internal rollout

1. Set `MESSAGE_PAYMENT_REQUEST_MODE=internal` and set
   `MESSAGE_PAYMENT_INTERNAL_USER_IDS` to the two approved test Clerk user IDs.
2. Deploy the environment change.
3. Test seller creation, buyer Checkout, verified webhook payment confirmation,
   admin manual payout recording, a refund, and a dispute with controlled live data.
4. Confirm non-allowlisted users cannot render payment actions or start payment APIs.

## Full rollout

1. Review live payment, refund, dispute, admin, and reconciliation records.
2. Obtain approval for general availability.
3. Set `MESSAGE_PAYMENT_REQUEST_MODE=on` and redeploy.
4. Monitor the Stripe webhook endpoint and payment/admin logs after launch.

## Rollback

If a code rollback is required, keep the payment migration and payment tables in
place. Return the rollout mode to `off`, redeploy the prior application code, and
reconcile any existing payment records manually. Do not delete or truncate payment
tables during rollback.
