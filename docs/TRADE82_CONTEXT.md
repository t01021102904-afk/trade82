# Trade82 System Context

Last repository review: 2026-07-25

This document is the durable architecture and operations reference for Trade82.
It was assembled from the current repository, Prisma schema, routes, libraries,
tests, migration history, and GitHub PR history. Re-check the implementation
before making consequential changes.

## 1. Business purpose

Trade82 is a bilingual B2B marketplace for Korean products. Its primary users
are:

- Korean sellers that publish products, receive inquiries, quote RFQs, manage
  deals, request payment, fulfill orders, and provide payout instructions.
- Global buyers that discover Korean products and verified suppliers, create
  inquiries and RFQs, communicate with sellers, and pay approved requests.
- Partners that refer users, monitor referral analytics, and provide a Korean
  payout profile for reviewed referral commissions.
- Administrators that review companies, RFQs, payments, payouts, partners,
  bank-directory entries, and settlement operations.

The public site also contains marketplace discovery, supplier pages, partner
program information, and legal/operational documents.

## 2. Technology stack

The current stack is defined by `package.json` and the application source:

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS
- Clerk for identity and sessions
- Prisma 7 with the PostgreSQL adapter
- Supabase Postgres as the application database
- Supabase Storage for public images and private documents
- Stripe for Checkout, webhooks, Connect onboarding, and guarded settlement
  execution services
- Custom dictionary-based English/Korean localization
- Node test runner and Playwright
- Vercel for Preview and Production deployment

Important references:

- `package.json`
- `src/app/`
- `src/lib/db.ts`
- `src/lib/supabase-storage.ts`
- `src/lib/stripe.ts`
- `prisma/schema.prisma`

## 3. Service responsibilities

### Clerk

Clerk is the authentication source of truth. It owns user identities, sessions,
sign-in, sign-up, and public metadata used during routing. Clerk middleware
protects application routes in `src/proxy.ts`.

The application maps a Clerk identity to `UserProfile.clerkUserId`. Account
creation and recovery deliberately avoid unsafe email-based relinking after
account deletion. Relevant code:

- `src/lib/clerk-identity.ts`
- `src/lib/authz.ts`
- `src/lib/require-auth.ts`
- `src/lib/fresh-user-profile.ts`
- `src/lib/account-deletion.ts`

Supabase Auth is not used.

### Prisma and PostgreSQL

Prisma defines application records, relations, enums, indexes, and generated
types. PostgreSQL is accessed through `@prisma/adapter-pg` in `src/lib/db.ts`.

The schema includes users, companies, products, inquiries, messages, RFQs,
deals, payment requests, orders, payout profiles, payouts, partner referrals,
Stripe-connected account records, settlement ledgers, reversals, workers, and
operational alerts.

Schema and migration references:

- `prisma/schema.prisma`
- `prisma/migrations/`
- `src/generated/prisma/`
- `scripts/run-production-migrations.mjs`

### Supabase

Supabase provides:

- The Production PostgreSQL project used by Prisma.
- Public Storage for listing images and avatars.
- Private Storage for verification documents and contract files.

Server-side Storage access uses a service credential in
`src/lib/supabase-storage.ts`. Never expose that credential to clients or
documentation. Storage validation checks type, extension, size, visibility,
and suspicious filenames.

### Stripe

Stripe currently supports several separate concerns:

- Checkout and PaymentIntent evidence for message payment requests.
- Stripe webhooks for payment, refund, and dispute reconciliation.
- Legacy Separate Charges and Transfers settlement records and guarded
  Transfer/Reversal services.
- Connect onboarding for transfer recipients.
- Separate seller merchant onboarding for future Direct Charge behavior.

The code parses missing or unknown transfer/reversal execution modes as `off`.
Do not infer the actual Production environment state without a read-only Vercel
audit. Do not mix legacy SCT settlement execution with `DIRECT_CHARGE` rows.

