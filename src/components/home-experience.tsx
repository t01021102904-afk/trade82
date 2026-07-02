import Link from "next/link";

import { getDictionary, withLocale, type Locale } from "@/lib/i18n";

export function HomeExperience({ locale }: { locale: Locale }) {
  const messages = getDictionary(locale);
  const features = [
    {
      title: messages.home.featureListingsTitle,
      description: messages.home.featureListingsText,
      visual: messages.home.featureVisualListing,
    },
    {
      title: messages.home.featureVisibilityTitle,
      description: messages.home.featureVisibilityText,
      visual: messages.home.featureVisualVisibility,
    },
    {
      title: messages.home.featureDiscoveryTitle,
      description: messages.home.featureDiscoveryText,
      visual: messages.home.featureVisualSearch,
    },
    {
      title: messages.home.featureInquiryTitle,
      description: messages.home.featureInquiryText,
      visual: messages.home.featureVisualInquiry,
    },
    {
      title: messages.home.featureDashboardTitle,
      description: messages.home.featureDashboardText,
      visual: messages.home.featureVisualDashboard,
    },
    {
      title: messages.home.featureTradeDataTitle,
      description: messages.home.featureTradeDataText,
      visual: messages.home.featureVisualTradeData,
    },
  ];
  const steps = [
    messages.home.flowStepSupplier,
    messages.home.flowStepOrganize,
    messages.home.flowStepDiscover,
    messages.home.flowStepInquiry,
    messages.home.flowStepLead,
  ];
  return (
    <main className="overflow-hidden theme-bg">
      <section className="relative isolate">
        <div className="bm-grid-surface pointer-events-none absolute inset-0 opacity-20" aria-hidden="true" />
        <div
          className="pointer-events-none absolute left-1/2 top-0 h-[480px] w-[680px] -translate-x-1/2 rounded-full bg-emerald-400/10 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative mx-auto grid min-h-[620px] max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[0.94fr_1.06fr] lg:px-8">
          <div className="bm-section-in min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold theme-success-badge">
              <span className="bm-pulse-dot size-2 rounded-full bg-emerald-300" />
              {messages.home.heroBadge}
            </div>
            <h1 className="mt-5 max-w-3xl text-[1.875rem] font-semibold leading-tight tracking-normal theme-foreground sm:text-[2.5rem] lg:text-[2.875rem]">
              {messages.home.headline}
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-6 theme-muted">
              {messages.home.subheadline}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href={withLocale("/onboarding/seller", locale)}
                className="inline-flex min-h-10 items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold transition hover:-translate-y-0.5 theme-primary-button"
              >
                {messages.home.startListingProducts}
              </Link>
              <Link
                href={withLocale("/marketplace", locale)}
                className="inline-flex min-h-10 items-center justify-center rounded-xl border px-5 py-2.5 text-sm font-semibold transition hover:-translate-y-0.5 theme-secondary-button"
              >
                {messages.home.exploreProducts}
              </Link>
            </div>
          </div>

          <TradeFlowVisual messages={messages.home} />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <SectionEyebrow label={messages.home.featureGridEyebrow} />
        <div className="mt-4 max-w-3xl">
          <div>
            <h2 className="text-xl font-semibold theme-foreground sm:text-2xl">
              {messages.home.featureGridTitle}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 theme-muted">
              {messages.home.featureGridText}
            </p>
          </div>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {features.map((feature, index) => (
            <FeatureCard
              key={feature.title}
              feature={feature}
              index={index}
              statusLabel={messages.home.featureStatusLive}
            />
          ))}
        </div>
      </section>

      <section className="border-y theme-border theme-surface-muted">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <SectionEyebrow label={messages.home.howItWorks} />
          <h2 className="mt-4 max-w-3xl text-xl font-semibold theme-foreground sm:text-2xl">
            {messages.home.howTitle}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 theme-muted">
            {messages.home.howDescription}
          </p>
          <div className="relative mt-10 grid gap-3 lg:grid-cols-5">
            <div className="absolute left-8 right-8 top-8 hidden h-px bg-gradient-to-r from-emerald-300/20 via-sky-300/20 to-emerald-300/20 lg:block" />
            {steps.map((step, index) => (
              <article
                key={step}
                className="bm-section-in relative rounded-2xl border p-4 theme-surface-elevated"
                style={{ animationDelay: `${index * 70}ms` }}
              >
                <span className="flex size-9 items-center justify-center rounded-xl border text-sm font-semibold theme-success-badge">
                  {index + 1}
                </span>
                <h3 className="mt-5 text-sm font-semibold leading-6 theme-foreground">{step}</h3>
                <p className="mt-2 text-xs leading-5 theme-muted">
                  {messages.home.flowStepText}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="rounded-3xl border p-5 theme-surface-elevated sm:p-6 lg:flex lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] theme-success-text">
              {messages.home.ctaEyebrow}
            </p>
            <h2 className="mt-4 text-xl font-semibold theme-foreground sm:text-2xl">
              {messages.home.ctaTitle}
            </h2>
            <p className="mt-3 text-sm leading-6 theme-muted">
              {messages.home.ctaText}
            </p>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row lg:mt-0">
            <Link
              href={withLocale("/onboarding/seller", locale)}
              className="inline-flex min-h-10 items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold transition hover:-translate-y-0.5 theme-primary-button"
            >
              {messages.home.startListingProducts}
            </Link>
            <Link
              href={withLocale("/marketplace", locale)}
              className="inline-flex min-h-10 items-center justify-center rounded-xl border px-5 py-2.5 text-sm font-semibold transition hover:-translate-y-0.5 theme-secondary-button"
            >
              {messages.home.exploreProducts}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function SectionEyebrow({ label }: { label: string }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-[0.22em] theme-success-text">
      {label}
    </p>
  );
}

function FeatureCard({
  feature,
  index,
  statusLabel,
}: {
  feature: { title: string; description: string; visual: string };
  index: number;
  statusLabel: string;
}) {
  return (
    <article
      className="bm-premium-card bm-section-in rounded-3xl border p-4 theme-surface"
      style={{ animationDelay: `${index * 55}ms` }}
    >
      <div className="mb-5 rounded-2xl border p-4 theme-surface-elevated">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold theme-muted">{feature.visual}</span>
          <span className="rounded-full border px-2 py-1 text-[11px] font-medium theme-success-badge">
            {statusLabel}
          </span>
        </div>
        <div className="mt-4 grid gap-2">
          <span className="h-2 rounded-full bg-emerald-200/50" />
          <span className="h-2 w-4/5 rounded-full bg-[var(--muted)]" />
          <span className="h-2 w-2/3 rounded-full bg-[var(--muted)]" />
        </div>
      </div>
      <h3 className="text-base font-semibold theme-foreground">{feature.title}</h3>
      <p className="mt-2 text-[13px] leading-6 theme-muted">{feature.description}</p>
    </article>
  );
}

function TradeFlowVisual({ messages }: { messages: ReturnType<typeof getDictionary>["home"] }) {
  return (
    <div className="bm-float relative mx-auto w-full max-w-xl rounded-[2rem] border p-3 theme-surface shadow-xl shadow-emerald-950/10">
      <div className="rounded-[1.5rem] border p-4 theme-surface-elevated">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-red-400" />
            <span className="size-2 rounded-full bg-amber-300" />
            <span className="size-2 rounded-full bg-emerald-300" />
          </div>
          <span className="rounded-full border px-3 py-1 text-xs font-medium theme-border theme-muted">
            {messages.visualFlowLabel}
          </span>
        </div>
        <div className="grid gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr] lg:items-center">
          <FlowCard
            eyebrow={messages.visualSellerEyebrow}
            title={messages.visualProductTitle}
            badge={messages.visualDraft}
            tone="emerald"
          />
          <FlowConnector />
          <FlowCard
            eyebrow="Trade82"
            title={messages.visualOrganizedTitle}
            badge={messages.visualPublished}
            tone="sky"
          />
          <FlowConnector />
          <FlowCard
            eyebrow={messages.visualBuyerEyebrow}
            title={messages.visualInquiryTitle}
            badge={messages.visualLead}
            tone="emerald"
          />
        </div>
        <div className="mt-5 overflow-hidden rounded-full border theme-surface-muted">
          <div className="bm-flow-progress h-2 rounded-full bg-gradient-to-r from-emerald-300 via-sky-300 to-emerald-200" />
        </div>
        <div className="bm-flow-inquiry mt-5 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full px-2 py-1 text-xs font-semibold theme-primary">
              {messages.visualInquiryBadge}
            </span>
          </div>
          <p className="mt-3 text-sm leading-6 theme-foreground">
            {messages.visualInquiryText}
          </p>
        </div>
      </div>
    </div>
  );
}

function FlowCard({
  eyebrow,
  title,
  badge,
  tone,
}: {
  eyebrow: string;
  title: string;
  badge: string;
  tone: "emerald" | "sky";
}) {
  const toneClass =
    tone === "emerald"
      ? "theme-success-badge"
      : "theme-info-badge";

  return (
    <article className="bm-flow-card rounded-2xl border p-4 theme-surface-muted">
      <p className="text-xs font-medium theme-muted">{eyebrow}</p>
      <h3 className="mt-3 min-h-12 text-sm font-semibold leading-6 theme-foreground">{title}</h3>
      <span className={`mt-4 inline-flex rounded-full border px-2 py-1 text-xs font-medium ${toneClass}`}>
        {badge}
      </span>
      <div className="mt-4 grid gap-2">
        <span className="h-2 rounded-full bg-[var(--muted)]" />
        <span className="h-2 w-3/4 rounded-full bg-[var(--muted)]" />
      </div>
    </article>
  );
}

function FlowConnector() {
  return (
    <div className="hidden items-center lg:flex" aria-hidden="true">
      <span className="h-px w-10 bg-gradient-to-r from-emerald-300/30 to-sky-300/30" />
      <span className="size-2 rounded-full bg-emerald-300/60" />
    </div>
  );
}
