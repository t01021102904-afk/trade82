"use client";

import type { ReactNode } from "react";

import { useI18n } from "@/components/i18n-provider";
import { cx } from "@/lib/utils";

export function OnboardingStoryPanel({
  kind,
}: {
  kind: "role" | "buyer" | "seller";
}) {
  const { t } = useI18n();
  const flowSteps = [
    {
      title: t("onboarding.flowUploadProduct"),
      description: t("onboarding.flowUploadProductText"),
    },
    {
      title: t("onboarding.flowAddTerms"),
      description: t("onboarding.flowAddTermsText"),
    },
    {
      title: t("onboarding.flowMatchBuyers"),
      description: t("onboarding.flowMatchBuyersText"),
    },
    {
      title: t("onboarding.flowReceiveInquiry"),
      description: t("onboarding.flowReceiveInquiryText"),
    },
    {
      title: t("onboarding.flowExportConversation"),
      description: t("onboarding.flowExportConversationText"),
    },
  ];
  const progressSteps = [
    t("onboarding.progressCompanyProfile"),
    t("onboarding.progressProductInfo"),
    t("onboarding.progressPricingVisibility"),
    t("onboarding.progressShippingCompliance"),
    t("onboarding.progressPublish"),
  ];

  return (
    <aside className="grid gap-4">
      <section className="rounded-[24px] border border-white/10 bg-white/[0.045] p-4 shadow-2xl shadow-black/20 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300/80">
              Trade82
            </p>
            <h2 className="mt-2 text-xl font-semibold text-white">
              {t("onboarding.processTitle")}
            </h2>
          </div>
          <span className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-100">
            {kind === "buyer"
              ? t("roles.americanBuyer")
              : kind === "seller"
                ? t("roles.koreanSeller")
                : t("onboarding.pathPickerLabel")}
          </span>
        </div>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          {t("onboarding.processText")}
        </p>
        <TradeFlowDemo />
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href="#onboarding-current-step"
            className="inline-flex h-10 items-center justify-center rounded-xl bg-white px-4 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
          >
            {t("onboarding.ctaContinueSetup")}
          </a>
          <a
            href="#onboarding-flow-demo"
            className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] px-4 text-sm font-semibold text-zinc-100 transition hover:bg-white/[0.1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
          >
            {t("onboarding.ctaPreviewBuyerView")}
          </a>
        </div>
      </section>

      <section className="rounded-[24px] border border-white/10 bg-white/[0.035] p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-white">
            {t("onboarding.progressTitle")}
          </h3>
          <span className="text-xs font-medium text-zinc-500">1/5</span>
        </div>
        <div className="mt-4 overflow-hidden rounded-full border border-white/10 bg-zinc-950">
          <span className="bm-onboarding-progress block h-2 rounded-full bg-gradient-to-r from-emerald-300 via-blue-300 to-zinc-100" />
        </div>
        <ol className="mt-4 grid gap-2">
          {progressSteps.map((step, index) => (
            <li
              key={step}
              className="group flex items-center gap-3 rounded-xl border border-white/10 bg-zinc-950/70 p-2.5 transition hover:border-emerald-300/30 hover:bg-emerald-300/10"
            >
              <span
                className={cx(
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                  index === 0
                    ? "bg-emerald-300 text-zinc-950"
                    : "border border-white/10 text-zinc-500 group-hover:text-zinc-200",
                )}
              >
                {index + 1}
              </span>
              <span className="text-sm font-medium text-zinc-300">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-[24px] border border-white/10 bg-white/[0.035] p-4 sm:p-5">
        <h3 className="text-base font-semibold text-white">
          {t("onboarding.howItWorksTitle")}
        </h3>
        <div className="mt-4 grid gap-3">
          {flowSteps.map((step, index) => (
            <article
              key={step.title}
              className="bm-section-in rounded-2xl border border-white/10 bg-zinc-950/70 p-3 transition hover:-translate-y-0.5 hover:border-blue-300/30 hover:bg-blue-300/10"
              style={{ animationDelay: `${index * 70}ms` }}
            >
              <div className="flex items-start gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-white text-xs font-semibold text-zinc-950">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold text-zinc-100">
                    {step.title}
                  </h4>
                  <p className="mt-1 text-xs leading-5 text-zinc-500">
                    {step.description}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </aside>
  );
}

function TradeFlowDemo() {
  const { t } = useI18n();

  return (
    <div id="onboarding-flow-demo" className="mt-5 scroll-mt-28 rounded-2xl border border-white/10 bg-zinc-950 p-3">
      <div className="grid gap-3 md:grid-cols-[1fr_0.86fr_1fr] md:items-stretch">
        <DemoColumn
          eyebrow={t("onboarding.demoSellerEyebrow")}
          title={t("onboarding.demoSellerProduct")}
          badge={t("onboarding.demoDraft")}
          tone="emerald"
        >
          <div className="bm-flow-card mt-3 rounded-xl border border-emerald-300/25 bg-emerald-300/10 p-3">
            <div className="h-20 rounded-lg bg-gradient-to-br from-emerald-200/80 to-zinc-100/20" />
            <p className="mt-3 text-sm font-semibold text-zinc-100">
              {t("onboarding.demoProductName")}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {t("onboarding.demoProductMeta")}
            </p>
          </div>
        </DemoColumn>

        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-3">
          <div className="absolute left-0 right-0 top-1/2 hidden h-px bg-gradient-to-r from-emerald-300/0 via-emerald-300/60 to-blue-300/0 md:block" />
          <div className="relative z-10 grid h-full place-items-center rounded-xl border border-white/10 bg-zinc-950/80 p-4 text-center">
            <span className="bm-pulse-dot mb-3 size-2 rounded-full bg-emerald-300" />
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200">
              {t("onboarding.demoTrade82Layer")}
            </p>
            <p className="mt-2 text-sm font-semibold text-white">
              {t("onboarding.demoPublished")}
            </p>
            <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <span className="bm-flow-progress block h-full rounded-full bg-gradient-to-r from-emerald-300 to-blue-300" />
            </div>
          </div>
        </div>

        <DemoColumn
          eyebrow={t("onboarding.demoBuyerEyebrow")}
          title={t("onboarding.demoBuyerInquiry")}
          badge={t("onboarding.demoInquiryReceived")}
          tone="blue"
        >
          <div className="bm-flow-inquiry mt-3 rounded-xl border border-blue-300/25 bg-blue-300/10 p-3">
            <p className="text-sm font-semibold text-zinc-100">
              {t("onboarding.demoInquiryTitle")}
            </p>
            <p className="mt-2 text-xs leading-5 text-zinc-400">
              {t("onboarding.demoInquiryText")}
            </p>
            <div className="mt-3 inline-flex rounded-full border border-blue-300/20 bg-blue-300/10 px-2.5 py-1 text-[11px] font-semibold text-blue-100">
              {t("onboarding.demoQualifiedLead")}
            </div>
          </div>
        </DemoColumn>
      </div>
    </div>
  );
}

function DemoColumn({
  eyebrow,
  title,
  badge,
  tone,
  children,
}: {
  eyebrow: string;
  title: string;
  badge: string;
  tone: "blue" | "emerald";
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
            {eyebrow}
          </p>
          <h3 className="mt-1 text-sm font-semibold text-white">{title}</h3>
        </div>
        <span
          className={cx(
            "shrink-0 rounded-full border px-2 py-1 text-[11px] font-semibold",
            tone === "emerald"
              ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-100"
              : "border-blue-300/25 bg-blue-300/10 text-blue-100",
          )}
        >
          {badge}
        </span>
      </div>
      {children}
    </section>
  );
}
