# Public Marketplace UX Audit

Date: 2026-07-25
Scope: Phase 1 - public storefront and discovery only

## Current Trade82 public UI

- The home page explains the platform well, but its primary path is account
  creation rather than product and supplier discovery.
- Marketplace filters are grouped above the results instead of supporting a
  scan-friendly desktop sidebar and a focused mobile filter flow.
- Applied filters are not summarized as removable chips, and error/empty
  states do not offer a working retry or direct reset path.
- Product cards are visually consistent but do not surface MOQ, one of the
  most important B2B qualification fields.
- Seller cards expose unsupported "Fast Response" filtering and render a zero
  rating as if it were meaningful when no public reviews exist.
- Product and company detail pages contain strong underlying data, but key
  qualification facts, supplier identity, and inquiry actions are distributed
  across several equally weighted boxes.
- The mobile header expands inline without dialog semantics, Escape handling,
  focus containment/return, or explicit body-scroll restoration.

## Principles adopted from the reference PDF

- Use a light editorial canvas, dark high-contrast type, restrained emerald
  accents, thin dividers, and a disciplined column grid.
- Let typography and spacing establish hierarchy before borders, shadows, or
  decorative cards.
- Prioritize product imagery and compact, comparable metadata.
- Keep storefront, operator, seller, and buyer responsibilities distinct.
- Treat search, industry-specific filtering, supplier profiles, saved items,
  inquiry, and RFQ as first-class marketplace capabilities.
- Keep components modular so the storefront can evolve without changing the
  current Next.js, Clerk, Prisma, Supabase, Stripe, or API architecture.

## Marketplace operating principles adopted

- Buyers should be able to discover products, narrow by real catalog fields,
  review supplier identity, save candidates, and start an inquiry with minimal
  context switching.
- Supplier credibility must come from stored verification, export,
  certification, location, and public review data - never invented metrics.
- Public discovery should expose only active products from verified,
  non-deleted seller companies and preserve the existing field-visibility
  gate.
- Admin, seller, buyer, and partner workspaces remain separate from this
  public-storefront phase.

## Reference elements intentionally excluded

- Multi-vendor cart, combined checkout, instant purchase, order splitting,
  consumer promotions, loyalty mechanics, consumer-style seller ratings, and
  personalized recommendations are not copied into this phase.
- The page 55 retail UI, its imagery, branding, copy, source code, and exact
  composition are not reproduced.
- Medusa, Mercur, or any other platform/framework is not introduced.

## B2B transformation

- Retail purchase prompts become product comparison cues, supplier review,
  save, inquiry, RFQ, and company-profile actions.
- Price remains wholesale or inquiry-gated; MOQ, certifications, incoterms,
  origin, and supplier information become primary qualification data.
- Seller reputation is represented only by actual Trade82 verification,
  export experience, certifications, public reviews, and company data.
- The home page becomes a discovery entry point for products and suppliers
  while retaining buyer and seller onboarding paths.

## Pages and components in scope

- Pages: `/`, `/ko`, `/marketplace`, `/ko/marketplace`, `/sellers`,
  `/ko/sellers`, product detail, and company detail.
- Shared components: public header, home discovery sections, Marketplace
  search/filter/results presentation, product discovery card and skeleton,
  seller discovery card, product gallery/inquiry panel, and public company
  identity/details.
- English and Korean dictionary structures remain aligned.

## Regression risks

- Marketplace initial SSR data, URL query serialization, debounce timer
  receiver safety, AbortController cancellation, browser history, pagination,
  and API error containment.
- Save controls nested near full-card links.
- Clerk sign-in gates, role-specific navigation, partner-only routing, product
  field visibility, WholesalePriceGate, and ContactModal inquiry creation.
- Canonical English and `/ko` localized routes, metadata, JSON-LD, and public
  visibility rules.
- Mobile drawer focus/scroll cleanup and long Korean copy overflow.
- Shared CSS leaking into authenticated dashboards.

## Recommended delivery phases

1. Public storefront and discovery (this PR).
2. Seller onboarding, catalog, and performance dashboard UX.
3. Buyer inquiry, RFQ, messages, and order workspace UX.
4. Admin vendor/product approval, orders, payouts, and marketplace analytics.

Phases 2-4 should be separate PRs with their own workflow and authorization
regression coverage.
