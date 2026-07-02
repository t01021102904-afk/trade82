# Trade82 Public Launch Overview

This document is safe for a public repository. It summarizes the product,
architecture, and public launch considerations without exposing private
operations, credentials, or provider-specific recovery procedures.

## Product Summary

Trade82 is a bilingual B2B marketplace that connects Korean sellers with
American buyers. Sellers can manage company profiles and product listings.
Buyers can discover products, save items, send inquiries, and continue
conversations through the platform.

Trade82 provides marketplace software and communication tools. It does not
provide payment protection, escrow, customs brokerage, legal advice, or a
guarantee of transaction outcomes.

## Core Services

- Next.js App Router for the web application.
- Clerk for authentication and user sessions.
- Supabase Postgres for marketplace data.
- Prisma for typed database access and migrations.
- Supabase Storage for public listing images and private submitted files.
- Optional transactional email through a configured email provider.

## Runtime Configuration

Runtime configuration must be supplied through local `.env.local` files or
deployment provider environment variables. Real values must never be committed.

Use `.env.example` as the placeholder-only reference for required variable
names.

Important categories:

- Clerk public and server-side keys.
- Database connection strings.
- Supabase public and service-role keys.
- Storage bucket names.
- Admin email allowlist.
- Site URL values.
- Optional email and error-tracking configuration.

## Data and File Handling

Application records live in the database. Public marketplace images live in the
public storage bucket. Private submitted files must remain in private storage
and be accessed only through authorized server-side flows.

Do not store private user data, database exports, private documents, signed
URLs, or environment secrets in the repository.

## Public Pages and Protected Areas

Public pages include homepage, marketplace browsing, product pages, seller
pages, legal pages, and localized equivalents.

Protected areas include dashboards, account settings, onboarding, messaging,
uploads, saved items, and admin routes. Server-side authorization must remain
the source of truth for protected behavior.

## Admin Access

Admin access is controlled by the server-side `ADMIN_EMAILS` environment
variable. If `ADMIN_EMAILS` is missing, there should be no default admin
account.

Do not hardcode personal or production admin email addresses in public source
code.

## Public Launch Checklist

Before making a public deployment:

1. Confirm all required environment variables are set in the deployment
   provider.
2. Confirm database migrations are reviewed and applied through the normal
   deployment workflow.
3. Confirm public and private storage buckets are configured correctly.
4. Confirm admin access works through environment configuration only.
5. Confirm legal pages, privacy policy, and footer links render as web pages.
6. Confirm private file access remains authenticated and signed-url based.
7. Run lint, typecheck, and production build.
8. Complete manual QA for seller, buyer, message, upload, and admin flows.

## Security Notes

- Never expose server-only keys to the browser.
- Never commit `.env` files or deployment exports.
- Keep private files out of public buckets.
- Keep signed URLs short-lived.
- Keep rate limiting and ownership checks on sensitive routes.
- Avoid logging secrets, tokens, signed URLs, or private document contents.

## Operational Details

Detailed provider dashboards, recovery procedures, incident notes, and
production runbooks should live in private operational documentation outside the
public repository.
