"use client";

import { ArrowRight, CheckCircle2, LifeBuoy } from "lucide-react";
import { useState } from "react";

import { BackButton } from "@/components/back-button";
import { useI18n } from "@/components/i18n-provider";
import { SectionHeader } from "@/components/section-header";
import { SELLER_SUPPORT_PLANS, type SellerSupportPlanId } from "@/lib/seller-support";
import { withLocale } from "@/lib/i18n";
import { cx } from "@/lib/utils";

const supportItems = [
  "U.S. buyer-facing English product/company copy",
  "Trade82 product/company page improvement",
  "Buyer inquiry reply copy",
  "MOQ, sample, and supply condition wording",
  "U.S. buyer outreach copy",
  "Product name/product description optimization",
  "Company introduction improvement",
  "Sample request reply copy",
  "Wholesale price inquiry reply copy",
  "Buyer FAQ answer preparation",
  "Product one-pager copy improvement",
  "Monthly progress summary",
];

const copy = {
  en: {
    label: "Seller Support",
    title: "Trade82 Support Team",
    description:
      "Monthly support for Korean sellers preparing U.S. buyer-facing materials, inquiry replies, and product page improvements.",
    requestPlan: "Request Plan",
    perMonth: "/ month",
    requestsPerMonth: "support requests / month",
    itemsPerMonth: "support items / month",
    priority: "Priority support",
    included: "Support items can include",
    error: "Checkout could not be started.",
    loading: "Starting checkout...",
    plans: {
      starter:
        "For sellers who want light product/page improvement for U.S. buyers.",
      growth:
        "For sellers who want ongoing support for buyer replies, product copy, and outreach preparation.",
      full: "For sellers who want full monthly support for U.S. buyer-facing materials, inquiry replies, outreach copy, and product page improvement.",
    },
  },
  ko: {
    label: "셀러 지원",
    title: "Trade82 지원팀",
    description:
      "미국 바이어 대상 상품/회사 소개, 문의 답변, 상품 페이지 개선을 위한 월간 셀러 지원 플랜입니다.",
    requestPlan: "플랜 요청",
    perMonth: "/ 월",
    requestsPerMonth: "지원 요청 / 월",
    itemsPerMonth: "지원 항목 / 월",
    priority: "우선 지원",
    included: "지원 항목 예시",
    error: "결제를 시작할 수 없습니다.",
    loading: "결제 페이지 준비 중...",
    plans: {
      starter: "미국 바이어용 상품/페이지 개선을 가볍게 시작하려는 셀러에게 적합합니다.",
      growth: "바이어 답변, 상품 카피, 아웃리치 준비를 지속적으로 지원받고 싶은 셀러에게 적합합니다.",
      full: "미국 바이어용 자료, 문의 답변, 아웃리치 카피, 상품 페이지 개선을 월간으로 폭넓게 지원받고 싶은 셀러에게 적합합니다.",
    },
  },
};

export function SellerSupportPricingPage() {
  const { locale } = useI18n();
  const text = copy[locale];
  const [loadingPlan, setLoadingPlan] = useState<SellerSupportPlanId | null>(null);
  const [error, setError] = useState("");

  const startCheckout = async (supportPlan: SellerSupportPlanId) => {
    setError("");
    setLoadingPlan(supportPlan);
    try {
      const response = await fetch("/api/stripe/support-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supportPlan,
          successPath: withLocale("/dashboard/seller?section=support-team", locale),
          cancelPath: withLocale("/pricing", locale),
        }),
      });
      const body = (await response.json().catch(() => null)) as
        | { url?: string; error?: string }
        | null;
      if (!response.ok || !body?.url) {
        throw new Error(body?.error || text.error);
      }
      window.location.assign(body.url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.error);
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="theme-bg">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:px-8">
        <BackButton fallbackHref="/dashboard/seller" />
        <SectionHeader
          label={text.label}
          title={text.title}
          description={text.description}
        />

        {error ? (
          <p className="rounded-xl border px-3 py-2 text-sm theme-danger-badge">
            {error}
          </p>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-3">
          {SELLER_SUPPORT_PLANS.map((plan) => {
            const highlighted = plan.id === "full";
            const loading = loadingPlan === plan.id;
            return (
              <article
                key={plan.id}
                className={cx(
                  "rounded-2xl border p-5 transition theme-surface-elevated theme-card-hover",
                  highlighted ? "ring-2 ring-emerald-400/40" : "",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold theme-foreground">
                      {plan.name}
                    </h2>
                    {plan.priority ? (
                      <p className="mt-1 text-xs font-medium theme-success-text">
                        {text.priority}
                      </p>
                    ) : null}
                  </div>
                  <span className="inline-flex size-9 items-center justify-center rounded-xl border theme-surface-muted">
                    <LifeBuoy className="size-4 theme-success-text" aria-hidden="true" />
                  </span>
                </div>

                <p className="mt-5 text-3xl font-semibold theme-foreground">
                  ${plan.price}
                  <span className="ml-1 text-sm font-medium theme-muted">
                    {text.perMonth}
                  </span>
                </p>
                <p className="mt-2 text-sm font-medium theme-foreground">
                  {plan.monthlyLimit}{" "}
                  {plan.id === "full" ? text.itemsPerMonth : text.requestsPerMonth}
                </p>
                <p className="mt-3 min-h-20 text-sm leading-6 theme-muted">
                  {text.plans[plan.id]}
                </p>

                <button
                  type="button"
                  onClick={() => startCheckout(plan.id)}
                  disabled={Boolean(loadingPlan)}
                  className={cx(
                    "mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
                    highlighted ? "theme-primary-button" : "theme-secondary-button",
                  )}
                >
                  {loading ? text.loading : text.requestPlan}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </button>
              </article>
            );
          })}
        </section>

        <section className="rounded-2xl border p-5 theme-surface-elevated">
          <h2 className="text-base font-semibold theme-foreground">
            {text.included}
          </h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {supportItems.map((item) => (
              <div key={item} className="flex gap-2 text-sm leading-6 theme-muted">
                <CheckCircle2
                  className="mt-0.5 size-4 shrink-0 theme-success-text"
                  aria-hidden="true"
                />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