Key references:

- `src/lib/payment-requests.ts`
- `src/app/api/stripe/webhook/route.ts`
- `src/lib/stripe-connect-settlements.ts`
- `src/lib/stripe-connect-transfer-execution.ts`
- `src/lib/stripe-connect-transfer-reversal-execution.ts`
- `src/lib/settlement-operations-control-plane.ts`
- `src/lib/stripe-connect-onboarding.ts`
- `src/lib/stripe-direct-charge-merchant.ts`

## 4. Identity, roles, and authorization

`UserProfile.role` uses the `AccountRole` enum:

- `user`
- `seller`
- `buyer`
- `both`
- `admin`

There is intentionally no `partner` value.

### Seller and buyer

A seller or buyer business is an owned `Company` with `companyRole` equal to
`seller` or `buyer`. Seller and buyer details live in `SellerProfile` and
`BuyerProfile`. A user can own both company roles.

Public company/product visibility requires a non-deleted, verified company and
an active product. Server ownership and role checks live in `src/lib/authz.ts`.

### Partner

A partner is a `PartnerProfile` owned by a `UserProfile`. Partner status is
`PENDING_REVIEW`, `ACTIVE`, `SUSPENDED`, or `REJECTED`; current enrollment code
and the latest activation migration produce active profiles under the current
product flow.

A partner-only account means:

- A non-deleted PartnerProfile exists.
- No buyer company exists.
- No seller company exists.

This classification is independent of the stored `AccountRole`. Partner-only
users route to the localized partner dashboard and receive partner-specific
header navigation.

References:

- `src/lib/partner-account-routing.ts`
- `src/lib/owned-partner-profile.ts`
- `src/lib/require-auth.ts`
- `src/lib/public-navigation.ts`
- `src/components/site-header.tsx`

### Administrator

Admin authorization is server-side. `src/lib/authz.ts` resolves administrators
from a server-only allowlist and requires a current Clerk identity and local
profile. Admin links in the UI are convenience only; admin APIs must call the
server authorization helpers.

### Route protection

`src/proxy.ts` protects dashboards, messages, onboarding, admin, deals,
settings, and seller management routes. API routes repeat authorization and
ownership checks because middleware or hidden UI is not sufficient.

## 5. Core product domains

### Marketplace and sellers

The public marketplace reads active products belonging to verified,
non-deleted seller companies. First-page data is server-rendered with
pagination and filters, then client interactions use the public API.

References:

- `src/app/marketplace/page.tsx`
- `src/app/ko/marketplace/page.tsx`
- `src/app/api/public/marketplace/route.ts`
- `src/lib/public-marketplace-data.ts`
- `src/components/marketplace-client.tsx`
- `src/lib/public-marketplace-client-state.ts`
- `src/app/sellers/page.tsx`

### Inquiries and messages

Buyers contact sellers through `Inquiry` records. Messages belong to an
inquiry and support guarded image/document attachments. The message UI also
displays payment requests and deal controls without treating synthetic
timestamps as financial evidence.

References:

- `src/app/api/inquiries/`
- `src/app/messages/page.tsx`
- `src/components/messages-client.tsx`
- `src/lib/message-attachments.ts`
- `src/app/api/messages/`

### RFQ

Buyers create RFQs; administrators review them; eligible sellers can receive
matches, submit quotes, and negotiate through quote chat.

References:

- `src/app/dashboard/rfqs/`
- `src/app/api/rfqs/`
- `src/lib/rfq-db.ts`
- `src/lib/rfq.ts`

### Deals and reviews

Deals connect buyer companies, seller companies, products, and optional
inquiries. Statuses include proposed, in progress, completion requested,
completed, cancelled, and disputed. Reviews are tied to completed trade
relationships.

References:

- `src/app/api/deals/`
- `src/app/deals/[id]/review/page.tsx`
- `src/lib/message-trade-ui.ts`
- `prisma/schema.prisma` models `Deal`, `Review`, and `CompanyReview`

