# BridgeMarket MVP Launch Briefing

## 1. What The App Does

BridgeMarket is a bilingual B2B marketplace connecting verified Korean seller
companies with American buyers. Buyers can browse Korean companies and products,
save listings, send inquiries, complete deals, and publish verified-deal reviews.
Sellers can manage their company and products, respond to buyers, and request
company verification.

## 2. Required Services

- **Clerk**: login, Google authentication, user sessions, Profile, and Security.
- **Supabase Postgres**: durable marketplace data.
- **Prisma ORM**: typed database access and migrations.
- **Supabase Storage**: company logos, product images, and private verification
  documents.
- **Vercel**: Next.js hosting and environment variables.
- **Optional later - Resend**: inquiry, verification, and deal notifications.

Supabase is preferred over Neon for this MVP because one project provides both
Postgres and file storage. Neon is excellent when database branching and
serverless Postgres specialization matter more than an integrated storage layer.

## 3. Where Data Lives

The production database lives in a Supabase Postgres project. Prisma connects
using `DATABASE_URL`. Clerk user IDs are stored as external identity keys; Clerk
remains the source of truth for authentication.

Business-critical records belong in Postgres: users, companies, seller/buyer
profiles, products, verification requests, inquiries, messages, saved items,
deals, and reviews. Browser storage may only hold harmless UI preferences.

## 4. Where Files Live

Supabase Storage bucket `marketplace-assets` is public and stores:

- Public company logos under `company-logos/`
- Public product images under `product-images/`

Supabase Storage bucket `marketplace-private` is private and stores:

- Verification documents under `verification-documents/`
- Contract files under `contract-files/`

Private documents never use a public URL. Authorized access uses a five-minute
signed URL generated server-side.

## 5. Environment Variables

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/signup
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding/buyer

DATABASE_URL=
DIRECT_URL=
ADMIN_EMAILS=t01021102904@gmail.com

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET=marketplace-assets
SUPABASE_PRIVATE_STORAGE_BUCKET=marketplace-private

RESEND_API_KEY=
EMAIL_FROM=
```

Use Supabase's pooled connection string for `DATABASE_URL` and direct connection
string for `DIRECT_URL`. Never commit `.env.local`.

## 6. Already Production-Ready

- Next.js App Router and responsive public pages
- English, Korean, and default-English route structure
- Clerk authentication and Google-login compatibility
- Server-side route protection and email-based admin authorization
- Clerk UserProfile customization with only My Company and My Products
- Public browsing versus protected dashboard/account route separation
- Company verification and critical-field re-review rules at the UI level

## 7. Still MVP-Only

- Initial listing content includes demonstration data.
- Email notifications are optional and not required for launch.
- Payments, escrow, contracts, tax, customs, and regulatory verification are not
  provided by the platform.
- Admin moderation is intentionally simple.
- File malware scanning, image transformations, audit logs, rate limiting,
  backups, legal policies, and formal incident response need further hardening
  before serious commercial scale.

## 8. Launch Checklist

1. Create a Supabase project in a U.S. region near the expected Vercel region.
2. Copy pooled and direct Postgres connection strings.
3. Confirm `marketplace-assets` exists and is public.
4. Confirm `marketplace-private` exists and is private.
5. Do not add browser upload policies; uploads and signed URLs use protected
   server routes with the service role key.
6. Configure all environment variables locally and in Vercel.
7. Run `npx prisma generate`.
8. Run `npx prisma migrate deploy` for shared environments.
9. Configure Clerk production keys, Google OAuth, and allowed redirect URLs.
10. Confirm `ADMIN_EMAILS` contains the administrator's Clerk email.
11. Run lint, typecheck, and production build.
12. Deploy a Vercel preview and complete the manual seller/buyer/admin flow.
13. Review privacy policy, terms, data retention, and document-access rules.
14. Promote the tested preview to production.

## How Core Flows Work

### Verification And Product Visibility

New seller companies start in `pending_review`. Only verified seller companies
are public. Products are public only when their seller company is verified and
the product is active. Critical company changes move a verified company to
`needs_reverification`, immediately hiding the company and its products.

### Completed Deals And Reviews

An inquiry can lead to a Deal. A deal records both companies, optional product,
contract value, currency, status, and confirmations. Reviews are allowed only
for completed deals and participating companies. Public contract display is
chosen per deal/review: hidden, exact, or a privacy-preserving range.

### Deployment

Connect the repository to Vercel, install the Supabase integration or add the
variables manually, and configure Clerk production variables. Database
migrations should run before promoting a tested deployment. For normal releases:

```bash
npm ci
npx prisma generate
npx prisma migrate deploy
npm run lint
npx tsc --noEmit
npm run build
```
