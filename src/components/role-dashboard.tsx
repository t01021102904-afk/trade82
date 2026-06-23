"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { DashboardClient } from "@/components/dashboard-client";
import { AccountPageButton } from "@/components/account-page-button";
import { useI18n } from "@/components/i18n-provider";
import { CompanyLogo } from "@/components/profile-identity";
import { VerificationBadge } from "@/components/verification-badge";
import { withLocale } from "@/lib/i18n";
import type { VerificationStatus } from "@/lib/types";

type DashboardCompany = {
  id: string;
  companyRole: "seller" | "buyer";
  legalName: string;
  tradeName: string | null;
  logoUrl: string | null;
  useDefaultLogo: boolean;
  website: string;
  country: string;
  businessAddress: string;
  description: string;
  categories: string[];
  verificationStatus: VerificationStatus;
  sellerProfile: Record<string, unknown> | null;
  buyerProfile: Record<string, unknown> | null;
  verificationRequests: Array<{ adminNote: string | null }>;
};

export function RoleDashboard({ role }: { role: "seller" | "buyer" }) {
  const { locale, t } = useI18n();
  const [company, setCompany] = useState<DashboardCompany | null | undefined>(
    undefined,
  );

  useEffect(() => {
    void fetch("/api/account/company")
      .then((response) => (response.ok ? response.json() : []))
      .then((companies: DashboardCompany[]) => {
        setCompany(
          companies.find((item) => item.companyRole === role) ?? null,
        );
      });
  }, [role]);

  if (company === undefined) {
    return <p className="text-sm text-zinc-600">{t("common.loading")}</p>;
  }

  if (!company) {
    return (
      <section className="rounded-lg border border-amber-200 bg-amber-50 p-6">
        <h2 className="font-semibold text-amber-950">
          {t("settings.companyProfileMissing")}
        </h2>
        <p className="mt-2 text-sm text-amber-800">
          {t("settings.companyProfileMissingText")}
        </p>
        <Link
          href={withLocale(`/onboarding/${role}`, locale)}
          className="mt-4 inline-flex min-h-11 items-center rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white"
        >
          {t("dashboard.startOnboarding")}
        </Link>
      </section>
    );
  }

  const roleProfile =
    role === "seller" ? company.sellerProfile : company.buyerProfile;
  const values = [
    company.legalName,
    company.website,
    company.country,
    company.businessAddress,
    company.description,
    company.categories.length ? "categories" : "",
    roleProfile ? "role-profile" : "",
  ];
  const completeness = Math.round(
    (values.filter(Boolean).length / values.length) * 100,
  );
  const status = company.verificationStatus;
  const rejectionReason = company.verificationRequests[0]?.adminNote;

  return (
    <div className="grid gap-8">
      <section className="flex flex-col gap-5 rounded-lg border border-zinc-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <CompanyLogo
            companyName={company.tradeName || company.legalName}
            logoUrl={company.logoUrl ?? undefined}
            useDefaultLogo={company.useDefaultLogo}
            size="lg"
          />
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold text-zinc-950">
              {company.tradeName || company.legalName}
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              {role === "seller"
                ? t("onboarding.roleSellerTitle")
                : t("onboarding.roleBuyerTitle")}
            </p>
            <div className="mt-2">
              <VerificationBadge status={status} subject={role} />
            </div>
          </div>
        </div>
        <AccountPageButton page="company">
          {t("settings.editCompanyProfile")}
        </AccountPageButton>
      </section>

      <section className="grid gap-4 rounded-lg border border-zinc-200 bg-white p-5 md:grid-cols-[1fr_auto]">
        <div>
          <p className="text-sm text-zinc-500">
            {t("settings.verificationStatus")}
          </p>
          <div className="mt-2">
            <VerificationBadge status={status} subject={role} />
          </div>
          <p className="mt-3 text-sm text-zinc-600">
            {status === "verified"
              ? t("settings.verifiedCompanyText")
              : status === "rejected"
                ? rejectionReason || t("settings.rejectedCompanyText")
                : t("settings.pendingCompanyText")}
          </p>
          <p className="mt-2 text-sm font-medium text-zinc-800">
            {status === "verified"
              ? t("dashboard.publicListingLive")
              : t("dashboard.publicListingHidden")}
          </p>
        </div>
        <div className="min-w-40">
          <p className="text-sm text-zinc-500">
            {t("settings.profileCompleteness")}
          </p>
          <p className="mt-1 text-3xl font-semibold text-zinc-950">
            {completeness}%
          </p>
        </div>
      </section>

      <section className="grid gap-3 rounded-lg border border-zinc-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-4">
        <AccountPageButton page="company">
          {t("settings.myCompany")}
        </AccountPageButton>
        <AccountPageButton page="professional">
          {t("settings.professionalInfo")}
        </AccountPageButton>
        <Action
          href="/messages"
          label={t("dashboard.viewMessages")}
          locale={locale}
        />
        {role === "seller" ? (
          <AccountPageButton page="products">
            {t("settings.myProducts")}
          </AccountPageButton>
        ) : (
          <Action
            href="/sellers"
            label={t("dashboard.browseSellers")}
            locale={locale}
          />
        )}
      </section>

      {status === "rejected" || status === "needs_reverification" ? (
        <AccountPageButton page="company" className="w-fit border-red-200 bg-red-50 text-red-700">
          {t("settings.resubmitVerification")}
        </AccountPageButton>
      ) : null}

      <DashboardClient role={role} />
    </div>
  );
}

function Action({
  href,
  label,
  locale,
}: {
  href: string;
  label: string;
  locale: "en" | "ko";
}) {
  return (
    <Link
      href={withLocale(href, locale)}
      className="rounded-md border border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-700 hover:border-blue-200 hover:text-blue-700"
    >
      {label}
    </Link>
  );
}
