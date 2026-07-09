import type { ReactNode } from "react";

import { cx } from "@/lib/utils";

export function AnimatedGridBackground({ children }: { children: ReactNode }) {
  return (
    <section className="relative isolate overflow-hidden bg-white">
      <div className="bm-grid-surface pointer-events-none absolute inset-0 opacity-80" aria-hidden="true" />
      <div
        className="bm-glow-shift pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-emerald-200/45 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="bm-glow-shift pointer-events-none absolute -right-20 bottom-10 h-80 w-80 rounded-full bg-blue-200/45 blur-3xl [animation-delay:1.5s]"
        aria-hidden="true"
      />
      <div className="relative">{children}</div>
    </section>
  );
}

export function FloatingMarketplacePreview({
  labels,
}: {
  labels: {
    seller: string;
    buyer: string;
    inquiry: string;
    sample: string;
    status: string;
  };
}) {
  const steps = [
    labels.seller,
    labels.status,
    labels.inquiry,
    labels.sample,
    labels.buyer,
  ];

  return (
    <div className="bm-float mx-auto w-full max-w-md rounded-lg border border-white/70 bg-white/85 p-3 shadow-2xl shadow-slate-950/10 backdrop-blur">
      <div className="rounded-md border border-zinc-200 bg-zinc-950 p-3 text-white">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-red-400" />
            <span className="size-2 rounded-full bg-amber-300" />
            <span className="bm-pulse-dot size-2 rounded-full bg-emerald-400" />
          </div>
          <span className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-zinc-300">
            Trade82
          </span>
        </div>
        <div className="grid gap-3">
          <div className="rounded-md border border-white/10 bg-white/[0.07] p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold">{labels.seller}</span>
              <span className="rounded-full bg-emerald-400/15 px-2 py-1 text-xs text-emerald-200">
                {labels.status}
              </span>
            </div>
            <div className="mt-3 grid gap-2">
              <span className="h-2 rounded-full bg-emerald-200/70" />
              <span className="h-2 w-3/4 rounded-full bg-blue-200/60" />
            </div>
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <div className="rounded-md bg-white p-3 text-zinc-950 shadow-sm">
              <p className="text-xs font-semibold">{labels.sample}</p>
              <p className="mt-1 h-2 w-16 rounded-full bg-zinc-200" />
            </div>
            <span className="text-xs text-zinc-400">→</span>
            <div className="rounded-md border border-blue-300/30 bg-blue-400/10 p-3">
              <p className="text-xs font-semibold text-blue-100">{labels.buyer}</p>
              <p className="mt-1 h-2 w-14 rounded-full bg-blue-200/50" />
            </div>
          </div>
          <div className="rounded-md border border-emerald-300/20 bg-emerald-400/10 p-3">
            <p className="text-xs font-semibold text-emerald-100">{labels.inquiry}</p>
            <p className="mt-2 text-[11px] leading-4 text-zinc-300">
              MOQ · lead time · documents · sales channel
            </p>
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {steps.map((step) => (
          <span
            key={step}
            className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 shadow-sm"
          >
            {step}
          </span>
        ))}
      </div>
    </div>
  );
}

export function HowItWorksMotion({
  steps,
}: {
  steps: Array<{ title: string; description: string }>;
}) {
  return (
    <div className="relative mt-8 grid gap-4 lg:grid-cols-4">
      <div
        className="absolute left-6 right-6 top-10 hidden h-px bg-gradient-to-r from-emerald-200 via-blue-200 to-zinc-200 lg:block"
        aria-hidden="true"
      />
      {steps.map((step, index) => (
        <article
          key={step.title}
          className="bm-premium-card bm-section-in rounded-lg border border-zinc-200 bg-white p-5 shadow-sm shadow-zinc-100"
          style={{ animationDelay: `${index * 70}ms` }}
        >
          <span
            className={cx(
              "relative z-10 flex size-10 items-center justify-center rounded-md text-sm font-semibold",
              index % 2 === 0
                ? "bg-emerald-50 text-emerald-800"
                : "bg-blue-50 text-blue-800",
            )}
          >
            {index + 1}
          </span>
          <h3 className="relative z-10 mt-5 break-words text-base font-semibold text-zinc-950">
            {step.title}
          </h3>
          <p className="relative z-10 mt-3 text-sm leading-6 text-zinc-600">
            {step.description}
          </p>
        </article>
      ))}
    </div>
  );
}

export function ProfilePreviewPanel({
  kind,
  title,
  subtitle,
  badgeLabel,
}: {
  kind: "buyer" | "seller";
  title: string;
  subtitle: string;
  badgeLabel?: string;
}) {
  return (
    <div className="bm-premium-card rounded-lg border border-zinc-200 bg-white p-4 shadow-sm shadow-zinc-100">
      <div className="rounded-md bg-zinc-950 p-3 text-white">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold">{title}</span>
          <span
            className={cx(
              "rounded-full px-2 py-1 text-[11px] font-medium",
              kind === "seller"
                ? "bg-emerald-400/15 text-emerald-100"
                : "bg-blue-400/15 text-blue-100",
            )}
          >
            {badgeLabel ?? (kind === "seller" ? "Korean Seller" : "Global Buyer")}
          </span>
        </div>
        <p className="mt-2 text-xs leading-5 text-zinc-300">{subtitle}</p>
        <div className="mt-4 grid gap-2">
          <span className="h-2 rounded bg-white/20" />
          <span className="h-2 w-2/3 rounded bg-white/15" />
          <div className="mt-2 grid grid-cols-3 gap-2">
            <span className="h-12 rounded-md bg-emerald-300/15" />
            <span className="h-12 rounded-md bg-blue-300/15" />
            <span className="h-12 rounded-md bg-white/10" />
          </div>
        </div>
      </div>
    </div>
  );
}
