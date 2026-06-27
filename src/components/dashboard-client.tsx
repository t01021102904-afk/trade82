"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useI18n } from "@/components/i18n-provider";
import { withLocale } from "@/lib/i18n";

export type DashboardSection =
  | "overview"
  | "saved-products"
  | "following"
  | "messages"
  | "products";

type Summary = {
  metrics: Record<string, number>;
  recentReviews: Array<{
    id: string;
    rating: number;
    text: string;
    createdAt: string;
  }>;
  recentInquiries?: Array<{
    id: string;
    message: string;
    companyName: string;
    productName: string | null;
  }>;
  recentSavedItems?: Array<{
    id: string;
    type: "product" | "company";
    displayName: string | null;
    href: string | null;
  }>;
};

type Metric = {
  label: string;
  value: string | number;
  section: DashboardSection;
};

export function DashboardClient({
  role,
  activeSection = "overview",
  onSectionChange,
}: {
  role: "buyer" | "seller";
  activeSection?: DashboardSection;
  onSectionChange?: (section: DashboardSection) => void;
}) {
  const { locale, t } = useI18n();
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    void fetch(`/api/dashboard/summary?role=${role}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((value: Summary | null) => setSummary(value));
  }, [role]);

  if (!summary) {
    return <p className="text-sm text-zinc-600">{t("common.loading")}</p>;
  }

  const recentInquiries = summary.recentInquiries ?? [];
  const recentSavedItems = summary.recentSavedItems ?? [];
  const savedProducts = recentSavedItems.filter((item) => item.type === "product");
  const followingCompanies = recentSavedItems.filter((item) => item.type === "company");
  const metrics: Metric[] =
    role === "seller"
      ? [
          {
            label: t("dashboard.followers"),
            value: summary.metrics.followers ?? 0,
            section: "following",
          },
          {
            label: t("dashboard.productViews"),
            value: summary.metrics.productViews ?? 0,
            section: "products",
          },
          {
            label: t("dashboard.companyViews"),
            value: summary.metrics.companyViews ?? 0,
            section: "overview",
          },
          {
            label: t("dashboard.receivedInquiries"),
            value: summary.metrics.receivedInquiries ?? summary.metrics.inquiryCount ?? 0,
            section: "messages",
          },
          {
            label: t("dashboard.completedDeals"),
            value: summary.metrics.completedDeals ?? 0,
            section: "overview",
          },
          {
            label: t("dashboard.reviewRequests"),
            value: summary.metrics.reviewRequests ?? 0,
            section: "overview",
          },
          {
            label: t("dashboard.publicProducts"),
            value: summary.metrics.listedProductCount ?? 0,
            section: "products",
          },
          {
            label: t("dashboard.reviewCount"),
            value: summary.metrics.reviewCount ?? 0,
            section: "overview",
          },
          {
            label: t("dashboard.averageRating"),
            value: Number(summary.metrics.averageRating ?? 0).toFixed(1),
            section: "overview",
          },
        ]
      : [
          {
            label: t("dashboard.savedProducts"),
            value: summary.metrics.savedProducts ?? 0,
            section: "saved-products",
          },
          {
            label: t("dashboard.savedCompanies"),
            value: summary.metrics.savedCompanies ?? 0,
            section: "following",
          },
          {
            label: t("dashboard.sentInquiries"),
            value: summary.metrics.sentInquiries ?? summary.metrics.inquiryCount ?? 0,
            section: "messages",
          },
          {
            label: t("dashboard.completedDeals"),
            value: summary.metrics.completedDeals ?? 0,
            section: "overview",
          },
          {
            label: t("dashboard.reviewRequests"),
            value: summary.metrics.reviewRequests ?? 0,
            section: "overview",
          },
          {
            label: t("dashboard.recentMessages"),
            value: recentInquiries.length,
            section: "messages",
          },
        ];

  return (
    <div key={`${role}-${activeSection}`} className="bm-section-in grid gap-6">
      {activeSection === "overview" ? (
        <OverviewSection
          role={role}
          metrics={metrics}
          summary={summary}
          locale={locale}
          onSectionChange={onSectionChange}
        />
      ) : null}

      {role === "buyer" && activeSection === "saved-products" ? (
        <SavedItemsPanel
          title={t("dashboard.savedProducts")}
          items={savedProducts}
          emptyText={t("dashboard.noSavedProducts")}
        />
      ) : null}

      {activeSection === "following" ? (
        role === "buyer" ? (
          <SavedItemsPanel
            title={t("dashboard.savedCompanies")}
            items={followingCompanies}
            emptyText={t("dashboard.noSavedCompanies")}
          />
        ) : (
          <StatPanel
            title={t("dashboard.followers")}
            value={summary.metrics.followers ?? 0}
            emptyText={t("dashboard.noFollowers")}
          />
        )
      ) : null}

      {activeSection === "messages" ? (
        <MessagesPanel
          title={role === "buyer" ? t("dashboard.sentInquiries") : t("dashboard.receivedInquiries")}
          inquiries={recentInquiries}
          locale={locale}
          emptyText={t("dashboard.noInquiries")}
        />
      ) : null}

      {role === "seller" && activeSection === "products" ? (
        <SellerProductsPanel
          listedCount={summary.metrics.listedProductCount ?? 0}
          productViews={summary.metrics.productViews ?? 0}
          emptyText={t("dashboard.noListedProducts")}
        />
      ) : null}
    </div>
  );
}

function OverviewSection({
  role,
  metrics,
  summary,
  locale,
  onSectionChange,
}: {
  role: "buyer" | "seller";
  metrics: Metric[];
  summary: Summary;
  locale: "en" | "ko";
  onSectionChange?: (section: DashboardSection) => void;
}) {
  const { t } = useI18n();
  const recentInquiries = summary.recentInquiries ?? [];
  const recentSavedItems = summary.recentSavedItems ?? [];

  return (
    <>
      <MetricGrid metrics={metrics} onSectionChange={onSectionChange} />

      <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <MessagesPanel
          title={t("dashboard.recentMessages")}
          inquiries={recentInquiries}
          locale={locale}
          emptyText={t("dashboard.noInquiries")}
        />

        {role === "seller" ? (
          <ReviewsPanel reviews={summary.recentReviews} />
        ) : (
          <SavedItemsPanel
            title={t("dashboard.recentSavedItems")}
            items={recentSavedItems}
            emptyText={t("dashboard.noRecentSavedItems")}
          />
        )}
      </section>

      {role === "buyer" ? (
        <section className="bm-premium-card rounded-lg border border-zinc-200 bg-white p-5 shadow-sm shadow-zinc-100">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
                {t("dashboard.recentActivity")}
              </p>
              <h2 className="mt-2 text-lg font-semibold text-zinc-950">
                {t("dashboard.recommendedSellers")}
              </h2>
              {(summary.metrics.savedCompanies ?? 0) === 0 ? (
                <p className="mt-1 break-words text-sm leading-6 text-zinc-600">
                  {t("dashboard.noSavedCompanies")}
                </p>
              ) : null}
            </div>
            <Link
              href={withLocale("/sellers", locale)}
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              {t("dashboard.exploreKoreanSellers")}
            </Link>
          </div>
        </section>
      ) : null}
    </>
  );
}

function MetricGrid({
  metrics,
  onSectionChange,
}: {
  metrics: Metric[];
  onSectionChange?: (section: DashboardSection) => void;
}) {
  const { t } = useI18n();

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <button
          key={metric.label}
          type="button"
          onClick={() => onSectionChange?.(metric.section)}
          className="bm-premium-card min-w-0 rounded-lg border border-zinc-200 bg-white p-5 text-left shadow-sm shadow-zinc-100 transition hover:border-blue-200 hover:shadow-md"
        >
          <span className="block truncate text-xs font-medium uppercase tracking-wide text-zinc-500">
            {metric.label}
          </span>
          <span className="mt-3 block truncate text-3xl font-semibold text-zinc-950">
            {metric.value}
          </span>
          <span className="mt-3 block text-sm font-medium text-blue-700">
            {t("dashboard.sectionView")}
          </span>
        </button>
      ))}
    </section>
  );
}

function MessagesPanel({
  title,
  inquiries,
  locale,
  emptyText,
}: {
  title: string;
  inquiries: NonNullable<Summary["recentInquiries"]>;
  locale: "en" | "ko";
  emptyText: string;
}) {
  const { t } = useI18n();

  return (
    <section className="bm-premium-card min-w-0 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm shadow-zinc-100">
      <div className="flex items-center justify-between gap-3">
        <h2 className="truncate text-lg font-semibold text-zinc-950">{title}</h2>
        <Link
          href={withLocale("/messages", locale)}
          className="shrink-0 text-sm font-medium text-blue-700"
        >
          {t("dashboard.viewMessages")}
        </Link>
      </div>
      <div className="mt-4 grid gap-3">
        {inquiries.map((item) => (
          <Link
            key={item.id}
            href={withLocale("/messages", locale)}
            className="min-w-0 rounded-md border border-zinc-200 bg-zinc-50 p-4 transition hover:border-blue-200 hover:bg-white"
          >
            <p className="truncate font-medium text-zinc-950">
              {item.productName || item.companyName}
            </p>
            <p className="mt-1 line-clamp-2 break-words text-sm text-zinc-600">
              {item.message}
            </p>
          </Link>
        ))}
        {!inquiries.length ? <Empty text={emptyText} /> : null}
      </div>
    </section>
  );
}

function SavedItemsPanel({
  title,
  items,
  emptyText,
}: {
  title: string;
  items: NonNullable<Summary["recentSavedItems"]>;
  emptyText: string;
}) {
  const { locale, t } = useI18n();

  return (
    <section className="bm-premium-card min-w-0 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm shadow-zinc-100">
      <h2 className="truncate text-lg font-semibold text-zinc-950">{title}</h2>
      <div className="mt-4 grid gap-3">
        {items.map((item) => {
          const label =
            item.displayName ||
            (item.type === "company"
              ? t("common.followingCompany")
              : t("common.saved"));

          return item.href ? (
            <Link
              key={item.id}
              href={withLocale(item.href, locale)}
              className="min-w-0 rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm font-medium text-zinc-700 transition hover:border-blue-200 hover:bg-white"
            >
              <span className="block truncate">{label}</span>
            </Link>
          ) : (
            <div
              key={item.id}
              className="min-w-0 rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm font-medium text-zinc-700"
            >
              <span className="block truncate">{label}</span>
            </div>
          );
        })}
        {!items.length ? <Empty text={emptyText} /> : null}
      </div>
    </section>
  );
}

function ReviewsPanel({
  reviews,
}: {
  reviews: Summary["recentReviews"];
}) {
  const { t } = useI18n();

  return (
    <section className="bm-premium-card min-w-0 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm shadow-zinc-100">
      <h2 className="truncate text-lg font-semibold text-zinc-950">
        {t("dashboard.recentReviews")}
      </h2>
      <div className="mt-4 grid gap-3">
        {reviews.map((review) => (
          <article
            key={review.id}
            className="min-w-0 rounded-md border border-zinc-200 bg-zinc-50 p-4"
          >
            <p className="text-sm font-medium text-amber-700">{review.rating}/5</p>
            <p className="mt-1 line-clamp-3 break-words text-sm text-zinc-600">
              {review.text}
            </p>
          </article>
        ))}
        {!reviews.length ? <Empty text={t("dashboard.noReviews")} /> : null}
      </div>
    </section>
  );
}

function SellerProductsPanel({
  listedCount,
  productViews,
  emptyText,
}: {
  listedCount: number;
  productViews: number;
  emptyText: string;
}) {
  const { t } = useI18n();

  return (
    <section className="bm-premium-card min-w-0 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm shadow-zinc-100">
      <h2 className="truncate text-lg font-semibold text-zinc-950">
        {t("dashboard.publicProducts")}
      </h2>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="min-w-0 rounded-md border border-zinc-200 bg-zinc-50 p-4">
          <dt className="truncate text-sm text-zinc-500">
            {t("dashboard.publicProducts")}
          </dt>
          <dd className="mt-2 text-3xl font-semibold text-zinc-950">
            {listedCount}
          </dd>
        </div>
        <div className="min-w-0 rounded-md border border-zinc-200 bg-zinc-50 p-4">
          <dt className="truncate text-sm text-zinc-500">
            {t("dashboard.productViews")}
          </dt>
          <dd className="mt-2 text-3xl font-semibold text-zinc-950">
            {productViews}
          </dd>
        </div>
      </dl>
      {listedCount === 0 ? <div className="mt-4"><Empty text={emptyText} /></div> : null}
    </section>
  );
}

function StatPanel({
  title,
  value,
  emptyText,
}: {
  title: string;
  value: number;
  emptyText: string;
}) {
  return (
    <section className="bm-premium-card min-w-0 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm shadow-zinc-100">
      <h2 className="truncate text-lg font-semibold text-zinc-950">{title}</h2>
      <p className="mt-4 text-4xl font-semibold text-zinc-950">{value}</p>
      {value === 0 ? <div className="mt-4"><Empty text={emptyText} /></div> : null}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed border-zinc-300 p-5 text-sm text-zinc-600">
      {text}
    </div>
  );
}