### Payment requests

Sellers can create message-linked USD payment requests. Stripe Checkout starts
from a protected endpoint. Webhooks verify stored Checkout Session,
PaymentIntent, amount, currency, metadata, and order evidence before mutating
payment state.

References:

- `src/app/api/inquiries/[id]/payment-requests/route.ts`
- `src/app/api/payment-requests/[id]/checkout/route.ts`
- `src/lib/payment-requests.ts`
- `src/app/api/stripe/webhook/route.ts`

### Orders

Each payment request creates a linked `TradeOrder` with immutable buyer,
seller, product, and financial snapshots. Payment, refund, dispute, shipment,
and payout events update the order lifecycle without rewriting history.

References:

- `src/lib/trade-orders.ts`
- `src/app/api/orders/`
- `src/components/orders-client.tsx`
- `prisma/schema.prisma` models beginning with `TradeOrder`

### Seller payouts

The current seller payout system supports reviewed manual bank processing.
Sensitive beneficiary details are encrypted; normal responses expose masked
fields only. Admin reveal, export, adjustment, and status changes are audited.

References:

- `src/lib/seller-payouts.ts`
- `src/lib/seller-payout-profiles.ts`
- `src/lib/payout-crypto.ts`
- `src/app/api/admin/payouts/`
- `docs/ORDER_MANUAL_PAYOUT_MIGRATION.md`

### Partner referrals and payouts

Referral links use opaque claim evidence and lock the first valid attribution
to a referred `UserProfile`. Analytics aggregate visits and conversions
without storing raw visitor identifiers. Partner payout profiles support
reviewed Korean bank-account information.

References:

- `src/app/r/[referralCode]/route.ts`
- `src/lib/partner-referrals.ts`
- `src/lib/partner-referral-analytics.ts`
- `src/lib/partner-enrollment.ts`
- `src/lib/partner-payout-profiles.ts`
- `src/app/partner/dashboard/page.tsx`

The proposed unified manual partner payout review remains in open Draft PR
#52 and is not part of current `main`; see `docs/CURRENT_WORK.md`.

### Settlement ledger and operations

`Settlement` snapshots verified payment and referral data. `SettlementLeg`
stores immutable seller, partner, and platform amounts. Reversals, events,
worker runs, and operational alerts provide auditable recovery and control
planes.

Legacy SCT workers exclude `DIRECT_CHARGE` rows. Transfer and reversal
services are guarded by execution mode, authorization, row/advisory locking,
idempotency, retry limits, and sanitized errors.

References:

- `src/lib/stripe-connect-settlements.ts`
- `src/lib/stripe-connect-settlement-reconciliation.ts`
- `src/lib/stripe-connect-transfer-execution.ts`
- `src/lib/stripe-connect-transfer-reversal-execution.ts`
- `src/lib/settlement-operations-control-plane.ts`
- `src/app/admin/settlements/`
- `src/app/api/internal/settlements/workers/`

## 6. Public and private page structure

Public discovery and document routes include:

- `/`
- `/marketplace`
- `/products/[id]`
- `/sellers`
- `/companies/[id]`
- `/buyers` and `/buyers/[id]`
- `/stores/[id]`
- `/partner`
- legal and guide pages such as `/terms`, `/privacy`, and `/faq`

Authenticated application routes include:

- `/dashboard` and role dashboards
- `/messages`
- `/onboarding/*`
- `/settings/*`
- `/sell`
- `/orders`
- `/deals/*`
- `/admin/*`

Some public pages are dynamic because they read user or database context.
Never infer privacy from route naming alone; inspect metadata, middleware, and
server authorization.

## 7. Locale and URL policy

English canonical URLs are unprefixed:

- `/`
- `/marketplace`
- `/sellers`

Korean URLs use `/ko`:

