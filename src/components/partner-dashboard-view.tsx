import Link from "next/link";

import { AdminPartnerActions } from "@/components/admin-partner-actions";
import { PartnerReferralAnalyticsSection } from "@/components/partner-referral-analytics";
import { PartnerReferralLink } from "@/components/partner-referral-link";
import { PartnerDashboardStatusPanel } from "@/components/partner-dashboard-status-panel";
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
  joined = false,
  viewMode = "partner",
  paginationBasePath = "/partner/dashboard",
  paginationQuery = {},
}: {
  locale: Locale;
  data: DashboardData;
  referralUrl: string;
  joined?: boolean;
  viewMode?: "partner" | "admin-readonly";
  paginationBasePath?: string;
  paginationQuery?: Record<string, string>;
}) {
  const adminReadonly = viewMode === "admin-readonly";
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
  const payoutStatus = partnerPayoutSetupStatus(data.partner.payoutProfile);
  const profileStatusKey: Record<typeof profileStatus, string> = {
    pendingReview: "partnerStatusPendingReview",
    active: "partnerStatusActive",
    suspended: "partnerStatusSuspended",
    rejected: "partnerStatusRejected",
  };
  const isActive = profileStatus === "active";
  const isPendingReview = profileStatus === "pendingReview";
  const showOperationalSections =
    adminReadonly || isActive || profileStatus === "suspended";
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
    <main className="bm-grid-surface min-h-[calc(100vh-4rem)] min-w-0 w-full max-w-full overflow-x-hidden theme-bg">
      <div className="mx-auto grid min-w-0 w-full max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:px-8">
        {adminReadonly ? (
          <div className="border px-4 py-3 text-sm theme-border theme-surface-muted">
            <p className="font-semibold theme-foreground">
              {t("admin.partnerReadOnlyBanner")}
            </p>
            <p className="mt-1 theme-muted">
              {t("admin.partnerReadOnlyDescription")}
            </p>
            <Link
              href={withLocale("/admin/partners", locale)}
              className="mt-2 inline-block font-medium underline theme-foreground"
            >
              {t("admin.backToPartnerManagement")}
            </Link>
          </div>
        ) : null}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight theme-foreground">
              {adminReadonly
                ? t("admin.partnerDetailTitle")
                : t("partnerProgram.dashboardTitle")}
            </h1>
            <p className="mt-2 text-sm theme-muted">
              {adminReadonly
                ? t("admin.partnerDetailDescription")
                : t("partnerProgram.disclosure")}
            </p>
          </div>
          <div className="rounded-full border px-3 py-1 text-xs font-semibold theme-border theme-surface-muted">
            {t(
              `partnerProgram.${profileStatusKey[profileStatus]}`,
            )}
          </div>
        </div>

        {joined ? (
          <p role="status" className="text-sm text-emerald-700">
            {t("partnerProgram.joinSuccess")}
          </p>
        ) : null}

        {adminReadonly ? (
          <section
            className="border p-5 theme-border theme-surface-elevated"
            aria-labelledby="admin-partner-identity"
          >
            <h2
              id="admin-partner-identity"
              className="text-base font-semibold theme-foreground"
            >
              {t("admin.partnerIdentityTitle")}
            </h2>
            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <IdentityField label={t("admin.partnerDisplayName")} value={data.partner.displayName ?? "-"} />
              <IdentityField label={t("admin.partnerLegalName")} value={data.partner.legalName ?? "-"} />
              <IdentityField label={t("admin.partnerOrganization")} value={data.partner.organizationName ?? "-"} />
              <IdentityField label={t("admin.partnerContactEmail")} value={data.partner.contactEmail ?? "-"} />
              <IdentityField label={t("admin.partnerContactPhone")} value={data.partner.contactPhone ?? "-"} />
              <IdentityField label={t("admin.partnerCountry")} value={data.partner.country ?? "-"} />
              <IdentityField label={t("admin.partnerLanguage")} value={data.partner.preferredLanguage ?? "-"} />
              <IdentityField label={t("admin.partnerWebsiteOrSocial")} value={data.partner.websiteOrSocialUrl ?? "-"} />
              <IdentityField label={t("admin.partnerPromotionDescription")} value={data.partner.promotionDescription ?? "-"} />
              <IdentityField
                label={t("admin.partnerStatus")}
                value={t(`admin.${profileStatusKey[profileStatus]}`)}
              />
              <IdentityField label={t("admin.partnerJoined")} value={date(data.partner.createdAt, locale)} />
              <IdentityField
                label={t("admin.partnerPayoutSetup")}
                value={t(`admin.${payoutStatus === "enabled" ? "partnerPayoutEnabled" : payoutStatus === "pending" ? "partnerPayoutPending" : payoutStatus === "notStarted" ? "partnerPayoutNotStarted" : payoutStatus === "disabled" ? "partnerPayoutDisabled" : "partnerPayoutRestricted"}`)}
              />
            </dl>
            <AdminPartnerActions
              locale={locale}
              partnerProfileId={data.partner.id}
              partnerStatus={data.partner.status}
              payoutProfileId={data.partner.payoutProfile?.id ?? null}
              payoutStatus={data.partner.payoutProfile?.status ?? null}
            />
          </section>
        ) : null}

        {isActive && !adminReadonly ? <section
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
        </section> : null}

        {!isActive ? (
          <PartnerDashboardStatusPanel
            status={profileStatus}
            statusTitle={t(`partnerProgram.${profileStatusKey[profileStatus]}Title`)}
            statusDescription={t(
              `partnerProgram.${profileStatusKey[profileStatus]}Description`,
            )}
            payout={
              !adminReadonly && isPendingReview && data.partner.payoutProfile
                ? {
                    title: t("partnerProgram.payoutSetupTitle"),
                    bankNameLabel: t("partnerProgram.bankName"),
                    bankName: data.partner.payoutProfile.bankName,
                    accountNumberLabel: t("partnerProgram.accountNumber"),
                    accountNumberMasked: data.partner.payoutProfile.accountNumberMasked,
                    statusLabel: t("partnerProgram.status"),
                    status: t(
                      `partnerProgram.payout${payoutStatus[0].toUpperCase()}${payoutStatus.slice(1)}`,
                    ),
                  }
                : undefined
            }
          />
        ) : null}

        {showOperationalSections ? <>
          <PartnerReferralAnalyticsSection
            locale={locale}
            analytics={data.analytics}
            qualifyingTransactions={data.counts.qualifyingTransactions}
            netCommissionAmount={data.totals.net}
            currency={data.totals.currency}
            basePath={paginationBasePath}
            query={paginationQuery}
          />

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
              basePath={paginationBasePath}
              query={paginationQuery}
            />
          </div>

          <aside className="border p-5 theme-border theme-surface-elevated">
            <h2 className="text-base font-semibold theme-foreground">{t("partnerProgram.payoutSetupTitle")}</h2>
            <p className="mt-3 text-sm theme-muted">
              {payoutStatus === "notStarted"
                ? t("partnerProgram.payoutSetupNotCompleted")
                : t(`partnerProgram.payout${payoutStatus[0].toUpperCase()}${payoutStatus.slice(1)}`)}
            </p>
            {adminReadonly ? (
              <p className="mt-2 text-xs theme-muted">
                {t("admin.partnerPayoutReadOnly")}
              </p>
            ) : null}
            <p className="mt-2 text-sm leading-6 theme-muted">{t("partnerProgram.payoutSetupDescription")}</p>
            {data.partner.payoutProfile ? (
              <dl className="mt-4 grid gap-2 border-t pt-4 text-sm theme-border">
                <div>
                  <dt className="text-xs theme-muted">{t("partnerProgram.bankName")}</dt>
                  <dd className="mt-1 theme-foreground">
                    {data.partner.payoutProfile.bankName}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs theme-muted">{t("partnerProgram.accountNumber")}</dt>
                  <dd className="mt-1 font-mono theme-foreground">{data.partner.payoutProfile.accountNumberMasked}</dd>
                </div>
              </dl>
            ) : null}
            {!adminReadonly && isActive ? (
              <Link
                href={`${withLocale("/onboarding/partner", locale)}?edit=1`}
                className="mt-4 inline-block text-sm font-medium underline theme-foreground"
              >
                {t("partnerProgram.managePayout")}
              </Link>
            ) : null}
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
            basePath={paginationBasePath}
            query={paginationQuery}
          />
        </section>
        </> : null}
      </div>
    </main>
  );
}

