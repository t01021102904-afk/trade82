# Trade82 Current Work

Last updated: 2026-07-25

Update this document after every major PR merge, migration rollout, confirmed
Production incident, or change in open-work priority.

## Repository snapshot

- Repository: `t01021102904-afk/trade82`
- Default branch: `main`
- Latest reviewed `origin/main` commit:
  `96e53f47ba810d1a7ce1eb12920b3118201a108b`
- Latest merge at review time: PR #71, Naver site verification metadata
- Working base for this document: the commit above
- Production platform: Vercel, deployed from `main`
- Last local repository verification date: 2026-07-25

This snapshot records GitHub and repository state. It does not assert that a
particular Vercel Production deployment is currently READY unless a separate
deployment audit confirms it.

## Recent merged work

| PR | Merge commit | Purpose |
| --- | --- | --- |
| [#71](https://github.com/t01021102904-afk/trade82/pull/71) | `96e53f47` | Add Naver Search Advisor ownership metadata and a focused regression test. |
| [#70](https://github.com/t01021102904-afk/trade82/pull/70) | `11ed65c5` | Fix the confirmed Marketplace debounce timer receiver error. |
| [#69](https://github.com/t01021102904-afk/trade82/pull/69) | `46e5a474` | Route partner-only accounts from live context, refresh the header after enrollment, and contain onboarding text. |
| [#68](https://github.com/t01021102904-afk/trade82/pull/68) | `d8885be9` | Add Marketplace History API safety, request error containment, diagnostics, and Playwright coverage. |
| [#67](https://github.com/t01021102904-afk/trade82/pull/67) | `48b55816` | Preserve the partner signup destination and improve onboarding wrapping. |
| [#66](https://github.com/t01021102904-afk/trade82/pull/66) | `972b1ab4` | Earlier Marketplace History compatibility attempt. |
| [#65](https://github.com/t01021102904-afk/trade82/pull/65) | `6c06bac4` | Repair site-wide localization keys and button label regressions. |
| [#64](https://github.com/t01021102904-afk/trade82/pull/64) | `604cfdb7` | Earlier Marketplace page-crash mitigation. |

PRs #64, #66, and #68 added useful defenses, but they did not establish the
final root cause of the search crash. The confirmed timer receiver defect was
fixed in PR #70.

## Marketplace search Illegal invocation

### Confirmed root cause

`src/lib/public-marketplace-client-state.ts` stored native browser
`setTimeout` and `clearTimeout` functions directly on `browserTimerApi`.
`scheduleMarketplaceSearch` then called them as object methods. Chromium
supplied `browserTimerApi` as the receiver instead of the browser global and
raised `TypeError: Illegal invocation`.

### Final fix

PR #70 changed the browser timer adapter to wrapper functions that call:

- `globalThis.setTimeout(...)`
- `globalThis.clearTimeout(...)`

The injectable timer API remains available for deterministic tests. A
receiver-sensitive regression test verifies the default browser scheduling
path.

Relevant files:

- `src/lib/public-marketplace-client-state.ts`
- `src/components/marketplace-client.tsx`
- `tests/marketplace-server-rendered-products.test.ts`
- `tests/marketplace-search.e2e.test.mjs`

PR #68 also preserves existing products and presents a localized request error
when search/API parsing/mapping fails. Do not remove that containment while
changing search behavior.

### Remaining verification

The PR #70 description records unit, full test, lint, typecheck, and build
success. It does not record an authenticated or post-merge Production browser
run of the fixed code. Before declaring a future recurrence resolved, run the
real English and Korean Marketplace search E2E against the target deployment.

## Partner-only routing and header state

PR #69 made partner-only classification depend on current database context:

- A PartnerProfile exists.
- No buyer company exists.
- No seller company exists.
- Stored `UserProfile.role` does not determine partner-only status.

Partner-only accounts route to the locale-aware Partner dashboard and the
header shows Marketplace, Sellers, and Partner dashboard without ordinary
Dashboard or Messages links.

Partner enrollment invalidates the cached user context and performs a full
locale-aware navigation so the header does not keep stale pre-enrollment state.

Relevant files:

- `src/lib/partner-account-routing.ts`
- `src/lib/require-auth.ts`
- `src/lib/public-navigation.ts`
- `src/hooks/use-user-context.ts`
- `src/components/site-header.tsx`
- `src/components/partner-enrollment-form.tsx`
- `tests/partner-program.test.ts`
- `tests/partner-routing.e2e.test.mjs`

### Remaining verification

PR #69 explicitly did not claim authenticated browser validation because no
disposable Clerk session and database credentials were available. Its
Playwright tests skip when session-state files are absent. Validate these real
flows when a safe test identity is available:

- Partner enrollment to localized dashboard.
- Header update immediately after enrollment.
- Direct `/dashboard` access by a partner-only account.
- English and Korean desktop/mobile navigation.

## Onboarding text overflow

PRs #67 and #69 constrained onboarding layout and removed the global button
nowrap rule that pushed or clipped long labels.

Relevant files:

- `src/app/globals.css`
- `src/components/onboarding-stepper.tsx`
- `src/components/role-selection.tsx`
- `src/components/partner-enrollment-form.tsx`
- `tests/header-auth-shell.test.ts`
- `tests/partner-program.test.ts`

Future fixes should remain component-scoped. Do not restore global no-wrap or
global overflow rules to solve a single screen.

## Naver site verification

PR #71 is merged into `main`.

`src/app/layout.tsx` now defines
`metadata.verification.other["naver-site-verification"]`, which Next.js emits
in the server-generated `<head>`. The public ownership token is covered by:

- `tests/naver-site-verification.test.ts`

The repository confirms metadata generation. Completion of ownership
verification inside the external Naver Search Advisor console and subsequent
indexing are not established by repository evidence.

## Open pull requests

### Draft PR #52: unified manual partner payout review

- URL: https://github.com/t01021102904-afk/trade82/pull/52
- State at review: open Draft
- Head: `33b025ebe1075d500401d5c3cd38437df380f1ea`
- Base: `feature/partner-self-registration-korean-payout`, not current `main`
- Last recorded checks: GitHub PostgreSQL and Vercel Preview succeeded
- Browser validation: not performed

Purpose:

- Add `PartnerPayout` and `PartnerPayoutEvent`.
- Reconcile partner referral settlement legs into reviewed manual payouts.
- Add masked admin review/reveal flows and protected status actions.
- Distinguish valid partner attribution from an unprepared payout.

Key proposed files include the following. Entries that are absent from current
`main` exist only on the PR #52 branch:

- `prisma/migrations/20260722130000_add_partner_manual_payout_review/`
- `prisma/migrations/20260722140000_harden_partner_manual_payout_review/`
- `src/lib/partner-payouts.ts`
- `src/lib/admin-payout-review.ts`
- `src/components/admin-payout-management.tsx`
- `tests/partner-manual-payout.integration.test.ts`

Before continuing PR #52:

1. Compare it with current `main`, which already contains PR #51 and many later
   migrations and partner/UI fixes.
2. Rebase or retarget deliberately; do not merge the old stack blindly.
3. Re-run full migration history on new disposable PostgreSQL databases.
4. Reconcile the Production migration runner allowlist and generated Prisma
   output.
5. Perform authenticated admin browser validation if safe credentials exist.

### PR #5: guarded internal order test mode

- URL: https://github.com/t01021102904-afk/trade82/pull/5
- State at review: open, not Draft
- Head: `1228f09535326cf615ceaaf6651443ecfce8901a`
- Base: `main`
- Mergeability at review: conflicting
- Last update: 2026-07-14

This PR predates the current payment, order, payout, and migration architecture.
Do not merge it without a complete redesign/review. Decide whether to close it
or rebuild the requirement on current `main`.

## Known bugs and unconfirmed items

No current repository evidence proves an active Production crash after the
latest Marketplace and partner fixes. The following items remain unconfirmed:

- Marketplace search on the deployed PR #70 code has not been documented with
  a post-merge real-browser run.
- Partner-only enrollment/routing/header behavior has not been documented with
  an authenticated disposable browser session.
- Naver Search Advisor console acceptance and indexing are external and not
  verified in the repository.
- PR #52 is based on an older feature branch and has not been reconciled with
  current `main`.
- The actual Production values of Stripe execution modes are not established
  by this repository review. The code defaults missing/unknown values to off.
- `README.md` still describes an older MVP and incorrectly says payments are
  not included.

Do not convert an unconfirmed item into a claimed bug or success without new
evidence.

## Next priorities

1. Run a safe real-browser smoke suite for `/marketplace` and
   `/ko/marketplace`, including rapid search and API failure recovery.
2. Run authenticated partner-only routing tests with disposable Clerk and
   PostgreSQL environments.
3. Decide whether to update or close Draft PR #52.
4. Decide whether stale PR #5 should be closed.
5. Confirm Naver ownership verification in the external console without
   changing the code token.
6. Refresh `README.md` in a separate documentation PR so it reflects current
   payments, orders, payouts, partner, and settlement capabilities.
7. Keep this file synchronized after each major merge.

## Maintenance rule

When a major PR merges:

1. Fetch `origin/main` and record the new full commit SHA.
2. Update the recent merge table and affected domain sections.
3. Update open PR status, base branch, and head SHA.
4. Record only tests and browser paths that actually ran.
5. Separate confirmed Production evidence from repository assumptions.
6. Update the date at the top.
7. Run `git diff --check` before publishing the documentation update.
