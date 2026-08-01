# Supplier Onboarding Pivot Audit

Date: 2026-08-01
Working branch: `pivot/supplier-application-v1`
Base: `origin/main` at `fe61407dbb45c6cd972636c20d44e34f84da794e`

> The requested `셀러가입(3).md` source document was not present in the
> repository or supplied attachment directories at audit time. This audit and
> implementation therefore use the supplied task specification as the working
> product source of truth. Any later copy of that document must be reconciled
> before Production rollout.

## 1. Current seller route flow

1. Clerk protects `/onboarding/*`, `/dashboard/*`, and `/sell` in
   `src/proxy.ts`. It adds `x-trade82-locale` and redirects `/en/*` paths to
   canonical unprefixed English paths where applicable.
2. Role selection stores `UserProfile.role` and Clerk public metadata. The
   server subsequently infers seller/buyer roles from owned `Company` rows in
   `src/lib/onboarding-status.ts`.
3. `/onboarding/seller`, `/en/onboarding/seller`, and
   `/ko/onboarding/seller` call `requireOnboardingRole()` and render either
   the shared `OnboardingForm kind="seller"` or `SellerPayoutOnboardingStep`.
4. The shared seller form saves a seller company, then asks for payout data,
   personal profile data, and a first product. Its product step posts an
   **active** product and completes onboarding to `/dashboard/seller`.
5. `/sell` renders `ListingPage`; `requireDashboardRole(..., "seller")`
   admits any `seller`/`both` role with completed legacy onboarding.
6. `/dashboard/seller` also admits a `seller`/`both` role through the same
   legacy role guard. `/api/dashboard/summary?role=seller` uses the owned
   seller company directly.

## 2. APIs and records mutated by the legacy flow

| Stage | API | Current records / effect |
| --- | --- | --- |
| Company step | `PUT /api/account/company` | Upserts `Company` with `companyRole=seller`, upserts `SellerProfile`, and creates a pending `VerificationRequest` for a new seller. |
| Private document in company step | `POST /api/uploads` with `verification_document` | Writes to the private Supabase bucket; the current upload policy requires an existing company. |
| Payout step | `PUT /api/account/payout-profile` | Creates or updates encrypted `SellerPayoutProfile` data and specialized payout audit records. |
| Personal step | `PUT /api/account/profile` | Updates `UserProfile` contact/profile fields. |
| First product | `POST /api/account/products` | Creates a `Product`; legacy form requests `status: active`, subject only to existing image/product validation. |
| Completion | `POST /api/user/onboarding` | Marks Clerk `onboardingComplete=true` after seller company and payout profile exist. |

## 3. Current seller authorization and product/payout coupling

- `requireSeller()` checks `UserProfile.role` is `seller`/`both` and returns
  the owned seller company. It does **not** require supplier approval.
- `requireDashboardRole(..., "seller")` permits the seller dashboard based on
  that role and legacy completion state.
- Product create/update/delete, bulk template/validate/import, product image
  uploads, document folders/documents, payout-profile endpoints, marketing
  exposure checkout, and seller dashboard summary currently depend on this
  role/company check. Product and bulk routes therefore need server-side
  supplier capability gates, not merely hidden UI.
- `requireVerifiedSeller()` is available but only checks
  `Company.verificationStatus === verified`; it is not the complete new
  supplier policy and is not consistently used by seller operations.
- The current flow treats a `SellerPayoutProfile` as a condition for legacy
  seller onboarding completion. The pivot must make settlement setup an
  application section and must not require Stripe Connect or a bank account
  before the short application is submitted.

## 4. Existing models and reusable infrastructure

| Existing domain | Reuse decision |
| --- | --- |
| `UserProfile` / Clerk identity | Reuse as applicant identity and server-side actor. Clerk remains the authentication source of truth. |
| `Company` and `SellerProfile` | Keep as approved/live seller domain only. Do not create either from a new draft application. Link an approved application to an existing company or create them once, idempotently, at approval. |
| `Product` / `ProductImage` | Keep unchanged; no draft application creates live products. Inventory samples are a new pre-approval model/file domain. |
| `SellerPayoutProfile` | Keep encrypted live payout implementation intact. Add separate application settlement data and only bridge it after review/approval. |
| `VerificationRequest` | Preserve for legacy company verification. It is too narrow for staged supplier review, so it is not the Supplier Application state machine. |
| `TradeDocument` / `DocumentFolder` | Preserve for approved-company workflows. Application documents need independent private-object ownership before a Company exists. |
| `SellerPayoutProfileAuditEvent` / other specialized audits | Reuse the style, not the table. There is no general `AuditLog` model and no `CompanyMember` model in the current schema. Add an application-scoped audit trail and status history. |
| `src/lib/supabase-storage.ts` | Reuse validation, filename sanitization, private bucket upload, deletion, and short-lived signed URL helpers. Extend upload types only for application documents/inventory samples. |

## 5. Code to replace or redirect

