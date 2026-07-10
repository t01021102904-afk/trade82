"use client";

import { ArrowRight, CheckCircle2, Megaphone, PackageCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { BackButton } from "@/components/back-button";
import { useI18n } from "@/components/i18n-provider";
import { ProductImage } from "@/components/product-image";
import { SectionHeader } from "@/components/section-header";
import { withLocale } from "@/lib/i18n";
import {
  MARKETING_EXPOSURE_PLANS,
  type MarketingExposurePlanId,
} from "@/lib/marketing-exposure-shared";
import { cx } from "@/lib/utils";

type AccountProduct = {
  id: string;
  name: string;
  nameEn?: string | null;
  status: string;
  category: string;
  imageUrl?: string | null;
  sellerCompany?: { verificationStatus?: string | null } | null;
  images?: Array<{
    cardUrl?: string | null;
    mainUrl?: string | null;
    detailUrl?: string | null;
  }>;
};

type MarketingExposure = {
  id: string;
  productId: string;
  plan: string;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  productName: string;
  productNameEn: string;
  productStatus: string;
  imageUrl: string | null;
};

const copy = {
  en: {
    label: "Marketing",
    title: "Trade82 Marketing",
    description:
      "Promote your product on the Trade82 landing page and reach global buyers.",
    productTitle: "Select product",
    productDescription:
      "Only active listed products from your seller account can be promoted.",
    noProducts:
      "No active listed products are available. Publish a product before starting a marketing exposure.",
    activeTitle: "Current active marketing exposures",
    noActive: "No active product exposures yet.",
    success:
      "Your product exposure purchase was received. The product will appear after payment confirmation.",
    error: "Marketing checkout could not be started.",
    selectProduct: "Select a product first.",
    promote: "Promote this product",
    loading: "Starting checkout...",
    oneTime: "one-time",
    days: "days",
    active: "Active",
    promoted: "Promoted",
    until: "Until",
    planTitles: {
      landing_7d: "Landing Page Exposure - 7 Days",
      landing_30d: "Landing Page Exposure - 30 Days",
      landing_90d: "Landing Page Exposure - 3 Months",
    },
    planDescriptions: {
      landing_7d:
        "Short campaign placement for a newly listed product or seasonal push.",
      landing_30d:
        "A full-month landing page exposure window for consistent buyer visibility.",
      landing_90d:
        "Longer visibility for priority products and ongoing sourcing demand.",
    },
  },
  ko: {
    label: "마케팅",
    title: "Trade82 마케팅",
    description:
      "Trade82 랜딩페이지에 상품을 노출하여 글로벌 바이어에게 더 많이 보여주세요.",
    productTitle: "상품 선택",
    productDescription:
      "셀러 계정에 등록된 공개 상품만 랜딩페이지 광고에 사용할 수 있습니다.",
    noProducts:
      "광고할 수 있는 공개 상품이 없습니다. 먼저 상품을 공개 상태로 등록해 주세요.",
    activeTitle: "현재 진행 중인 상품 노출",
    noActive: "현재 진행 중인 상품 노출이 없습니다.",
    success:
      "상품 노출 결제가 접수되었습니다. 결제 확인 후 랜딩페이지에 노출됩니다.",
    error: "결제를 시작할 수 없습니다.",
    selectProduct: "먼저 상품을 선택해 주세요.",
    promote: "이 제품 광고하기",
    loading: "결제 페이지 준비 중...",
    oneTime: "1회 결제",
    days: "일",
    active: "진행 중",
    promoted: "광고 중",
    until: "종료일",
    planTitles: {
      landing_7d: "랜딩페이지 노출 - 7일",
      landing_30d: "랜딩페이지 노출 - 30일",
      landing_90d: "랜딩페이지 노출 - 3개월",
    },
    planDescriptions: {
      landing_7d: "신규 상품이나 시즌 상품을 짧게 노출하기 좋은 플랜입니다.",
      landing_30d: "한 달 동안 랜딩페이지에서 꾸준히 바이어에게 노출됩니다.",
      landing_90d: "핵심 상품을 더 오래 노출하고 지속적인 소싱 수요를 확보합니다.",
    },
  },
};

export function SellerMarketingPage({
  embedded = false,
  initialSuccess = false,
}: {
  embedded?: boolean;
  initialSuccess?: boolean;
}) {
  const { locale } = useI18n();
  const text = copy[locale];
  const [products, setProducts] = useState<AccountProduct[]>([]);
  const [exposures, setExposures] = useState<MarketingExposure[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingPlan, setLoadingPlan] = useState<MarketingExposurePlanId | null>(null);
  const [error, setError] = useState("");
  const success = initialSuccess;

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/account/products", { cache: "no-store" }),
      fetch("/api/account/marketing-exposures", { cache: "no-store" }),
    ])
      .then(async ([productsResponse, exposuresResponse]) => {
        const productsBody = productsResponse.ok
          ? ((await productsResponse.json()) as AccountProduct[])
          : [];
        const exposuresBody = exposuresResponse.ok
          ? ((await exposuresResponse.json()) as { exposures?: MarketingExposure[] })
          : { exposures: [] };
        if (!active) return;
        const listedProducts = productsBody.filter(
          (product) =>
            product.status === "active" &&
            product.sellerCompany?.verificationStatus === "verified",
        );
        setProducts(listedProducts);
        setExposures(exposuresBody.exposures ?? []);
        setSelectedProductId((current) => current || listedProducts[0]?.id || "");
      })
      .catch(() => {
        if (!active) return;
        setProducts([]);
        setExposures([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const activeExposures = useMemo(
    () => exposures.filter((exposure) => isCurrentlyActiveExposure(exposure)),
    [exposures],
  );
  const activelyPromotedProductIds = useMemo(
    () => new Set(activeExposures.map((exposure) => exposure.productId)),
    [activeExposures],
  );

  const startCheckout = async (plan: MarketingExposurePlanId) => {
    setError("");
    if (!selectedProductId) {
      setError(text.selectProduct);
      return;
    }
    setLoadingPlan(plan);
    try {
      const successPath = embedded
        ? withLocale("/dashboard/seller?section=marketing&marketing=success", locale)
        : withLocale("/pricing?marketing=success", locale);
      const cancelPath = embedded
        ? withLocale("/dashboard/seller?section=marketing", locale)
        : withLocale("/pricing", locale);
      const response = await fetch("/api/stripe/marketing-exposure-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selectedProductId,
          plan,
          successPath,
          cancelPath,
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
    <div className={embedded ? "" : "theme-bg"}>
      <div
        className={cx(
          "mx-auto grid gap-6",
          embedded ? "" : "max-w-7xl px-4 py-10 sm:px-6 lg:px-8",
        )}
      >
        {!embedded ? <BackButton fallbackHref="/dashboard/seller" /> : null}
        <SectionHeader
          label={text.label}
          title={text.title}
          description={text.description}
        />

        {success ? (
          <p className="rounded-xl border px-3 py-2 text-sm theme-success-badge">
            {text.success}
          </p>
        ) : null}
        {error ? (
          <p className="rounded-xl border px-3 py-2 text-sm theme-danger-badge">
            {error}
          </p>
        ) : null}

        <section className="rounded-2xl border p-4 theme-surface-elevated sm:p-5">
          <div className="flex items-start gap-3">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl border theme-surface-muted">
              <PackageCheck className="size-4 theme-success-text" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-base font-semibold theme-foreground">
                {text.productTitle}
              </h2>
              <p className="mt-1 text-sm theme-muted">{text.productDescription}</p>
            </div>
          </div>

          {loading ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }, (_, index) => (
                <div
                  key={index}
                  className="h-28 animate-pulse rounded-xl theme-surface-muted"
                  aria-hidden="true"
                />
              ))}
            </div>
          ) : products.length ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((product) => {
                const selected = selectedProductId === product.id;
                const promoted = activelyPromotedProductIds.has(product.id);
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => setSelectedProductId(product.id)}
                    className={cx(
                      "grid grid-cols-[72px_1fr] gap-3 rounded-xl border p-2 text-left transition",
                      selected
                        ? "border-emerald-400 bg-emerald-50/70 text-emerald-950 shadow-sm"
                        : "theme-surface hover:-translate-y-0.5",
                    )}
                  >
                    <ProductImage
                      urls={[primaryProductImage(product), product.imageUrl]}
                      alt={localizedProductName(product, locale)}
                      sizes="72px"
                      className="aspect-square rounded-lg"
                      imageClassName="object-contain bg-white p-1"
                      showLabel={false}
                    />
                    <span className="min-w-0 self-center">
                      <span className="line-clamp-2 text-sm font-semibold">
                        {localizedProductName(product, locale)}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs theme-muted">
                        <span>{product.category}</span>
                        <span aria-hidden="true">·</span>
                        <span>{text.active}</span>
                        {promoted ? (
                          <span className="rounded-full border px-1.5 py-0.5 text-[10px] font-semibold theme-success-badge">
                            {text.promoted}
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="mt-5 rounded-xl border border-dashed px-4 py-6 text-center text-sm theme-muted">
              {text.noProducts}
            </p>
          )}
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          {MARKETING_EXPOSURE_PLANS.map((plan) => {
            const loadingPlanId = loadingPlan === plan.id;
            const highlighted = plan.id === "landing_30d";
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
                      {text.planTitles[plan.id]}
                    </h2>
                    <p className="mt-2 text-sm leading-6 theme-muted">
                      {text.planDescriptions[plan.id]}
                    </p>
                  </div>
                  <span className="inline-flex size-9 items-center justify-center rounded-xl border theme-surface-muted">
                    <Megaphone className="size-4 theme-success-text" aria-hidden="true" />
                  </span>
                </div>

                <p className="mt-5 text-3xl font-semibold theme-foreground">
                  ${plan.price}
                  <span className="ml-1 text-sm font-medium theme-muted">
                    {text.oneTime}
                  </span>
                </p>
                <p className="mt-2 text-sm font-medium theme-foreground">
                  {plan.durationDays} {text.days}
                </p>

                <button
                  type="button"
                  onClick={() => startCheckout(plan.id)}
                  disabled={Boolean(loadingPlan) || !selectedProductId}
                  className={cx(
                    "mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
                    highlighted ? "theme-primary-button" : "theme-secondary-button",
                  )}
                >
                  {loadingPlanId ? text.loading : text.promote}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </button>
              </article>
            );
          })}
        </section>

        <section className="rounded-2xl border p-5 theme-surface-elevated">
          <h2 className="text-base font-semibold theme-foreground">
            {text.activeTitle}
          </h2>
          {activeExposures.length ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {activeExposures.map((exposure) => (
                <article
                  key={exposure.id}
                  className="grid grid-cols-[64px_1fr] gap-3 rounded-xl border p-3 theme-surface"
                >
                  <ProductImage
                    urls={[exposure.imageUrl]}
                    alt={localizedExposureName(exposure, locale)}
                    sizes="64px"
                    className="aspect-square rounded-lg"
                    imageClassName="object-contain bg-white p-1"
                    showLabel={false}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs font-medium theme-success-text">
                      <CheckCircle2 className="size-3.5" aria-hidden="true" />
                      {text.active}
                    </div>
                    <h3 className="mt-1 line-clamp-2 text-sm font-semibold theme-foreground">
                      {localizedExposureName(exposure, locale)}
                    </h3>
                    {exposure.endsAt ? (
                      <p className="mt-1 text-xs theme-muted">
                        {text.until} {formatDate(exposure.endsAt, locale)}
                      </p>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-xl border border-dashed px-4 py-6 text-center text-sm theme-muted">
              {text.noActive}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

function primaryProductImage(product: AccountProduct) {
  const firstImage = product.images?.[0];
  return firstImage?.cardUrl || firstImage?.mainUrl || firstImage?.detailUrl || null;
}

function localizedProductName(product: AccountProduct, locale: "en" | "ko") {
  if (locale === "en" && product.nameEn?.trim()) return product.nameEn.trim();
  return product.name;
}

function localizedExposureName(exposure: MarketingExposure, locale: "en" | "ko") {
  if (locale === "en" && exposure.productNameEn?.trim()) {
    return exposure.productNameEn.trim();
  }
  return exposure.productName;
}

function isCurrentlyActiveExposure(exposure: MarketingExposure) {
  const now = Date.now();
  const startsAt = exposure.startsAt ? new Date(exposure.startsAt).getTime() : 0;
  const endsAt = exposure.endsAt ? new Date(exposure.endsAt).getTime() : 0;
  return (
    exposure.status === "ACTIVE" &&
    Number.isFinite(startsAt) &&
    Number.isFinite(endsAt) &&
    startsAt <= now &&
    endsAt > now &&
    exposure.productStatus === "active"
  );
}

function formatDate(value: string, locale: "en" | "ko") {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}
