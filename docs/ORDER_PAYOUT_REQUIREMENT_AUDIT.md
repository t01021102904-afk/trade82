# Order and Manual Payout Requirement Audit

This matrix traces the original Order Management and Manual Seller Payout brief
to the current local implementation. Statuses are deliberately conservative:
`IMPLEMENTED` means the requirement has a concrete code path and named static
or database-backed coverage. The database-backed audit was run only against an
isolated disposable PostgreSQL cluster; it was never substituted with a
Production or other existing database connection.

| Original requirement | Status | Implementation | Test coverage |
| --- | --- | --- | --- |
| 1. 5% platform fee, integer minor units, processing fee separate | IMPLEMENTED | `src/lib/order-financials.ts` `calculateOrderFinancials`; `src/lib/trade-orders.ts` | `order financials use integer cents and half-up five-percent rounding` |
| 1. Manual external payout wording; no bank API/automatic transfer | IMPLEMENTED | `src/components/admin-payout-management.tsx`; `src/lib/seller-payouts.ts` | `manual payout UI records only external transfers and clears revealed bank instructions` |
| 2. Create `TradeOrder` with each new `PaymentRequest` in one transaction | IMPLEMENTED | `src/app/api/inquiries/[id]/payment-requests/route.ts` `POST`; `createTradeOrderForPaymentRequest` | `new payment request and exactly one linked order are created inside one transaction` |
| 2. UTC, yearly, unique order numbers beyond 9999 | IMPLEMENTED | `nextTradeOrderNumber`; `OrderNumberCounter`; migration unique index | `production order counter allocation remains unique under concurrent calls` |
| 2. Existing PaymentRequests remain valid; nullable one-to-one order link | IMPLEMENTED | `PaymentRequest.orderId`; migration `ADD COLUMN` | `migration is additive...` |
| 3. Additive order, item, shipment, event, bank, profile, payout models and enums | IMPLEMENTED | `prisma/schema.prisma`; migration | `migration is additive...` |
| 3. Restrictive financial foreign keys and no cascade deletion | IMPLEMENTED | `onDelete: Restrict` relations; migration FKs | `migration is additive...` |
| 4. Immutable buyer/seller company snapshots | IMPLEMENTED | `immutableCompanySnapshot`; `createTradeOrderForPaymentRequest` | `company and product snapshots do not follow later profile edits` |
| 5. One initial item with safe derived unit price; multi-item schema support | IMPLEMENTED | `TradeOrderItem`; `wholeNumberUnitPrice` | `company and product snapshots do not follow later profile edits` |
| 6. Shipment model and seller/admin-only shipment edits | IMPLEMENTED | `TradeOrderShipment`; `api/orders/[orderNumber]` | `buyer order responses omit seller payout and beneficiary fields` |
| 7. Shared payment-to-order synchronization for paid/refund/dispute/cancel | IMPLEMENTED | `syncTradeOrderFromPaymentRequest`; existing verified webhook path | `webhook payment, refund, dispute, and cancellation states synchronize linked orders` |
| 7. Masked admin Stripe identifiers in order UI | IMPLEMENTED | `/api/admin/orders?detail=1` masks Checkout Session, PaymentIntent, and Charge as `prefix_...last4`; `admin-order-management` renders only those server-masked values | `admin order query supports... masked detail` |
| 8. Seller payout information pages and seller-only profile access | IMPLEMENTED | `payout-information-client`; `api/account/payout-profile` | `seller profile APIs use safe selects...` |
| 8. Complete payout profile field set, masking, re-entry, verification reset | IMPLEMENTED | `SellerPayoutProfile`; `saveSellerPayoutProfile`; payout information UI | `seller profile APIs use safe selects...` |
| 9. Admin-managed bank directory and seller auto-fill | IMPLEMENTED | `BankDirectory`; `verifiedBankAutofill`; admin API/UI | `bank auto-fill only trusts verified directory values...` |
| 9. South Korean selectable bank seed without invented remittance data | IMPLEMENTED | `south-korea-bank-directory.ts`; idempotent seed inserts only names with `sourceType: SEED`, no SWIFT/BIC/address/website, and never updates an administrator correction | `bank auto-fill only trusts verified directory values...` |
| 9. Verified SWIFT/BIC source documentation | IMPLEMENTED | `ORDER_MANUAL_PAYOUT_MIGRATION.md` records that the safe seed contains none | Documentation review |
| 10. AES-256-GCM encryption, versioned keys, masking, fail-closed behavior | IMPLEMENTED | `payout-crypto.ts` | `payout beneficiary encryption...`; `payout encryption fails closed...` |
| 10. Restricted POST reveal with no-store and audit | IMPLEMENTED | payout/profile reveal routes | `admin reveals require POST...` |
| 11. Immutable encrypted payout instruction snapshot and stable payout number | IMPLEMENTED | `prepareSellerPayout`; `SellerPayout` | `payout preparation and SENT transition...` |
| 12. Eligibility, duplicate prevention, atomic SENT/release transition | IMPLEMENTED | `sellerPayoutEligibility`; `markSellerPayoutSent`; unique order payout | `payout eligibility blocks...`; `payout preparation and SENT transition...` |
| 13. Admin prepare/review/hold/process/sent/failed workflow | IMPLEMENTED | admin order/payout routes and UI | `manual payout UI records only external transfers...` |
| 13. Manual adjustment/correction workflow with dedicated adjustment event | IMPLEMENTED | Append-only `SellerPayoutAdjustment`, serializable recalculation for unsent payouts, typed confirmation, and separate reconciliation records for sent payouts | `manual payout adjustment rules...`; `payout adjustments are admin-only...` |
| 14. Admin order table, search, pagination, status/country filtering, masked CSV | IMPLEMENTED | `api/admin/orders`; `admin-order-management` provides server-side filtering/search/pagination/sorting, masked CSV from the full filtered set, and export audit events | `CSV exports...`; `admin order query supports...` |
| 14. Sort/date/currency filters, column preferences, summary totals, detail drawer, privileged full export | IMPLEMENTED | Date/currency/status/country filters, multi-currency summaries, localStorage column IDs only, masked detail drawer, and masked-only export policy | `admin order query supports...` |
| 15. Buyer/seller order pages without counterparty bank details | IMPLEMENTED | `api/orders`; `api/orders/[orderNumber]`; `orders-client` | `buyer order responses omit seller payout and beneficiary fields` |
| 16. Order and payout events with safe metadata | IMPLEMENTED | `appendTradeOrderEvent`; `addPayoutEvent` | webhook/payout state tests |
| 17. Admin-only private payout proof upload, signed URL, short expiry, audit | IMPLEMENTED | `api/admin/payouts/[id]/proof` | `payout proof uploads use a private bucket...` |
| 18. Safe transactional notifications for required lifecycle events | IMPLEMENTED | `trade-order-notifications.ts`; lifecycle callers | `order notifications do not contain account...` |
| 19. Fail-closed server-only order/manual payout flags using Clerk IDs | IMPLEMENTED | `trade-order-feature.ts`; all new route checks | `rollout flags fail closed...` |
| 20. Buyer/seller/admin server-side authorization | IMPLEMENTED | ownership predicates in order/profile routes; `requireAdmin` on admin routes | `seller profile APIs use safe selects...`; `buyer order responses omit...` |
| 21. Additive migration document, deployment order, env and rollback notes | IMPLEMENTED | `ORDER_MANUAL_PAYOUT_MIGRATION.md` | `migration is additive...` |
| 22. Required unit and static authorization/security tests | IMPLEMENTED | `tests/order-manual-payout.test.ts` covers static/unit authorization and `tests/order-manual-payout.integration.test.ts` exercises real PostgreSQL transactions, RLS, encryption persistence, bank seeding, and concurrency. | `npm run test:orders` (28 tests); `npm run test:orders:integration` (10 groups / 35 required checks) |

