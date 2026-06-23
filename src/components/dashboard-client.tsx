"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useI18n } from "@/components/i18n-provider";
import { withLocale } from "@/lib/i18n";

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

export function DashboardClient({ role }: { role: "buyer" | "seller" }) {
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

  const metrics =
    role === "seller"
      ? [
          [t("dashboard.productViews"), summary.metrics.productViews ?? 0],
          [t("dashboard.companyViews"), summary.metrics.companyViews ?? 0],
          [t("dashboard.savedCount"), summary.metrics.savedCount ?? 0],
          [t("dashboard.inquiryCount"), summary.metrics.inquiryCount ?? 0],
          [t("dashboard.reviewCount"), summary.metrics.reviewCount ?? 0],
          [
            t("dashboard.averageRating"),
            Number(summary.metrics.averageRating ?? 0).toFixed(1),
          ],
        ]
      : [
          [t("dashboard.savedProducts"), summary.metrics.savedProducts ?? 0],
          [t("dashboard.savedCompanies"), summary.metrics.savedCompanies ?? 0],
          [t("dashboard.sentInquiries"), summary.metrics.inquiryCount ?? 0],
          [t("dashboard.reviewedDeals"), summary.metrics.reviewedDeals ?? 0],
        ];

  return (
    <div className="grid gap-8">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map(([label, value]) => (
          <div
            key={String(label)}
            className="rounded-lg border border-zinc-200 bg-white p-5"
          >
            <p className="text-sm text-zinc-500">{label}</p>
            <p className="mt-2 text-3xl font-semibold text-zinc-950">{value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-zinc-950">
              {t("dashboard.recentInquiries")}
            </h2>
            <Link
              href={withLocale("/messages", locale)}
              className="text-sm font-medium text-blue-700"
            >
              {t("dashboard.viewMessages")}
            </Link>
          </div>
          <div className="mt-4 grid gap-3">
            {(summary.recentInquiries ?? []).map((item) => (
              <Link
                key={item.id}
                href={withLocale("/messages", locale)}
                className="rounded-md border border-zinc-100 bg-zinc-50 p-4"
              >
                <p className="font-medium text-zinc-950">
                  {item.productName || item.companyName}
                </p>
                <p className="mt-1 line-clamp-2 text-sm text-zinc-600">
                  {item.message}
                </p>
              </Link>
            ))}
            {!(summary.recentInquiries ?? []).length ? (
              <Empty text={t("dashboard.noInquiries")} />
            ) : null}
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-zinc-950">
            {role === "seller"
              ? t("dashboard.recentReviews")
              : t("dashboard.recentSavedItems")}
          </h2>
          <div className="mt-4 grid gap-3">
            {role === "seller"
              ? summary.recentReviews.map((review) => (
                  <article
                    key={review.id}
                    className="rounded-md border border-zinc-100 bg-zinc-50 p-4"
                  >
                    <p className="text-sm font-medium text-amber-700">
                      {review.rating}/5
                    </p>
                    <p className="mt-1 line-clamp-3 text-sm text-zinc-600">
                      {review.text}
                    </p>
                  </article>
                ))
              : (summary.recentSavedItems ?? []).map((item) =>
                  item.href ? (
                    <Link
                      key={item.id}
                      href={withLocale(item.href, locale)}
                      className="rounded-md border border-zinc-100 bg-zinc-50 p-4 text-sm font-medium text-zinc-700"
                    >
                      {item.displayName || t("common.saved")}
                    </Link>
                  ) : null,
                )}
            {role === "seller" && !summary.recentReviews.length ? (
              <Empty text={t("dashboard.noReviews")} />
            ) : null}
            {role === "buyer" &&
            !(summary.recentSavedItems ?? []).length ? (
              <Empty text={t("dashboard.noRecentSavedItems")} />
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed border-zinc-300 p-5 text-sm text-zinc-600">
      {text}
    </div>
  );
}
