# Trade82 MVP Launch Briefing

## 1. What The App Does

Trade82 is a bilingual B2B marketplace connecting listed Korean seller
companies with American buyers. Buyers can browse Korean companies and products,
save listings, send inquiries, complete deals, and publish completed-deal reviews.
Sellers can manage their company and products, respond to buyers, and request
company profile review.

## 2. Required Services

- **Clerk**: login, Google authentication, user sessions, Profile, and Security.
- **Supabase Postgres**: durable marketplace data.
- **Prisma ORM**: typed database access and migrations.
- **Supabase Storage**: company logos, product images, and private company
  documents.
- **Vercel**: Next.js hosting and environment variables.
- **Optional later - Resend**: inquiry, company review, and deal notifications. See `EMAIL_AUTHENTICATION.md` before enabling email sending.

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

- Company submitted documents under `verification-documents/`
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
DATABASE_POOL_MAX=1
ADMIN_EMAILS=admin@yourdomain.com

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET=marketplace-assets
SUPABASE_PRIVATE_STORAGE_BUCKET=marketplace-private

RESEND_API_KEY=
EMAIL_FROM=
EMAIL_NOTIFICATIONS_ENABLED=false

NEXT_PUBLIC_SITE_URL=https://trade82.com
SITE_URL=https://trade82.com
```

For production sender identity, use a provider-verified domain before setting `EMAIL_FROM` to a branded sender such as `Trade82 <noreply@trade82.com>`.

For Vercel production, `DATABASE_URL` must use the Supabase transaction-mode
pooler URL. `DIRECT_URL` can use the Supabase session/direct URL for migrations
and administrative database operations. Do not use the Supabase session-mode
pooler as the Vercel runtime `DATABASE_URL`; session-mode connections can
exhaust Supabase session clients under serverless concurrency. Keep
`DATABASE_POOL_MAX=1` unless load testing proves a higher per-instance limit is
safe for the selected Supabase plan. Redeploy Vercel after changing any
production environment variable. Never commit `.env.local`.

## 6. Already Production-Ready

- Next.js App Router and responsive public pages
- English, Korean, and default-English route structure
- Clerk authentication and Google-login compatibility
- Server-side route protection and email-based admin authorization
- Clerk UserProfile customization with only My Company and My Products
- Public browsing versus protected dashboard/account route separation
- Company profile review and critical-field re-review rules at the UI level

## 7. Still MVP-Only

- Public listing pages are database-backed and show empty states when no
  company or product records are listed.
- Email notifications are optional and not required for launch.
- Payments, escrow, contracts, tax, customs, and regulatory review are not
  provided by the platform.
- Admin moderation is intentionally simple.
- File malware scanning, image transformations, audit logs, and formal incident
  response need further hardening before serious commercial scale.
- Rate limiting is in-memory (per process). For multi-instance deployments,
  replace with Redis-backed rate limiting (e.g. `@upstash/ratelimit`).

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

### Company Review And Product Visibility

New seller companies start in `pending_review`. Only listed seller companies
are public. Products are public only when their seller company is listed and
the product is active. Critical company changes move a listed company to
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

---

## Backup and Recovery Runbook

### What to Back Up

| Data | Where | Backup method |
|------|-------|---------------|
| All marketplace records | Supabase Postgres | Confirm automatic backups manually in Supabase dashboard; see `BACKUP_AND_RECOVERY.md` |
| Company logos / product images | Supabase Storage `marketplace-assets` | Public assets are usually re-uploadable; follow Supabase storage backup procedures if needed |
| Company submitted documents / contracts | Supabase Storage `marketplace-private` | Private files need restricted provider-managed backups; never export to public buckets or Git |
| User accounts | Clerk | Clerk manages its own infrastructure; export via Clerk dashboard if needed |
| Environment secrets | Vercel / 1Password | Store a copy of all env values in a password manager, not in the repo |

### Supabase Backup Frequency

- **Automatic**: Confirm the backup feature, retention period, and latest successful backup in the Supabase dashboard. This repository cannot prove backups are enabled.
- **Manual backup template**: Use the placeholder-only commands in `BACKUP_AND_RECOVERY.md`; never paste a real database URL into docs or Git.
- **Recommended cadence before major releases**: create a manual backup and store it outside the repository in an approved encrypted location.

### Recovery Steps

1. **Database corruption or accidental deletion**
   - Log in to Supabase dashboard → Project → Backups → Restore point.
   - For point-in-time recovery (PITR), enable it in Supabase Pro settings before you need it.
   - After restore, re-run `npx prisma migrate deploy` to confirm schema state.

2. **Supabase project deleted**
   - Create a new Supabase project.
   - Restore to staging first using the placeholder restore templates in `BACKUP_AND_RECOVERY.md`.
   - Re-create storage buckets `marketplace-assets` (public) and `marketplace-private` (private).
   - Re-upload or recover files through approved Supabase/storage-provider procedures.
   - Update Vercel environment variables (`DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL`, etc.).
   - Redeploy on Vercel.

3. **Vercel deployment failure**
   - Roll back: Vercel dashboard → Deployments → select last good deployment → Promote.
   - Fix the build locally (`npm run build`), push fix, and redeploy.

4. **Clerk outage**
   - Authentication is unavailable; app public pages remain accessible.
   - No action required — Clerk handles its own recovery.
   - Status: https://status.clerk.com

5. **Data breach or unauthorized access**
   - Rotate all secrets immediately: `CLERK_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`.
   - Update all rotated values in Vercel and redeploy.
   - Revoke Supabase service role key and generate a new one.
   - Audit Supabase access logs and Vercel function logs for scope of access.
   - Notify affected users within 72 hours per GDPR if user PII was exposed.

### Pre-Launch Backup Checklist

- [ ] Supabase automatic backup status, retention, and latest backup manually confirmed
- [ ] Manual SQL dump taken and stored securely outside Supabase
- [ ] All env secrets stored in a password manager
- [ ] Private storage recovery procedure confirmed without exposing files publicly
- [ ] Recovery steps tested in a staging environment

---

## Error Tracking and Logs

### Current Logging Strategy

Trade82 does not yet integrate a third-party error tracker. Errors surface
through three channels:

1. **Vercel Function Logs** — All server-side exceptions appear in the Vercel
   dashboard under Deployments → Functions → Logs. This is the primary debugging
   surface for production API errors.
2. **Supabase Logs** — Database query errors appear in the Supabase dashboard
   under Logs → Postgres. Useful for diagnosing schema or constraint violations.
3. **Next.js console output** — In development, all errors print to the terminal.

All API routes use a shared `apiError()` wrapper (`src/lib/api-response.ts`).
It logs errors server-side and returns a safe JSON response without leaking
internal detail to the client.

### Sentry Integration (Recommended Next Step)

To add Sentry error tracking:

1. Install: `npm install @sentry/nextjs`
2. Run: `npx @sentry/wizard@latest -i nextjs`
3. Set `SENTRY_DSN=<your-dsn>` in `.env.local` and Vercel environment variables.
4. Wrap server-side handlers with `Sentry.withSentry()` or use the auto-instrumentation from the wizard.
5. The env placeholder is already in `.env.example`.

### What to Monitor

| Signal | Source | Action threshold |
|--------|--------|-----------------|
| 5xx API errors | Vercel Function Logs / Sentry | Alert if >1% of requests |
| Database connection failures | Supabase Logs | Alert immediately |
| Upload failures | Vercel Logs | Alert if >5 in 5 minutes |
| Rate limit hits (429) | Vercel Logs | Investigate if sustained — may indicate abuse |
| Slow queries (>2s) | Supabase Logs | Investigate indexes |

### Log Hygiene Rules

- Never log secrets, tokens, or full request bodies containing user PII.
- `apiError()` logs `error.message` only, not stack traces in production.
- The `console.error` output in Vercel Functions is retained for 7 days by default on the Pro plan.
