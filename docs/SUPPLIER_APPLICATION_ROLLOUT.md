# Supplier Application rollout

`SUPPLIER_APPLICATIONS_ENABLED` is a server-only, fail-closed feature flag. Only
the exact value `true` enables queries to Supplier Application tables. It must
not use a `NEXT_PUBLIC_` name.

Roll out in this order:

1. Apply all additive migrations to a disposable or staging database.
2. Verify staging private Storage, MIME/size policy, signed URLs, and encryption
   variables.
3. Set `SUPPLIER_APPLICATIONS_ENABLED=true` in staging only.
4. Run applicant and Admin browser flows with staging-only identities and files.
5. Run the legacy backfill in dry-run mode and review every classification.
6. Apply the staging backfill with the explicit staging confirmation variable.
7. Re-run legacy seller product, inventory, order, shipping, and payout access.
8. Obtain approval and apply the additive migration to Production before any
   feature activation.
9. Keep the Production flag off and verify all existing seller workflows.
10. Enable the Production flag only after the migration and environment checks.
11. Expose applications gradually to a small cohort of new suppliers.

## Separate activation gates

Treat application intake and Admin review, final supplier approval, and live
product publishing as three separate rollout decisions. Enabling
`SUPPLIER_APPLICATIONS_ENABLED` may expose the application and review workflow;
it must not by itself authorize newly approved suppliers to publish arbitrary
live products.

The current Product model has no Product Master or temporary
`Product`–`SupplierBrandVerification` association. Until one is implemented and
reviewed, there is no product-level proof that a newly approved supplier owns or
is authorized to sell the brand attached to each listing. Production rollout
must therefore keep live product publishing for newly approved suppliers behind
a separate server-side gate. This PR intentionally does not implement Product
Master or that product-to-brand relationship.

This PR does not apply a Production migration, enable the Production flag, run
the backfill, or deploy to Production.

## Payment authorization boundary

`MESSAGE_PAYMENT_REQUEST_MODE` is only a rollout switch and never substitutes
for Supplier eligibility. `canAcceptNewOrders` is checked after seller inquiry
ownership, again at the PaymentRequest transaction write boundary, before a
buyer can retrieve/reuse/create Stripe Checkout, and after verified payment
confirmation before TradeOrder synchronization or settlement creation.

Changing an application to `ON_HOLD`, `REJECTED`, `WITHDRAWN`, or `SUSPENDED`,
or reviewing brand evidence so that no active unexpired verified brand remains,
places pending PaymentRequests into manual reconciliation. Existing Stripe
sessions are not synchronously expired inside Supplier Application database
transactions. Checkout attempts fail closed and best-effort expiration occurs
outside the transaction. If an already-issued Stripe URL is nevertheless paid,
the webhook records the payment and audit event without automatic settlement,
payout eligibility, refund, or transfer; an administrator must reconcile it.
