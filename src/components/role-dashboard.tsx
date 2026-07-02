"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { AdminBadge } from "@/components/admin-badge";
import {
  DashboardClient,
  type DashboardSection,
} from "@/components/dashboard-client";
import { useI18n } from "@/components/i18n-provider";
import { CompanyLogo } from "@/components/profile-identity";
import { VerificationBadge } from "@/components/verification-badge";
import { loadAccountCompanies } from "@/hooks/use-account-companies";
import { useUserContext } from "@/hooks/use-user-context";
import { withLocale } from "@/lib/i18n";
import type { VerificationStatus } from "@/lib/types";

type DashboardCompany = {
  id: string;
  companyRole: "seller" | "buyer";
  legalName: string;
  tradeName: string | null;
  logoThumbnailUrl: string | null;
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
  const { context, isLoaded, user } = useUserContext();
  const { locale, t } = useI18n();
  const searchParams = useSearchParams();
  const userId = user?.id ?? "";
  const [company, setCompany] = useState<DashboardCompany | null | undefined>(
    undefined,
  );
  const [activeSection, setActiveSection] =
    useState<DashboardSection>(() =>
      parseDashboardSection(searchParams.get("section"), role) ?? "overview",
    );

  useEffect(() => {
    if (!isLoaded || !userId) return;

    let active = true;
    void loadAccountCompanies(userId)
      .then((companies) => {
        if (!active) return;
        setCompany(
          (companies as DashboardCompany[]).find((item) => item.companyRole === role) ??
            null,
        );
      });
    return () => {
      active = false;
    };
  }, [isLoaded, role, userId]);

  if (company === undefined) {
    return <p className="text-sm text-zinc-600">{t("common.loading")}</p>;
  }

  if (!company) {
    return (
      <section className="rounded-md border border-amber-200 bg-amber-50 p-4">
        <h2 className="font-semibold text-amber-950">
          {t("settings.companyProfileMissing")}
        </h2>
        <p className="mt-2 text-sm text-amber-800">
          {t("settings.companyProfileMissingText")}
        </p>
        <Link
          href={withLocale(`/onboarding/${role}`, locale)}
          className="mt-4 inline-flex h-8 items-center rounded-md bg-zinc-950 px-2.5 text-xs font-medium text-white"
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
  const navItems: Array<{ id: DashboardSection; label: string }> = [
    { id: "overview", label: t("dashboard.dashboardNavOverview") },
    ...(role === "buyer"
      ? [
          {
            id: "saved-products" as const,
            label: t("dashboard.dashboardNavSavedProducts"),
          },
        ]
      : []),
    {
      id: "following",
      label:
        role === "seller"
          ? t("dashboard.dashboardNavFollowers")
          : t("dashboard.dashboardNavFollowing"),
    },
    { id: "messages", label: t("dashboard.dashboardNavMessages") },
    ...(role === "seller"
      ? [{ id: "products" as const, label: t("dashboard.dashboardNavProducts") }]
      : []),
  ];
  const safeActiveSection = navItems.some((item) => item.id === activeSection)
    ? activeSection
    : "overview";
  const isBuyerDashboard = role === "buyer";

  return (
    <div className="grid gap-4 lg:grid-cols-[208px_1fr]">
      <aside
        className={
          isBuyerDashboard
            ? "h-fit min-w-0 rounded-2xl border border-white/10 bg-white/[0.04] p-2 shadow-2xl shadow-black/10"
            : "bm-premium-card h-fit min-w-0 rounded-md border border-zinc-200 bg-white p-2 shadow-sm shadow-zinc-100"
        }
      >
        <nav
          className="-mx-1 flex gap-2 overflow-x-auto px-1 lg:mx-0 lg:grid lg:gap-1 lg:overflow-visible lg:px-0"
          aria-label={t("dashboard.label")}
        >
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveSection(item.id)}
              className={`relative z-10 h-8 min-w-max rounded-md px-2.5 text-left text-xs font-medium transition ${
                safeActiveSection === item.id
                  ? isBuyerDashboard
                    ? "bg-emerald-300/15 text-emerald-100 shadow-sm shadow-emerald-950/10"
                    : "bg-emerald-50 text-emerald-800 shadow-sm shadow-emerald-950/5"
                  : isBuyerDashboard
                    ? "text-zinc-400 hover:-translate-y-0.5 hover:bg-white/[0.06] hover:text-white"
                    : "text-zinc-600 hover:-translate-y-0.5 hover:bg-zinc-50 hover:text-zinc-950"
              }`}
              aria-current={safeActiveSection === item.id ? "page" : undefined}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <div className="grid gap-4">
        <section
          className={
            isBuyerDashboard
              ? "rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/10"
              : "bm-premium-card rounded-md border border-zinc-200 bg-white p-4 shadow-sm shadow-zinc-100"
          }
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <CompanyLogo
                companyName={company.tradeName || company.legalName}
                logoUrl={company.logoThumbnailUrl ?? company.logoUrl ?? undefined}
                useDefaultLogo={company.useDefaultLogo}
                size="lg"
              />
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <h1
                    className={`truncate text-xl font-semibold ${
                      isBuyerDashboard ? "text-white" : "text-zinc-950"
                    }`}
                  >
                    {company.tradeName || company.legalName}
                  </h1>
                  {context?.isAdmin ? <AdminBadge /> : null}
                </div>
                <p className={`mt-1 text-sm ${isBuyerDashboard ? "text-zinc-400" : "text-zinc-500"}`}>
                  {role === "seller"
                    ? t("onboarding.roleSellerTitle")
                    : t("onboarding.roleBuyerTitle")}
                </p>
                <div className="mt-2">
                  <VerificationBadge status={status} subject={role} />
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Action
                href="/settings/company"
                label={t("dashboard.editProfile")}
                locale={locale}
                primary
                dark={isBuyerDashboard}
              />
            </div>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-[1fr_auto]">
          <div
            className={
              isBuyerDashboard
                ? "rounded-2xl border border-white/10 bg-white/[0.035] p-4"
                : "bm-premium-card rounded-md border border-zinc-200 bg-white p-4 shadow-sm shadow-zinc-100"
            }
          >
            <p className={`text-sm ${isBuyerDashboard ? "text-zinc-400" : "text-zinc-500"}`}>
              {t("settings.verificationStatus")}
            </p>
            <div className="mt-2">
              <VerificationBadge status={status} subject={role} />
            </div>
            <p className={`mt-2 text-sm ${isBuyerDashboard ? "text-zinc-400" : "text-zinc-600"}`}>
              {status === "verified"
                ? t("settings.verifiedCompanyText")
                : status === "rejected"
                  ? rejectionReason || t("settings.rejectedCompanyText")
                  : t("settings.pendingCompanyText")}
            </p>
            <p className={`mt-2 text-sm font-medium ${isBuyerDashboard ? "text-zinc-200" : "text-zinc-800"}`}>
              {status === "verified"
                ? t("dashboard.publicListingLive")
                : t("dashboard.publicListingHidden")}
            </p>
          </div>
          <div
            className={
              isBuyerDashboard
                ? "rounded-2xl border border-white/10 bg-white/[0.035] p-4 md:min-w-40"
                : "bm-premium-card rounded-md border border-zinc-200 bg-white p-4 shadow-sm shadow-zinc-100 md:min-w-40"
            }
          >
            <p className={`text-sm ${isBuyerDashboard ? "text-zinc-400" : "text-zinc-500"}`}>
              {t("settings.profileCompleteness")}
            </p>
            <p className={`mt-1 text-2xl font-semibold ${isBuyerDashboard ? "text-white" : "text-zinc-950"}`}>
              {completeness}%
            </p>
          </div>
        </section>

        {status === "rejected" || status === "needs_reverification" ? (
          <div className="w-fit rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {t("settings.resubmitVerification")}
          </div>
        ) : null}

        <DashboardClient
          role={role}
          activeSection={safeActiveSection}
          onSectionChange={setActiveSection}
        />
      </div>
    </div>
  );
}

function parseDashboardSection(
  value: string | null,
  role: "seller" | "buyer",
): DashboardSection | null {
  if (value === "overview" || value === "following" || value === "messages") {
    return value;
  }
  if (role === "seller" && value === "products") return value;
  if (role === "buyer" && value === "saved-products") return value;
  return null;
}

function Action({
  href,
  label,
  locale,
  primary = false,
  dark = false,
}: {
  href: string;
  label: string;
  locale: "en" | "ko";
  primary?: boolean;
  dark?: boolean;
}) {
  return (
    <Link
      href={withLocale(href, locale)}
      className={
        primary
          ? dark
            ? "inline-flex h-8 items-center justify-center rounded-md bg-emerald-300 px-2.5 text-xs font-semibold text-zinc-950 hover:bg-emerald-200"
            : "inline-flex h-8 items-center justify-center rounded-md bg-zinc-950 px-2.5 text-xs font-medium text-white hover:bg-blue-700"
          : dark
            ? "inline-flex h-8 items-center justify-center rounded-md border border-white/10 px-2.5 text-xs font-medium text-zinc-300 hover:border-emerald-300/40 hover:text-white"
            : "inline-flex h-8 items-center justify-center rounded-md border border-zinc-200 px-2.5 text-xs font-medium text-zinc-700 hover:border-blue-200 hover:text-blue-700"
      }
    >
      {label}
    </Link>
  );
}
