import Link from "next/link";

import { PartnerReferralLink } from "@/components/partner-referral-link";
import { createTranslator, getDictionary, type Locale } from "@/lib/i18n";
import { withLocale } from "@/lib/i18n";
import {
  partnerPayoutSetupStatus,
  partnerProfileStatus,
  type getPartnerDashboardData,
} from "@/lib/partner-dashboard";

type DashboardData = NonNullable<
  Awaited<ReturnType<typeof getPartnerDashboardData>>
>;

function money(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

function date(value: Date, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
    dateStyle: "medium",
  }).format(value);
}

export function PartnerDashboardView({
  locale,
  data,
  referralUrl,
}: {
  locale: Locale;
  data: DashboardData;
  referralUrl: string;
}) {
  const t = createTranslator(getDictionary(locale));
  const statusKey = (status: string) => {
    const keys: Record<string, string> = {
      pending: "statusPending",
      available: "statusAvailable",
      processing: "statusProcessing",
      paid: "statusPaid",
      under_review: "statusUnderReview",
      cancelled: "statusCancelled",
    };
    return t(`partnerProgram.${keys[status] ?? "statusPending"}`);
  };
  const roleLabel = (role: string) => {
    const roleKey = role === "user" ? "roles.generalUser" : `roles.${role}`;
    return t(roleKey);
  };
  const profileStatus = partnerProfileStatus(data.partner.status);
  const payoutStatus = partnerPayoutSetupStatus(data.partner.stripeAccount);
  const summary = [
    ["gross", data.totals.gross],
    ["adjustments", data.totals.adjustments],
    ["net", data.totals.net],
    ["available", data.totals.available],
    ["pending", data.totals.pending],
    ["processing", data.totals.processing],
    ["paid", data.totals.paid],
    ["underReview", data.totals.underReview],
  ] as const;

  return (
    <main className="bm-grid-surface min-h-[calc(100vh-4rem)] theme-bg">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight theme-foreground">
              {t("partnerProgram.dashboardTitle")}
            </h1>
            <p className="mt-2 text-sm theme-muted">
              {t("partnerProgram.disclosure")}
            </p>
          </div>
          <div className="rounded-full border px-3 py-1 text-xs font-semibold theme-border theme-surface-muted">
            {t(
              `partnerProgram.partnerStatus${profileStatus === "active" ? "Active" : "Suspended"}`,
            )}
          </div>
        </div>

        <section
          className="border p-5 theme-border theme-surface-elevated"
          aria-labelledby="partner-referral-link"
        >
          <h2
            id="partner-referral-link"
            className="text-base font-semibold theme-foreground"
          >
            {t("partnerProgram.referralLink")}
          </h2>
          <div className="mt-3">
            <PartnerReferralLink referralUrl={referralUrl} />
          </div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs theme-muted">
                {t("partnerProgram.referralCode")}
              </dt>
              <dd className="mt-1 font-mono theme-foreground">
                {data.partner.referralCode}
              </dd>
            </div>
            <div>
              <dt className="text-xs theme-muted">
                {t("partnerProgram.memberSince")}
              </dt>
              <dd className="mt-1 theme-foreground">
                {date(data.partner.createdAt, locale)}
              </dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="partner-summary">
          <h2
            id="partner-summary"
            className="text-lg font-semibold theme-foreground"
          >
            {t("partnerProgram.summary")}
          </h2>
          <div className="mt-3 grid gap-px overflow-hidden border theme-border sm:grid-cols-2 lg:grid-cols-4">
            {summary.map(([label, amount]) => (
              <div key={label} className="bg-[var(--background)] p-4">
                <p className="text-xs font-medium theme-muted">
                  {t(`partnerProgram.${label}`)}
                </p>
                <p className="mt-2 text-xl font-semibold theme-foreground">
                  {money(amount, data.totals.currency)}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="border p-5 theme-border theme-surface-elevated">
            <h2 className="text-base font-semibold theme-foreground">
              {t("partnerProgram.commissionHistory")}
            </h2>
            {data.commissionHistory.length ? (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="border-b theme-border theme-muted">
                    <tr>
                      <th className="pb-2 pr-3 font-medium">
                        {t("partnerProgram.transactionDate")}
                      </th>
                      <th className="pb-2 pr-3 font-medium">
                        {t("partnerProgram.transaction")}
                      </th>
                      <th className="pb-2 pr-3 font-medium">
                        {t("partnerProgram.grossTransaction")}
                      </th>
                      <th className="pb-2 pr-3 font-medium">
                        {t("partnerProgram.originalCommission")}
                      </th>
                      <th className="pb-2 pr-3 font-medium">
                        {t("partnerProgram.adjustment")}
                      </th>
                      <th className="pb-2 pr-3 font-medium">
                        {t("partnerProgram.netCommission")}
                      </th>
                      <th className="pb-2 pr-3 font-medium">
                        {t("partnerProgram.status")}
                      </th>
                      <th className="pb-2 font-medium">
                        {t("partnerProgram.holdUntil")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.commissionHistory.map((entry) => (
                      <tr
                        key={`${entry.orderNumber}-${entry.transactionDate.toISOString()}`}
                        className="border-b theme-border"
                      >
                        <td className="py-3 pr-3">
                          {date(entry.transactionDate, locale)}
                        </td>
                        <td className="py-3 pr-3 font-mono text-xs">
                          {entry.orderNumber}
                        </td>
                        <td className="py-3 pr-3">
                          {money(entry.grossTransactionAmount, entry.currency)}
                        </td>
                        <td className="py-3 pr-3">
                          {money(
                            entry.originalCommissionAmount,
                            entry.currency,
                          )}
                        </td>
                        <td className="py-3 pr-3">
                          -{money(entry.adjustmentAmount, entry.currency)}
                        </td>
                        <td className="py-3 pr-3">
                          {money(entry.netCommissionAmount, entry.currency)}
                        </td>
                        <td className="py-3 pr-3">{statusKey(entry.status)}</td>
                        <td className="py-3">
                          {date(entry.holdUntil, locale)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-4 text-sm theme-muted">
                {t("partnerProgram.emptyCommissions")}
              </p>
            )}
            <Pagination
              locale={locale}
              current={data.commissionPagination.page}
              pages={data.commissionPagination.totalPages}
              queryKey="commissionPage"
            />
          </div>

          <aside className="border p-5 theme-border theme-surface-elevated">
            <h2 className="text-base font-semibold theme-foreground">
              {t("partnerProgram.connectedAccount")}
            </h2>
            <p className="mt-3 text-sm theme-muted">
              {t(
                `partnerProgram.payout${payoutStatus[0].toUpperCase()}${payoutStatus.slice(1)}`,
              )}
            </p>
            <Link
              href={withLocale("/settings/stripe-connect", locale)}
              className="mt-4 inline-flex text-sm font-semibold text-[#25825f] hover:underline"
            >
              {t("partnerProgram.managePayout")}
            </Link>
            <dl className="mt-7 grid gap-3 border-t pt-5 theme-border">
              <div>
                <dt className="text-xs theme-muted">
                  {t("partnerProgram.referred")}
                </dt>
                <dd className="mt-1 text-lg font-semibold theme-foreground">
                  {data.counts.referredMembers}
                </dd>
              </div>
              <div>
                <dt className="text-xs theme-muted">
                  {t("partnerProgram.qualifying")}
                </dt>
                <dd className="mt-1 text-lg font-semibold theme-foreground">
                  {data.counts.qualifyingTransactions}
                </dd>
              </div>
            </dl>
          </aside>
        </section>

        <section className="border p-5 theme-border theme-surface-elevated">
          <h2 className="text-base font-semibold theme-foreground">
            {t("partnerProgram.referred")}
          </h2>
          {data.referredMembers.length ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="border-b theme-border theme-muted">
                  <tr>
                    <th className="pb-2 pr-3 font-medium">
                      {t("partnerProgram.member")}
                    </th>
                    <th className="pb-2 pr-3 font-medium">
                      {t("partnerProgram.role")}
                    </th>
                    <th className="pb-2 pr-3 font-medium">
                      {t("partnerProgram.referredAt")}
                    </th>
                    <th className="pb-2 font-medium">
                      {t("partnerProgram.qualifyingStatus")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.referredMembers.map((member) => (
                    <tr
                      key={`${member.name}-${member.lockedAt.toISOString()}`}
                      className="border-b theme-border"
                    >
                      <td className="py-3 pr-3">{member.name}</td>
                      <td className="py-3 pr-3">{roleLabel(member.role)}</td>
                      <td className="py-3 pr-3">
                        {date(member.lockedAt, locale)}
                      </td>
                      <td className="py-3">
                        {member.hasQualifyingSettlement
                          ? t("partnerProgram.yes")
                          : t("partnerProgram.no")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-4 text-sm theme-muted">
              {t("partnerProgram.emptyMembers")}
            </p>
          )}
          <Pagination
            locale={locale}
            current={data.memberPagination.page}
            pages={data.memberPagination.totalPages}
            queryKey="memberPage"
          />
        </section>
      </div>
    </main>
  );
}

function Pagination({
  locale,
  current,
  pages,
  queryKey,
}: {
  locale: Locale;
  current: number;
  pages: number;
  queryKey: string;
}) {
  if (pages <= 1) return null;
  const t = createTranslator(getDictionary(locale));
  const previous = Math.max(1, current - 1);
  const next = Math.min(pages, current + 1);
  return (
    <nav
      className="mt-4 flex items-center gap-3 text-sm"
      aria-label={t("partnerProgram.page")}
    >
      <Link
        className="theme-muted hover:text-[var(--foreground)]"
        href={withLocale(`/partner/dashboard?${queryKey}=${previous}`, locale)}
        aria-disabled={current === 1}
      >
        {t("partnerProgram.previous")}
      </Link>
      <span className="theme-muted">
        {current} / {pages}
      </span>
      <Link
        className="theme-muted hover:text-[var(--foreground)]"
        href={withLocale(`/partner/dashboard?${queryKey}=${next}`, locale)}
        aria-disabled={current === pages}
      >
        {t("partnerProgram.next")}
      </Link>
    </nav>
  );
}
