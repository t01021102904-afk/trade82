# Trade82 Phase 1 Message Payments: Staging Runbook

## Safety boundary

This runbook is for a separate staging environment only. Never use a production Supabase project, production Vercel variables, `trade82.com`, Stripe live-mode keys, or a Stripe production webhook endpoint. The Phase 1 migration creates payment tables and foreign keys; application code must not reach production until that migration has been deliberately applied to the isolated staging database and the flow is verified.

The repository preflight reads **only exported process variables**. It deliberately does not load `.env`, `.env.local`, or `.env.production.local`, because they may target an unsafe environment.

## 1. Create a separate Supabase staging project

1. In Supabase, create a new project dedicated to Trade82 staging. Do not clone or point at the production project.
2. Record the staging project reference. Use it only as the non-secret value of `TRADE82_STAGING_SUPABASE_PROJECT`.
3. In the staging project dashboard, obtain the pooled PostgreSQL URL for `DATABASE_URL` and the direct PostgreSQL URL for `DIRECT_URL`.
4. Obtain the staging project URL, anon key, and service-role key. Create the required staging storage buckets before testing uploads.
5. Confirm that the project reference embedded in both database URL usernames matches the URL subdomain of `NEXT_PUBLIC_SUPABASE_URL`.

## 2. Configure Vercel Preview variables

In Vercel, open the Trade82 project and create variables with the **Preview** scope for the staging branch or staging deployment. Do not edit Production-scoped values and do not alter the existing project binding.

Required staging values:

| Variable | Purpose | Required by preflight |
| --- | --- | --- |
| `TRADE82_ENVIRONMENT` | Explicit safety marker. Set exactly `staging`. | Yes |
| `TRADE82_STAGING_SUPABASE_PROJECT` | Staging Supabase project reference, not a secret. | Yes |
| `DATABASE_URL` | Staging pooled PostgreSQL URL used by the application. | Yes |
| `DIRECT_URL` | Staging direct PostgreSQL URL used by Prisma configuration. | Yes |
| `NEXT_PUBLIC_APP_URL` | Staging HTTPS deployment URL, never `https://trade82.com`. | Yes |
| `NEXT_PUBLIC_SUPABASE_URL` | Staging Supabase project URL. | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Staging Supabase anon key. | App |
| `SUPABASE_SERVICE_ROLE_KEY` | Staging-only server key. | App |
| `SUPABASE_STORAGE_BUCKET` | Staging public upload bucket. | App |
| `SUPABASE_PRIVATE_STORAGE_BUCKET` | Staging private upload bucket. | App |
| `SUPABASE_DOCUMENT_STORAGE_BUCKET` | Staging seller-document bucket. | App |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk environment used by staging. | App |
| `CLERK_SECRET_KEY` | Matching staging Clerk secret. | App |
| `STRIPE_SECRET_KEY` | Stripe **test-mode** secret key (`sk_test_...`). | Yes |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe **test-mode** publishable key (`pk_test_...`). | Yes |
| `STRIPE_WEBHOOK_SECRET` | Secret from the staging Stripe test webhook endpoint. | Yes |

Configure these only if the associated feature is enabled in staging: `STRIPE_MARKETING_LANDING_7D_PRICE_ID`, `STRIPE_MARKETING_LANDING_30D_PRICE_ID`, `STRIPE_MARKETING_LANDING_90D_PRICE_ID`, `STRIPE_VERIFIED_SELLER_PRICE_ID`, `STRIPE_SUPPORT_STARTER_PRICE_ID`, `STRIPE_SUPPORT_GROWTH_PRICE_ID`, and `STRIPE_SUPPORT_FULL_PRICE_ID`. All must be Stripe test-mode Price IDs.

Optional runtime values are `DATABASE_POOL_MAX`, `ADMIN_EMAILS`, `EMAIL_NOTIFICATIONS_ENABLED`, `RESEND_API_KEY`, `EMAIL_FROM`, `NEXT_PUBLIC_SITE_URL`, `SITE_URL`, `OPENAI_API_KEY`, and `OPENAI_TRANSLATION_MODEL`. Keep email notifications disabled until staging email recipients are intentionally configured.

## 3. Configure Stripe test mode

1. Switch the Stripe dashboard to **Test mode**.
2. Create or select test-mode Prices for any enabled billing or marketing flows.
3. Create a test-mode webhook endpoint at `https://<staging-domain>/api/stripe/webhook`.
4. Store that endpoint's signing secret as `STRIPE_WEBHOOK_SECRET` in Vercel Preview only.
5. Confirm in the Stripe dashboard that the endpoint is test-mode. A `whsec_...` value does not encode test versus live mode, so this dashboard confirmation is mandatory.

Subscribe the staging endpoint to the events handled by the current webhook code:

```text
checkout.session.completed
checkout.session.async_payment_succeeded
payment_intent.succeeded
refund.created
refund.updated
charge.dispute.created
charge.dispute.updated
charge.dispute.closed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
invoice.payment_succeeded
invoice.payment_failed
```

## 4. Prove the staging target before migration

Use a temporary, untracked staging environment file outside the repository, then export it into the current shell. Do not copy values into `.env*` and do not commit it.

```bash
set -a
source /secure/path/trade82-staging.env
set +a
NODE_ENV=development npm run staging:payments:check
```

The command must pass before any Prisma command that can connect to the database. It checks the explicit staging marker, matching Supabase project references, test-mode Stripe keys, non-production app URL, and production Vercel indicators. It never modifies the database.

If the command fails, stop. Correct the exported staging variables or recreate the isolated project; do not bypass the check.

## 5. Validate and apply the staging migration

After preflight passes, run:

```bash
npx prisma format
npx prisma validate
npx prisma generate
npx prisma migrate status
npx prisma migrate deploy
npx prisma migrate status
```

Only the separate staging database may receive `20260713090000_add_message_payment_requests`. Never run `prisma migrate reset`, `prisma db push`, `prisma migrate dev` against a shared database, or destructive SQL against application records.

The migration adds `PaymentRequest`, `PaymentRequestEvent`, `PaymentRequestWebhookEvent`, `PaymentRefund`, and `PaymentDispute` plus restrictive foreign keys. It does not delete, truncate, or alter existing `Inquiry` or `Message` records.

## 6. Deploy and roll back staging safely

Deploy the `staging/message-payment-phase1` branch only as a Vercel Preview deployment. Verify its deployment URL matches `NEXT_PUBLIC_APP_URL` and is not a production alias.

If testing fails, stop routing testers to the Preview deployment or roll that Preview deployment back in Vercel. Do not promote it, do not merge into `main`, and do not attempt a destructive down migration. If a clean database is required, create a new disposable staging Supabase project or restore a staging-only backup under the account owner's supervision.

## 7. Why production must wait

The payment routes reference the payment tables introduced by the migration. Deploying those routes before the production schema has been approved and migrated can cause runtime failures. Staging must demonstrate database isolation, Stripe test-mode webhook confirmation, and the full regression checklist before any production change is considered.
