import Link from "next/link";
import type { ReactNode } from "react";

import {
  type AdminPartnerListData,
  type AdminPartnerListQuery,
  type AdminPartnerPayoutFilter,
  type AdminPartnerSort,
  type AdminPartnerStatusFilter,
} from "@/lib/admin-partners";
import { createTranslator, getDictionary, type Locale, withLocale } from "@/lib/i18n";

function date(value: Date, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
    dateStyle: "medium",
  }).format(value);
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value / 100);
}

const statusLabels: Record<AdminPartnerStatusFilter, string> = {
  all: "partnerStatusAll",
  active: "partnerStatusActive",
  suspended: "partnerStatusSuspended",
};

const payoutLabels: Record<AdminPartnerPayoutFilter, string> = {
  all: "partnerPayoutAll",
  notStarted: "partnerPayoutNotStarted",
  pending: "partnerPayoutPending",
  enabled: "partnerPayoutEnabled",
  restricted: "partnerPayoutRestricted",
  disabled: "partnerPayoutDisabled",
};

const sortLabels: Record<AdminPartnerSort, string> = {
  newest: "partnerSortNewest",
  oldest: "partnerSortOldest",
  clicks: "partnerSortClicks",
  uniqueVisitors: "partnerSortUniqueVisitors",
  signups: "partnerSortSignups",
  sellerRegistrations: "partnerSortSellerRegistrations",
  buyerRegistrations: "partnerSortBuyerRegistrations",
  netCommission: "partnerSortNetCommission",
};

