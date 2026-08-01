# Supplier Application review fixes

Date: 2026-08-01

PR: #84

Branch: `pivot/supplier-application-v1`
Reviewed head before fixes: `f697bd0650e301da7e5e6ba2bb0124b18d10d89a`

## Deployment and database state

- `20260801090000_add_supplier_applications` is the last entry in
  `DEFERRED_APPLICATION_MIGRATIONS`. It is not included in
  `ALLOWLISTED_PRODUCTION_MIGRATIONS`.
- The Production migration runner blocks a Production deploy while any deferred
  application migration is absent. Local and Preview builds skip that runner's
  Production database connection path.
- Vercel Preview for the reviewed head built successfully. Repository code
  distinguishes Preview from Production through `VERCEL_ENV`, but the source
  does not prove which external database or Storage project the Preview
  environment variables reference. That remains an environment-level manual
  verification item; no secret values were read for this review.

## Capability call map

Direct `getSupplierApplicationCapabilities()` consumers:

- `src/lib/require-auth.ts`: signed-in routing and seller dashboard authorization.
- `src/lib/authz.ts`: verified-seller compatibility and capability authorization.
- `src/app/api/dashboard/summary/route.ts`: seller dashboard summary.
- `src/app/api/orders/route.ts`: order list company scoping.
- `src/app/api/orders/[orderNumber]/route.ts`: order detail and mutation access.
- `src/app/api/supplier-applications/[id]/inventory-samples/route.ts`: pre-approval
  inventory-sample upload permission.

Server components using the dashboard wrapper are the default, `/en`, and `/ko`
seller dashboard and bulk-product routes plus `src/components/listing-page.tsx`.
`requireApprovedSupplierCapability()` is also used by product create/update,
bulk template/validate/import, product uploads, seller documents, marketing,
company, payout profile/banks, verification, and marketing checkout APIs.

## Legacy capability behavior found

Before backfill, a non-deleted verified seller Company with no application gets
all existing product, inventory, offer, order, and shipping capabilities, with
payout additionally requiring a VERIFIED payout profile. Before these fixes,
creating a `CONDITIONALLY_APPROVED` backfill application removed that fallback
and therefore removed product/inventory/offer permissions. The corrected policy
grandfathers only an application classified `LEGACY_CONDITIONALLY_APPROVED`
that references the same non-deleted verified legacy Company. Suspension always
ends grandfathering.

## Conditional approval behavior found

Before these fixes, conditional approval created or updated a Company as
`verified`, set `verifiedSellerSince`, and granted both normal receive-order and
ship-order capabilities. The corrected design exposes only
`canReceiveTestOrder`. `canAcceptNewOrders`, `canAccessAssignedOrders`, and
`canShipExistingOrders` now express separate policies. New orders require full
`APPROVED`, a non-deleted verified Company, and an active, unexpired verified
brand. An approved supplier whose brand evidence later expires may still access
and ship already assigned orders. `ON_HOLD` blocks new activity and payout but
allows a previously verified company to finish assigned orders; `REJECTED`,
`WITHDRAWN`, and `SUSPENDED` block all three order capabilities. Supplier
eligibility is enforced at PaymentRequest creation, buyer Checkout
creation/reuse, and post-payment settlement reconciliation. Creation rechecks
the seller-company-specific capability at the transaction write boundary;
Checkout checks it before any Stripe session lookup, reuse, or creation. A new
conditional Company stays `pending_review` and is not a public verified seller.

When a supplier loses new-order capability, pending PaymentRequests are marked
for manual reconciliation and checkout locks are cleared in the same database
transaction as the application or brand review. No Stripe call runs inside that
transaction. A previously issued Checkout URL can still complete outside the
application, so the verified webhook records the paid Stripe evidence but does
not synchronize the TradeOrder or create settlement/payout eligibility. It adds
an auditable reconciliation event and returns successfully to avoid a webhook
retry loop. The buyer Checkout endpoint also attempts to expire a stored open
session after the database hold is committed and remains fail-closed if Stripe
expiration fails.

## Brand review behavior found

The original `BRANDS` section review used `updateMany` and converted every
pending brand together. This is replaced by a per-brand review endpoint and UI.
The section review remains an audit-only aggregate record and never changes a
brand row.

The per-brand endpoint uses HTTP PATCH semantics. Omitted optional fields retain
their stored value, explicit null clears the value, and a supplied value replaces
it. `VERIFIED` requires verified evidence and a future-or-null expiry;
`EXPIRED` accepts a past expiry and records the current time when both the input
and stored expiry are absent; `RESTRICTED` requires at least one country; and all
review transitions require an audit reason (including `REJECTED` and
`ADDITIONAL_EVIDENCE_REQUIRED`).

## Inventory sample gap found

The original validator expected `brand, gtin, sku, name, quantity, stock date,
currency, price`. The product requirements instead define `gtin, brand,
product_name, size_or_variant, supply_price, currency, available_quantity, moq,
mov, lead_time_days, expiration_date, warehouse, allowed_countries,
stock_updated_at`. The Supplier Application validator and counters are updated
to that dedicated format; `size_or_variant` is required for every K-beauty SKU
and contributes to `missingRequiredFieldRows` when blank. The existing live
bulk-product template is not reused.
