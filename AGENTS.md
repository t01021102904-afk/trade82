<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes. Read the relevant guide in
`node_modules/next/dist/docs/` before changing Next.js APIs or conventions.
<!-- END:nextjs-agent-rules -->

# Trade82 Agent Guide

Trade82 is a bilingual B2B marketplace that connects Korean sellers with
global buyers. It also supports partners who refer users and administrators
who review companies, payments, payouts, and settlement operations.

This file is the short operating map. Read:

- `docs/TRADE82_CONTEXT.md` for architecture, domains, and operating rules.
- `docs/CURRENT_WORK.md` for the latest main commit, recent PRs, open work,
  known gaps, and next priorities.

## Stack

- Next.js App Router and React
- TypeScript and Tailwind CSS
- Clerk authentication
- Prisma with Supabase Postgres
- Supabase Storage
- Stripe Checkout and guarded Stripe Connect services
- English/Korean dictionaries in `messages/`

Clerk is the authentication source of truth. Supabase Auth is not used.
Supabase provides Postgres and Storage only.

## Non-negotiable safety rules

- Never modify Production data without explicit, current authorization.
- Never connect to Production merely to make a test pass.
- Never run `prisma db push`, `migrate reset`, or manual Production DDL.
- Inspect `prisma/schema.prisma` and the full migration history before any
  schema change.
- Do not edit an already-applied migration. Add a new migration when approved.
- Do not change Vercel, Clerk, Supabase, or Stripe settings unless explicitly
  requested.
- Never print, log, document, or commit secrets or personal data.
- Treat payment, order, payout, refund, dispute, and settlement data as
  financial history.
- Preserve fail-closed feature and execution modes.
- Do not assume a Production feature flag is enabled or disabled without a
  read-only environment audit.

## Account and routing rules

- Seller and buyer identities are represented by owned `Company` records.
- Partner identity is represented by `PartnerProfile`; it is not an
  `AccountRole` enum value.
- Admin access is separately authorized. UI visibility is never sufficient
  authorization.
- Keep seller, buyer, partner, and admin routing independent.
- Partner-only accounts must not be forced through seller/buyer onboarding.
- Preserve locale-aware destinations for default English and `/ko` routes.
- Do not weaken Clerk middleware, server authorization, ownership checks, or
  account-deletion protections.

## Change discipline

- Run `git status -sb` and inspect `git diff` before editing.
- Preserve all existing user changes.
- Do not use `git reset`, `git restore`, or `git checkout` to discard changes.
- Read the related implementation and existing tests before editing.
- Prefer the narrowest change that fixes the demonstrated behavior.
- Do not perform unrelated refactoring.
- Do not change global CSS for a local component problem.
- Avoid global input, button, typography, overflow, and layout rules that can
  regress unrelated screens.
- Keep English and Korean translation structures aligned.
- Keep generated Prisma files synchronized only when the schema changes.

## Browser and UI debugging

- Reproduce actual browser errors before selecting a root cause.
- Capture the browser exception, stack trace, request state, and first
  application frame.
- Do not let empty `catch` blocks hide failures.
- A successful build does not prove a browser bug is fixed.
- Use Playwright or an authorized browser session for user-flow regressions.
- If Preview Protection or missing test credentials blocks validation, report
  the blocked routes and do not claim they passed.
- Check desktop and mobile overflow when changing shared navigation or forms.

## Validation baseline

Run after code changes unless the task gives a stricter suite:

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
git diff --check
```

Also run focused tests and disposable PostgreSQL integration tests when the
changed domain has them. Never use Production as the disposable database.

For documentation-only changes, validate links, facts, line endings, and
`git diff --check`; do not run destructive or irrelevant suites.

## Pull requests

- Start from the requested base, normally the latest `origin/main`.
- Keep one concern per branch and PR.
- List the root cause, exact changed files, validation results, and anything
  not validated.
- Do not mark browser validation complete without browser evidence.
- Do not merge, deploy, or alter external settings unless requested.
- Update `docs/CURRENT_WORK.md` after major PRs merge.

The repository code, Prisma schema, committed migrations, and current tests are
the source of truth when older README or PR prose conflicts with implementation.