- Replace seller-only rendering in the three `/onboarding/seller` pages with
  a canonical Supplier Application entry/redirect. Keep buyer onboarding and
  its `OnboardingForm kind="buyer"` untouched.
- Remove seller-specific company, payout, personal, and first-product stages
  from `OnboardingForm`; do not remove the buyer form or its APIs.
- Convert `/sell` from the active listing form to a public Supplier Program
  page. Existing seller product creation moves behind approved supplier
  permission checks and seller-dashboard navigation.
- Replace seller dashboard and listing route decisions based solely on
  `requireDashboardRole()` with a supplier access resolver that routes a
  pending applicant to application status/workspace and a suspended supplier
  to a suspension notice.
- Retain existing admin company verification pages and APIs for the legacy
  company domain. Add distinct supplier-application list/detail routes and
  do not overload `VerificationRequest` status mutations.

## 6. Existing seller data and legacy policy

No existing `Company`, `SellerProfile`, `Product`, payout profile, or Clerk
identity will be deleted or rewritten by the migration.

The backfill script will default to `--dry-run` and be idempotent by a unique
legacy company link. It will classify seller companies using actual existing
fields:

- `LEGACY_CONDITIONALLY_APPROVED`: non-deleted seller `Company` with
  `verificationStatus=verified` and a `SellerProfile`; preserves normal live
  trading access until the policy owner chooses re-verification.
- `REVERIFICATION_REQUIRED`: non-deleted seller company in
  `needs_reverification` or `pending_review`, or a verified company lacking a
  seller profile/payout readiness signal.
- `APPLICATION_REQUIRED`: remaining non-deleted seller company records.

The script will create a prefilled, non-duplicated application linked to the
same live company and owner. It will never alter existing Product IDs or
visibility as part of the backfill.

## 7. Security and migration risks

- New application tables are in the `public` schema but are used only by the
  server-side Prisma connection. The migration will enable RLS and revoke
  direct `anon`/`authenticated` access so Supabase Data API exposure cannot
  bypass Clerk/application authorization.
- Application private documents must use the existing private bucket and
  server-issued short-lived signed URLs. The service key remains server-only.
- Sensitive bank/tax fields are stored separately from ordinary application
  responses; list/status APIs return masked values only. Their values must
  not enter audit metadata, error messages, or logs.
- All write endpoints require Clerk-backed local user identity, ownership or
  server-side admin authorization, same-origin checks, rate limits, status
  transition validation, and audit events.
- Approval is the only path that creates/links live `Company` and
  `SellerProfile`; it requires a transaction and deterministic idempotency.
- The production migration allowlist currently treats recent application
  migrations as deferred. This migration must be added to the deferred list,
  not applied to Production in this work.
- No `SECURITY DEFINER` functions, public signed URLs, broad cascade deletes,
  destructive schema changes, or Supabase Auth introduction are planned.

## 8. Planned file changes

- `prisma/schema.prisma` and one additive migration: Supplier Application
  entities, enums, indexes, RLS/revocations, and no destructive changes.
- `src/lib/supplier-application*.ts`: state machine, capability resolver,
  applicant/admin serialization and validation, audit, approval, and legacy
  backfill helpers.
- `src/app/api/supplier-applications/**` and
  `src/app/api/admin/supplier-applications/**`: applicant/admin route
  handlers.
- `src/app/seller/apply/**`, localized variants, and
  `src/app/admin/supplier-applications/**`: supplier workspace and admin UI.
- `src/components/supplier-application*.tsx`: shadcn, token-based applicant
  and admin surfaces.
- `src/app/onboarding/seller/**`, `src/components/onboarding-form.tsx`,
  `src/app/sell/**`, `src/lib/require-auth.ts`, `src/lib/authz.ts`, seller
  product/upload/order/payout entry points, and seller dashboard pages:
  route and server-side capability gates.
- `src/lib/supabase-storage.ts` and `src/app/api/uploads/route.ts`: private
  Supplier Application document/inventory sample uploads.
- `scripts/backfill-supplier-applications.ts`, English/Korean message files,
  production-migration policy test/configuration, and dedicated regression
  tests.

## 9. Scope boundaries

The pivot will not redesign Product Master/Supplier Offers, buyer onboarding,
Stripe payment/settlement/referral implementation, order allocation, shipping,
or actual FTP/API/ERP inventory integrations. It will add permission gates at
their seller entry points without changing their business/financial models.

## 10. Implementation note: shared legacy form

`OnboardingForm` is intentionally retained as a buyer-only rendered component
in this change. It still contains legacy seller branches so the mature buyer
flow is not rewritten as part of this security pivot, but no seller route
imports it: all three seller onboarding routes now redirect to the Supplier
Application workspace. The legacy seller company, product, bulk upload,
document, payout, dashboard, and order write paths are server-side
capability-gated, so an unapproved user cannot reactivate those dormant
branches by calling their APIs directly. Removing the unreachable seller-only
implementation from the shared form is safe follow-up cleanup after the
Supplier Application workflow has been released and the buyer form has a
dedicated component boundary.