- `/ko`
- `/ko/marketplace`
- `/ko/sellers`

Legacy `/en` routes redirect permanently to unprefixed English through
`src/proxy.ts` and `src/lib/english-canonical-path.ts`. Some `/en` route files
remain as compatibility entry points, but canonical and sitemap signals must
not use `/en`.

Translations live in:

- `messages/en.json`
- `messages/ko.json`

Use `withLocale` and the existing localized route helpers. Keep translation
key structure aligned across languages.

## 8. SEO structure

SEO metadata is assembled through:

- `src/app/layout.tsx`
- `src/lib/seo.ts`
- route-level `generateMetadata`
- `src/app/sitemap.ts`
- `src/app/robots.ts`

Policy:

- English canonical: unprefixed URL.
- Korean canonical: corresponding `/ko` URL.
- Alternates: `en`, `ko`, and `x-default`.
- Sitemap: canonical English and Korean URLs only.
- Public product/company timestamps use stored update data where available.
- Private auth and application pages retain `noindex` behavior.

PR #71 added the Naver Search Advisor ownership metadata through
`metadata.verification.other` in `src/app/layout.tsx`. The exact public
verification value has a focused regression test in
`tests/naver-site-verification.test.ts`.

## 9. Deployment and migrations

Vercel deploys the repository from the `main` branch. Preview deployments are
created for PRs, subject to Preview Protection and available environment
configuration.

The build command is:

```bash
node scripts/run-production-migrations.mjs && next build
```

The Production migration runner is fail-closed and allowlists specific
committed migrations. It verifies the Supabase project identity, migration
history, prerequisites, resulting schema, RLS, and privileges. Do not casually
extend its allowlist or turn historical initial-state checks into permanent
schema invariants.

Migration rules:

- Read the entire migration history before adding a migration.
- Use additive migrations for financial and operational history.
- Never edit an applied migration.
- Never use Production as a test database.
- Use a new empty disposable PostgreSQL database for full-history validation.
- Do not run manual SQL or `prisma migrate resolve` without an explicit,
  reviewed recovery procedure.

`vercel.json` currently registers the settlement release Cron every 15 minutes.
Do not infer execution or money movement from Cron registration; routes and
execution modes are separately guarded.

## 10. Security and operating principles

- Server authorization is authoritative; hidden controls are not security.
- Validate ownership, role, resource state, and same-origin requirements.
- Preserve immutable financial snapshots and audit events.
- Encrypt bank-account and beneficiary data and return masked fields.
- Keep public and private Storage paths separate.
- Never log raw Stripe responses, credentials, connection strings, bank data,
  or personal information.
- Use deterministic idempotency keys for financial operations.
- Use row locks/advisory locks and ownership tokens around external calls.
- Treat retries after uncertain external results as recovery, not new logical
  attempts.
- Keep `off` as the fail-closed default for execution features.
- Do not change global CSS to solve a local UI bug.
- Reproduce browser failures and inspect the actual stack before fixing them.

## 11. Validation map

Baseline:

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
git diff --check
```

Additional suites are available in `package.json`, including:

- Marketplace Playwright search E2E
- Partner routing Playwright E2E
- Payment and order tests
- Order/manual-payout PostgreSQL integration
- Partner analytics PostgreSQL integration
- Settlement worker and catalog integration
- Production migration runner tests

Browser E2E that requires authenticated session-state files must be reported as
skipped when those files are unavailable.

## 12. Source-of-truth warning

`README.md` describes an earlier MVP and currently says payments are not
included. The repository now contains payment requests, orders, payouts,
settlements, partner referrals, Stripe webhooks, and operational tooling.

When prose conflicts:

1. Inspect current route and service code.
2. Inspect `prisma/schema.prisma`.
3. Inspect committed migrations and generated types.
4. Inspect current tests.
5. Use GitHub PR history only as supporting context.

Continue with `docs/CURRENT_WORK.md` before starting a new task.