function IdentityField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs theme-muted">{label}</dt>
      <dd className="mt-1 break-words theme-foreground">{value}</dd>
    </div>
  );
}

function Pagination({
  locale,
  current,
  pages,
  queryKey,
  basePath,
  query,
}: {
  locale: Locale;
  current: number;
  pages: number;
  queryKey: string;
  basePath: string;
  query: Record<string, string>;
}) {
  if (pages <= 1) return null;
  const t = createTranslator(getDictionary(locale));
  const previous = Math.max(1, current - 1);
  const next = Math.min(pages, current + 1);
  const hrefFor = (page: number) => {
    const params = new URLSearchParams(query);
    params.set(queryKey, String(page));
    return withLocale(`${basePath}?${params.toString()}`, locale);
  };
  return (
    <nav
      className="mt-4 flex items-center gap-3 text-sm"
      aria-label={t("partnerProgram.page")}
    >
      <Link
        className="theme-muted hover:text-[var(--foreground)]"
        href={hrefFor(previous)}
        aria-disabled={current === 1}
      >
        {t("partnerProgram.previous")}
      </Link>
      <span className="theme-muted">
        {current} / {pages}
      </span>
      <Link
        className="theme-muted hover:text-[var(--foreground)]"
        href={hrefFor(next)}
        aria-disabled={current === pages}
      >
        {t("partnerProgram.next")}
      </Link>
    </nav>
  );
}
