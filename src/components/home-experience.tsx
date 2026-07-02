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
  return (
    <main className="overflow-hidden theme-bg">
      <section className="relative isolate border-b theme-border">
        <div className="bm-grid-surface pointer-events-none absolute inset-0 opacity-[0.14]" aria-hidden="true" />
        <div
          className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[640px] -translate-x-1/2 rounded-full bg-emerald-400/[0.08] blur-3xl"
          aria-hidden="true"
        />
        <div className="relative mx-auto flex min-h-[500px] max-w-7xl items-center px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
          <div className="bm-section-in max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] theme-success-badge">
              <span className="bm-pulse-dot size-2 rounded-full bg-emerald-300" />
              {messages.home.heroBadge}
            </div>
            <h1 className="mt-6 max-w-3xl text-[1.875rem] font-semibold leading-[1.08] tracking-normal theme-foreground sm:text-[2.375rem] lg:text-[2.75rem]">
              {messages.home.headline}
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-6 theme-muted sm:text-[15px]">
              {messages.home.subheadline}
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
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
        </div>
      </section>

      <WorkflowSection messages={messages.home} />

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
    <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] theme-success-text">
      {label}
    </p>
  );
}

function WorkflowSection({ messages }: { messages: ReturnType<typeof getDictionary>["home"] }) {
  const workflow = [
    {
      eyebrow: messages.visualSellerEyebrow,
      title: messages.visualProductTitle,
      badge: messages.visualDraft,
      detail: messages.flowStepSupplier,
      tone: "emerald" as const,
    },
    {
      eyebrow: "Trade82",
      title: messages.visualOrganizedTitle,
      badge: messages.visualPublished,
      detail: messages.flowStepOrganize,
      tone: "sky" as const,
    },
    {
      eyebrow: messages.visualBuyerEyebrow,
      title: messages.visualInquiryTitle,
      badge: messages.visualLead,
      detail: messages.flowStepLead,
      tone: "emerald" as const,
    },
  ];

  return (
    <section className="border-b theme-border">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
          <div>
            <SectionEyebrow label={messages.visualFlowLabel} />
            <h2 className="mt-4 max-w-xl text-xl font-semibold leading-snug theme-foreground sm:text-2xl">
              {messages.featureGridTitle}
            </h2>
            <p className="mt-4 max-w-lg text-sm leading-6 theme-muted">
              {messages.featureGridText}
            </p>
          </div>
          <div className="rounded-[1.75rem] border p-3 theme-surface">
            <div className="rounded-[1.35rem] border p-4 theme-surface-elevated sm:p-5">
              <div className="grid gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr] lg:items-stretch">
                {workflow.map((item, index) => (
                  <WorkflowFragment key={item.eyebrow} index={index} item={item} />
                ))}
              </div>
              <div className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full px-2 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] theme-primary">
                    {messages.visualInquiryBadge}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 theme-foreground">
                  {messages.visualInquiryText}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function WorkflowFragment({
  item,
  index,
}: {
  item: {
    eyebrow: string;
    title: string;
    badge: string;
    detail: string;
    tone: "emerald" | "sky";
  };
  index: number;
}) {
  return (
    <>
      {index > 0 ? <FlowConnector /> : null}
      <WorkflowCard item={item} />
    </>
  );
}

function WorkflowCard({
  item,
}: {
  item: {
    eyebrow: string;
    title: string;
    badge: string;
    detail: string;
    tone: "emerald" | "sky";
  };
}) {
  const toneClass =
    item.tone === "emerald"
      ? "theme-success-badge"
      : "theme-info-badge";

  return (
    <article className="rounded-2xl border p-4 theme-surface-muted">
      <div className="flex items-start justify-between gap-3">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] theme-muted">
          {item.eyebrow}
        </p>
        <span className={`shrink-0 rounded-full border px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] ${toneClass}`}>
          {item.badge}
        </span>
      </div>
      <h3 className="mt-5 min-h-12 text-sm font-semibold leading-6 theme-foreground">
        {item.title}
      </h3>
      <p className="mt-3 border-t pt-3 text-xs leading-5 theme-border theme-muted">
        {item.detail}
      </p>
    </article>
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
          <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] theme-muted">
            {feature.visual}
          </span>
          <span className="rounded-full border px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] theme-success-badge">
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

function FlowConnector() {
  return (
    <div className="hidden items-center lg:flex" aria-hidden="true">
      <span className="h-px w-10 bg-gradient-to-r from-emerald-300/30 to-sky-300/30" />
      <span className="size-2 rounded-full bg-emerald-300/60" />
    </div>
  );
}