export function AdminPartnerManagement({
  locale,
  data,
  query,
}: {
  locale: Locale;
  data: AdminPartnerListData;
  query: AdminPartnerListQuery;
}) {
  const t = createTranslator(getDictionary(locale));
  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const pageHref = (page: number) => {
    const params = new URLSearchParams();
    if (query.search) params.set("search", query.search);
    if (query.status !== "all") params.set("status", query.status);
    if (query.country) params.set("country", query.country);
    if (query.payoutSetup !== "all") params.set("payoutSetup", query.payoutSetup);
    if (query.sort !== "newest") params.set("sort", query.sort);
    if (query.pageSize !== 25) params.set("pageSize", String(query.pageSize));
    params.set("page", String(page));
    return `${withLocale("/admin/partners", locale)}?${params.toString()}`;
  };

  return (
    <section aria-labelledby="admin-partners-table" className="grid gap-6">
      <form
        method="get"
        action={withLocale("/admin/partners", locale)}
        className="grid gap-4 border p-5 theme-border theme-surface-elevated lg:grid-cols-[minmax(16rem,2fr)_repeat(4,minmax(8rem,1fr))]"
      >
        <label className="grid gap-2 text-sm font-medium theme-foreground lg:col-span-2">
          {t("admin.partnerSearch")}
          <input
            type="search"
            name="search"
            defaultValue={query.search}
            maxLength={100}
            placeholder={t("admin.partnerSearchPlaceholder")}
            className="min-h-10 rounded-md border px-3 font-normal theme-border theme-surface"
          />
        </label>
        <SelectField name="status" label={t("admin.partnerStatusFilter")} value={query.status}>
          {(["all", "active", "suspended"] as const).map((value) => (
            <option key={value} value={value}>{t(`admin.${statusLabels[value]}`)}</option>
          ))}
        </SelectField>
        <SelectField name="country" label={t("admin.partnerCountryFilter")} value={query.country ?? ""}>
          <option value="">{t("admin.partnerAllCountries")}</option>
          {data.countries.map((country) => <option key={country} value={country}>{country}</option>)}
        </SelectField>
        <SelectField name="payoutSetup" label={t("admin.partnerPayoutFilter")} value={query.payoutSetup}>
          {(["all", "notStarted", "pending", "enabled", "restricted", "disabled"] as const).map((value) => (
            <option key={value} value={value}>{t(`admin.${payoutLabels[value]}`)}</option>
          ))}
        </SelectField>
        <SelectField name="sort" label={t("admin.partnerSort")} value={query.sort}>
          {(["newest", "oldest", "clicks", "uniqueVisitors", "signups", "sellerRegistrations", "buyerRegistrations", "netCommission"] as const).map((value) => (
            <option key={value} value={value}>{t(`admin.${sortLabels[value]}`)}</option>
          ))}
        </SelectField>
        <div className="flex items-end lg:col-span-2">
          <button type="submit" className="min-h-10 rounded-md border px-4 text-sm font-medium theme-secondary-button">
            {t("admin.partnerSearch")}
          </button>
        </div>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="admin-partners-table" className="text-lg font-semibold theme-foreground">
          {data.total} {t("admin.partnerCount")}
        </h2>
        <p className="text-sm theme-muted">
          {t("admin.partnerAllTimeMetrics")}
        </p>
      </div>

      {data.invalidPage ? (
        <div className="border p-8 theme-border theme-surface-elevated">
          <h3 className="font-semibold theme-foreground">{t("admin.partnerInvalidPage")}</h3>
          <p className="mt-2 text-sm theme-muted">{t("admin.partnerInvalidPageDescription")}</p>
          <Link
            href={pageHref(1)}
            className="mt-4 inline-block text-sm font-medium underline theme-foreground"
          >
            {t("admin.partnerBackToFirstPage")}
          </Link>
        </div>
      ) : data.rows.length === 0 ? (
        <div className="border p-8 theme-border theme-surface-elevated">
          <h3 className="font-semibold theme-foreground">{t("admin.partnerNoPartners")}</h3>
          <p className="mt-2 text-sm theme-muted">{t("admin.partnerNoPartnersDescription")}</p>
        </div>
      ) : (
        <div className="overflow-x-auto border theme-border theme-surface-elevated">
          <table className="w-full min-w-[1360px] text-left text-sm">
            <thead className="border-b theme-border theme-muted">
              <tr>
                <Header label={t("admin.partnerDisplayName")} />
                <Header label={t("admin.partnerLegalName")} />
                <Header label={t("admin.partnerOrganization")} />
                <Header label={t("admin.partnerContactEmail")} />
                <Header label={t("admin.partnerCountry")} />
                <Header label={t("admin.partnerLanguage")} />
                <Header label={t("admin.partnerStatus")} />
                <Header label={t("admin.partnerReferralCode")} />
                <Header label={t("admin.partnerJoined")} />
                <Header label={t("admin.partnerLinkVisits")} numeric />
                <Header label={t("admin.partnerUniqueVisitors")} numeric />
                <Header label={t("admin.partnerAttributedSignups")} numeric />
                <Header label={t("admin.partnerSellerRegistrations")} numeric />
                <Header label={t("admin.partnerBuyerRegistrations")} numeric />
                <Header label={t("admin.partnerQualifyingTransactions")} numeric />
                <Header label={t("admin.partnerNetCommission")} numeric />
                <Header label={t("admin.partnerPayoutSetup")} />
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.id} className="border-b align-top theme-border">
                  <td className="p-3">
                    <Link
                      href={withLocale(`/admin/partners/${encodeURIComponent(row.id)}`, locale)}
                      className="font-medium underline theme-foreground"
                    >
                      {row.displayName ?? row.legalName ?? row.organizationName ?? t("admin.partnerUnknown")}
                    </Link>
                  </td>
                  <td className="p-3 theme-muted">{row.legalName ?? "-"}</td>
                  <td className="p-3 theme-muted">{row.organizationName ?? "-"}</td>
                  <td className="p-3 theme-muted">{row.contactEmail ?? "-"}</td>
                  <td className="p-3 theme-muted">{row.country ?? "-"}</td>
                  <td className="p-3 theme-muted">{row.preferredLanguage ?? "-"}</td>
                  <td className="p-3">{t(`admin.${row.status === "ACTIVE" ? "partnerStatusActive" : "partnerStatusSuspended"}`)}</td>
                  <td className="p-3 font-mono text-xs">{row.referralCode}</td>
                  <td className="p-3 whitespace-nowrap theme-muted">{date(row.createdAt, locale)}</td>
                  <td className="p-3 text-right tabular-nums">{row.linkVisits}</td>
                  <td className="p-3 text-right tabular-nums">{row.uniqueVisitors}</td>
                  <td className="p-3 text-right tabular-nums">{row.attributedSignups}</td>
                  <td className="p-3 text-right tabular-nums">{row.sellerRegistrations}</td>
                  <td className="p-3 text-right tabular-nums">{row.buyerRegistrations}</td>
                  <td className="p-3 text-right tabular-nums">{row.qualifyingTransactions}</td>
                  <td className="p-3 text-right tabular-nums">
                    {row.hasNonUsdCommission ? t("admin.partnerMultipleCurrencies") : money(row.netCommissionUsd)}
                  </td>
                  <td className="p-3">{t(`admin.${payoutLabels[row.payoutSetup]}`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 ? (
        <nav aria-label={t("admin.partnerManagementTitle")} className="flex items-center gap-4 text-sm">
          <Link href={pageHref(Math.max(1, query.page - 1))} aria-disabled={query.page === 1} className="theme-muted hover:text-[var(--foreground)]">
            {t("admin.partnerPrevious")}
          </Link>
          <span className="theme-muted">{query.page} / {totalPages}</span>
          <Link href={pageHref(Math.min(totalPages, query.page + 1))} aria-disabled={query.page === totalPages} className="theme-muted hover:text-[var(--foreground)]">
            {t("admin.partnerNext")}
          </Link>
        </nav>
      ) : null}
    </section>
  );
}

function SelectField({
  name,
  label,
  value,
  children,
}: {
  name: string;
  label: string;
  value: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium theme-foreground">
      {label}
      <select name={name} defaultValue={value} className="min-h-10 rounded-md border px-3 font-normal theme-border theme-surface">
        {children}
      </select>
    </label>
  );
}

function Header({ label, numeric = false }: { label: string; numeric?: boolean }) {
  return <th className={`p-3 font-medium ${numeric ? "text-right" : ""}`}>{label}</th>;
}
