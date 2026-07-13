# Trade order and manual payout migration

## Scope

`20260713110000_add_trade_orders_and_manual_payouts` is additive. It creates the
order, shipment, payout profile, bank directory, payout, append-only payout
adjustment, counter, and audit-event tables required for the manual seller payout
workflow. It also adds a nullable,
unique `PaymentRequest.orderId` foreign key. Existing payment requests remain
valid and are not backfilled or rewritten.

The migration creates only new enums, tables, indexes, unique constraints, and
restrictive foreign keys. It does not alter existing `Inquiry` or `Message`
columns, delete data, drop tables, or enable the feature. It also enables RLS
and revokes direct `anon`/`authenticated` access on every new order, payout,
bank-directory, counter, and audit table. Prisma server access remains the only
supported path to these records.

## Deployment order

1. Review the migration SQL and run `npx prisma migrate status` against the
   intended environment.
2. Set the server-only encryption variables before any payout profile can be
   saved with an account number.
3. Apply this migration with `npx prisma migrate deploy` during an approved
   maintenance window.
4. Deploy the compatible application code with both rollout modes still `off`.
5. Exercise the workflow with an internal allowlist before enabling either mode
   for all users.

## Required server-only environment variables

```
PAYOUT_DATA_ENCRYPTION_KEY=<base64-encoded 32-byte key>
PAYOUT_DATA_ENCRYPTION_KEY_VERSION=<rotation identifier>
PAYOUT_DATA_ENCRYPTION_KEYRING=<optional JSON map of prior key versions to base64 32-byte keys>
TRADE_ORDER_SYSTEM_MODE=off|internal|on
TRADE_ORDER_INTERNAL_USER_IDS=<comma-separated Clerk IDs, internal only>
MANUAL_PAYOUT_SYSTEM_MODE=off|internal|on
MANUAL_PAYOUT_INTERNAL_USER_IDS=<comma-separated Clerk IDs, internal only>
```

Both rollout modes default to `off` when absent or invalid. Do not expose either
mode or allowlist to browser code. The encryption key is required only for a
write or restricted reveal of sensitive payout instructions; failures must remain
closed and must not persist plaintext.

## Rollback considerations

Do not drop these financial tables as a routine rollback. If application code
must be rolled back, retain the tables and leave both rollout modes `off`; the
existing message-payment path remains compatible because `PaymentRequest.orderId`
is nullable. A future, explicitly reviewed migration is required for any schema
removal after a data-retention review.

## Bank data

`BankDirectory` is intentionally unseeded in this migration. Run
`npm run db:seed:south-korean-banks` only against an approved environment after
the migration is applied. The seed is idempotent, inserts only the 20 selectable
South Korean bank names, and never overwrites an existing administrator record.
It intentionally populates no SWIFT/BIC, address, or website, so there are no
official-source claims to verify yet. An administrator must add each future
remittance value with its bank-owned `sourceUrl` and `verifiedAt` date.

| Populated SWIFT/BIC values | Official verification source |
| --- | --- |
| None in the seed | Not applicable; unverified fields remain null. |

Each directory record carries a source marker: `SEED`, `ADMIN`, or
`ADMIN_OVERRIDE`. An administrator editing a seeded record changes its marker to
`ADMIN_OVERRIDE`; the seed itself uses an empty upsert update and therefore never
reverts an administrator correction.

Sellers may request a manual override, which requires administrator verification
before a payout becomes eligible. The seller endpoint returns active directory
entries only and auto-fills only verified fields; a seller manual override stays
explicit and is not silently overwritten.

## Manual payout adjustments

`SellerPayoutAdjustment` is an append-only ledger. Entries use integer minor
units and a positive stored amount; `CREDIT` increases a pending payout and the
other adjustment types represent deductions. For an unsent payout, the service
recalculates the materialized manual and final totals from the immutable seller
payable/refund base plus every adjustment within a serializable transaction.

For a `SENT` payout, the recorded sent financial amount is never changed. The
service stores a reconciliation-required adjustment and safely places the order
payout state on hold. An administrator must perform any additional external
transfer or recovery outside Trade82; no bank transfer API is implemented.

## Isolated migration and integration audit

The migration and database-backed integration suite were validated on 2026-07-13
with a newly initialized PostgreSQL 16.11 cluster under `/tmp`, controlled by
`initdb` and `pg_ctl`. It listened only on `127.0.0.1` at temporary port `62373`
and used a database with the `trade82_order_payout_test_` prefix. No existing
local database, remote database, Supabase project, or Production environment was
contacted.

`npx prisma migrate deploy` applied all 21 migrations, then `npx prisma migrate
status` reported the disposable schema up to date. The integration audit passed
10 groups covering the 35 required checks: atomic payment/order creation and
rollback, feature-off compatibility, concurrent number allocation, duplicate
payout prevention, simultaneous payout release, refund/dispute holds, immutable
adjustments, authorization and direct-role denial, encrypted account persistence
and historical snapshots, masked CSV output, and idempotent bank seeding.

PostgreSQL metadata confirmed RLS on each new financial table, revoked
`anon`/`authenticated` privileges, the nullable reverse payment-order link,
unique order and payout numbers, and the intended restrictive financial foreign
keys. The temporary cluster was stopped by a trap and its data, socket, log, and
temporary credential paths were removed when the audit completed.
