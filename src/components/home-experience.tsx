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
  const roleCards = [
    {
      title: messages.home.roleSupplierTitle,
      description: messages.home.roleSupplierText,
      href: withLocale("/onboarding/seller", locale),
      action: messages.home.roleSupplierCta,
    },
    {
      title: messages.home.roleBuyerTitle,
      description: messages.home.roleBuyerText,
      href: withLocale("/onboarding/buyer", locale),
      action: messages.home.roleBuyerCta,
    },
  ];

  return (
    <main className="overflow-hidden theme-bg">
      <section className="relative isolate">
        <div className="bm-grid-surface pointer-events-none absolute inset-0 opacity-20" aria-hidden="true" />
        <div
          className="pointer-events-none absolute left-1/2 top-0 h-[520px] w-[720px] -translate-x-1/2 rounded-full bg-emerald-400/10 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative mx-auto grid min-h-[680px] max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.94fr_1.06fr] lg:px-8">
          <div className="bm-section-in min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-100">
              <span className="bm-pulse-dot size-2 rounded-full bg-emerald-300" />
              {messages.home.heroBadge}
            </div>
            <h1 className="mt-5 max-w-4xl text-[2rem] font-semibold leading-tight tracking-normal theme-foreground sm:text-5xl">
              {messages.home.headline}
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 theme-muted sm:text-base">
              {messages.home.subheadline}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href={withLocale("/onboarding/seller", locale)}
                className="inline-flex min-h-11 items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold transition hover:-translate-y-0.5 theme-primary-button"
              >
                {messages.home.startListingProducts}
              </Link>
              <Link
                href={withLocale("/marketplace", locale)}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border px-5 py-3 text-sm font-semibold transition hover:-translate-y-0.5 theme-secondary-button"
              >
                {messages.home.exploreProducts}
              </Link>
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <MetricPill value="19" label={messages.home.buyerTouchpoints} />
              <MetricPill value="30" label={messages.home.earlyPartnerShort} />
            </div>
          </div>

          <TradeFlowVisual messages={messages.home} />
        </div>
      </section>

      <section className="border-y theme-border theme-surface-muted">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 py-12 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
          <div className="rounded-3xl border border-emerald-300/20 bg-emerald-300/10 p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200">
              {messages.home.earlyPartnerEyebrow}
            </p>
            <h2 className="mt-4 max-w-xl text-2xl font-semibold theme-foreground">
              {messages.home.earlyPartnerTitle}
            </h2>
            <p className="mt-4 text-sm leading-6 text-emerald-50/80">
              {messages.home.earlyPartnerText}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {roleCards.map((card) => (
              <Link
                key={card.title}
                href={card.href}
                className="group rounded-3xl border p-5 transition hover:-translate-y-0.5 theme-surface-elevated theme-card-hover"
              >
                <div className="mb-6 flex items-center justify-between">
                  <span className="rounded-full border px-3 py-1 text-xs font-medium theme-border theme-muted">
                    Trade82
                  </span>
                  <span className="text-xs font-semibold text-emerald-200 transition group-hover:translate-x-1">
                    {card.action}
                  </span>
                </div>
                <h3 className="text-lg font-semibold theme-foreground">{card.title}</h3>
                <p className="mt-3 text-sm leading-6 theme-muted">{card.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <SectionEyebrow label={messages.home.featureGridEyebrow} />
        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="max-w-3xl text-2xl font-semibold theme-foreground sm:text-3xl">
              {messages.home.featureGridTitle}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 theme-muted">
              {messages.home.featureGridText}
            </p>
          </div>
          <span className="w-fit rounded-full border px-3 py-1 text-xs font-medium theme-surface-muted theme-muted">
            {messages.home.buyerTouchpointsSecured}
          </span>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <SectionEyebrow label={messages.home.howItWorks} />
          <h2 className="mt-4 max-w-3xl text-2xl font-semibold theme-foreground sm:text-3xl">
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
                <span className="flex size-9 items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-300/10 text-sm font-semibold text-emerald-100">
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

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="rounded-3xl border p-6 theme-surface-elevated sm:p-8 lg:flex lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200">
              {messages.home.ctaEyebrow}
            </p>
            <h2 className="mt-4 text-2xl font-semibold theme-foreground">
              {messages.home.ctaTitle}
            </h2>
            <p className="mt-3 text-sm leading-6 theme-muted">
              {messages.home.ctaText}
            </p>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row lg:mt-0">
            <Link
              href={withLocale("/onboarding/seller", locale)}
              className="inline-flex min-h-11 items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold transition hover:-translate-y-0.5 theme-primary-button"
            >
              {messages.home.startListingProducts}
            </Link>
            <Link
              href={withLocale("/marketplace", locale)}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border px-5 py-3 text-sm font-semibold transition hover:-translate-y-0.5 theme-secondary-button"
            >
              {messages.home.exploreProducts}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function MetricPill({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border p-4 theme-surface-muted">
      <p className="text-2xl font-semibold theme-foreground">{value}</p>
      <p className="mt-1 text-xs leading-5 theme-muted">{label}</p>
    </div>
  );
}

function SectionEyebrow({ label }: { label: string }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">
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
      className="bm-premium-card bm-section-in rounded-3xl border p-5 theme-surface"
      style={{ animationDelay: `${index * 55}ms` }}
    >
      <div className="mb-6 rounded-2xl border p-4 theme-surface-elevated">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold theme-muted">{feature.visual}</span>
          <span className="rounded-full bg-emerald-300/10 px-2 py-1 text-[11px] font-medium text-emerald-100">
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
      <p className="mt-3 text-sm leading-6 theme-muted">{feature.description}</p>
    </article>
  );
}

function TradeFlowVisual({ messages }: { messages: ReturnType<typeof getDictionary>["home"] }) {
  return (
    <div className="bm-float relative mx-auto w-full max-w-2xl rounded-[2rem] border p-3 theme-surface shadow-2xl shadow-emerald-950/20">
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
            <span className="rounded-full bg-emerald-200 px-2 py-1 text-xs font-semibold text-zinc-950">
              {messages.visualInquiryBadge}
            </span>
            <span className="text-xs text-emerald-100">{messages.buyerTouchpointsSecured}</span>
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
      ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100"
      : "border-sky-300/20 bg-sky-300/10 text-sky-100";

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
