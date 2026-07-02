"use client";

import Link from "next/link";

import { useI18n } from "@/components/i18n-provider";
import { RoleBadge } from "@/components/role-badge";
import { useUserContext } from "@/hooks/use-user-context";
import { withLocale } from "@/lib/i18n";
import type { AccountRole } from "@/lib/types";

export function DashboardOverview({ role }: { role: AccountRole }) {
  const { locale, t } = useI18n();
  const { context } = useUserContext();

  const effectiveRole = context?.role ?? role;
  const companies = context?.companies ?? [];
  const dashboardRoles: Array<"seller" | "buyer"> =
    effectiveRole === "both"
      ? ["seller", "buyer"]
      : effectiveRole === "seller" || effectiveRole === "buyer"
        ? [effectiveRole]
        : [];

  return (
    <div className="grid gap-6">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-5 theme-surface">
        <div>
          <p className="text-sm theme-muted">{t("dashboard.accountRole")}</p>
          <div className="mt-2">
            <RoleBadge role={effectiveRole} />
          </div>
        </div>
        {context?.isAdmin ? (
          <Link
            href="/admin/verifications"
            className="inline-flex min-h-11 items-center rounded-md px-4 py-2 text-sm font-medium theme-primary-button"
          >
            {t("dashboard.openAdmin")}
          </Link>
        ) : null}
      </section>

      {effectiveRole === "user" ? (
        <section className="grid gap-5 md:grid-cols-2">
          <OnboardingCard
            href="/onboarding/seller"
            title={t("onboarding.roleSellerTitle")}
            description={t("onboarding.roleSellerDescription")}
            locale={locale}
          />
          <OnboardingCard
            href="/onboarding/buyer"
            title={t("onboarding.roleBuyerTitle")}
            description={t("onboarding.roleBuyerDescription")}
            locale={locale}
          />
        </section>
      ) : null}

      {dashboardRoles.map((item) => {
        const company = companies.find(
          (candidate) => candidate.companyRole === item,
        );
        return (
          <section
            key={item}
            className="grid gap-4 rounded-lg border p-6 theme-surface md:grid-cols-[1fr_auto]"
          >
            <div>
              <h2 className="text-xl font-semibold theme-foreground">
                {item === "seller"
                  ? t("settings.sellerDashboard")
                  : t("settings.buyerDashboard")}
              </h2>
              <p className="mt-2 text-sm leading-6 theme-muted">
                {company
                  ? company.tradeName || company.legalName
                  : t("settings.companyProfileMissingText")}
              </p>
            </div>
            <Link
              href={withLocale(`/dashboard/${item}`, locale)}
              className="inline-flex min-h-11 items-center justify-center rounded-md px-4 py-2 text-sm font-medium theme-primary-button"
            >
              {t("settings.openDashboard")}
            </Link>
          </section>
        );
      })}

    </div>
  );
}

function OnboardingCard({
  href,
  title,
  description,
  locale,
}: {
  href: string;
  title: string;
  description: string;
  locale: "en" | "ko";
}) {
  const { t } = useI18n();
  return (
    <article className="grid gap-4 rounded-lg border p-6 theme-surface">
      <div>
        <h2 className="text-xl font-semibold theme-foreground">{title}</h2>
        <p className="mt-2 text-sm leading-6 theme-muted">{description}</p>
      </div>
      <Link
        href={withLocale(href, locale)}
        className="inline-flex min-h-11 w-fit items-center rounded-md px-4 py-2 text-sm font-medium theme-primary-button"
      >
        {t("dashboard.startOnboarding")}
      </Link>
    </article>
  );
}