## Direct-access protection

The migration enables RLS and revokes `anon` and `authenticated` access for
`OrderNumberCounter`, `TradeOrder`, `TradeOrderItem`, `TradeOrderShipment`,
`TradeOrderEvent`, `BankDirectory`, `SellerPayoutProfile`,
`SellerPayoutProfileAuditEvent`, `SellerPayout`, `SellerPayoutEvent`, and
`SellerPayoutAdjustment`.
All application access remains through server-side Prisma routes.

## Isolated database-backed audit

On 2026-07-13, the full integration suite ran on PostgreSQL 16.11 created with
`initdb` and controlled with `pg_ctl` under unique `/tmp` data and Unix-socket
directories. The server listened only on `127.0.0.1` on temporary port `62373`;
the disposable database name used the required `trade82_order_payout_test_`
prefix. It was independent from the existing local PostgreSQL service.

All 21 migrations applied with `npx prisma migrate deploy`, and `npx prisma
migrate status` reported the schema up to date. PostgreSQL metadata verified the
nullable `PaymentRequest.orderId`, unique order and payout numbers, required
restrictive financial foreign keys, RLS on every new financial table, and revoked
`anon`/`authenticated` direct read and write privileges. The integration suite
passed 10 groups containing the 35 required checks: atomic rollback, feature-off
compatibility, counters, payout races, refunds/disputes, immutable adjustments,
authorization scopes, account encryption/snapshots, RLS, CSV safety, and
idempotent bank seeding.

The seed produced exactly 20 Korean bank records, preserved an administrator
override on the second run, and did not introduce unverified SWIFT/BIC, bank
address, or official website data. The cluster was stopped by a shell trap and
its temporary data directory, socket directory, log, and credential file were
removed after validation.

## Remaining rollout safeguards

1. Keep both order and manual-payout rollout modes `off` until an approved
   internal rollout. The integration environment used temporary server-only
   values and did not alter any deployed setting.
2. Administrators must still add bank-owned verification sources before relying
   on SWIFT/BIC, address, or official portal data in a real deployment.
3. Do not use destructive rollback for financial records; retain the additive
   schema and disable the rollout flags if application code needs to roll back.
