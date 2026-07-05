"use client";

import {
  FileText,
  LayoutDashboard,
  LifeBuoy,
  MessageCircle,
  Package,
  Settings as SettingsIcon,
  ShoppingBag,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { AdminBadge } from "@/components/admin-badge";
import {
  DashboardClient,
  type DashboardSection,
} from "@/components/dashboard-client";
import { useI18n } from "@/components/i18n-provider";
import { CompanyLogo } from "@/components/profile-identity";
import { VerificationBadge } from "@/components/verification-badge";
import { VerifiedSellerBadge } from "@/components/verified-seller-badge";
import { loadAccountCompanies } from "@/hooks/use-account-companies";
import { useUserContext } from "@/hooks/use-user-context";
import { isVerifiedSellerSubscription } from "@/lib/billing";
import { stripLocale, withLocale } from "@/lib/i18n";
import { isActiveSellerSupportSubscription } from "@/lib/seller-support";
import type { VerificationStatus } from "@/lib/types";
import { cx } from "@/lib/utils";

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
  subscriptionStatus?: string | null;
  subscriptionPlan?: string | null;
  sellerSupportPlan?: string | null;
  sellerSupportStatus?: string | null;
};

export function RoleDashboard({ role }: { role: "seller" | "buyer" }) {
  const { context, isLoaded, user } = useUserContext();
  const { locale, t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const userId = user?.id ?? "";
  const [company, setCompany] = useState<DashboardCompany | null | undefined>(
    undefined,
  );
  const [activeSection, setActiveSection] =
    useState<DashboardSection>(() =>
      parseDashboardSection(searchParams.get("section"), role) ?? "overview",
    );
  const [supportOpening, setSupportOpening] = useState(false);
  const [supportError, setSupportError] = useState("");

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
  const verifiedSeller = role === "seller" && isVerifiedSellerSubscription(
    company.subscriptionStatus,
    company.subscriptionPlan,
  );
  const supportActive =
    role === "seller" &&
    isActiveSellerSupportSubscription(
      company.sellerSupportStatus,
      company.sellerSupportPlan,
    );
  const openSupportTeam = async () => {
    setSupportError("");
    if (!supportActive) {
      router.push(withLocale("/pricing", locale));
      return;
    }

    setSupportOpening(true);
    try {
      const response = await fetch("/api/support/conversation", {
        method: "POST",
      });
      const body = (await response.json().catch(() => null)) as
        | { messageRoute?: string; error?: string; pricingPath?: string }
        | null;
      if (!response.ok) {
        if (response.status === 402 && body?.pricingPath) {
          router.push(withLocale(body.pricingPath, locale));
          return;
        }
        throw new Error(body?.error || "Support Team could not be opened.");
      }
      router.push(withLocale(body?.messageRoute || "/messages", locale));
    } catch (error) {
      setSupportError(
        error instanceof Error ? error.message : "Support Team could not be opened.",
      );
      setActiveSection("support-team");
    } finally {
      setSupportOpening(false);
    }
  };
  const navItems: Array<{
    id: DashboardSection;
    label: string;
    icon: LucideIcon;
    badge?: string;
    onClick?: () => void;
    loading?: boolean;
  }> = [
    {
      id: "overview",
      label: t("dashboard.dashboardNavOverview"),
      icon: LayoutDashboard,
    },
    ...(role === "buyer"
      ? [
          {
            id: "saved-products" as const,
            label: t("dashboard.dashboardNavSavedProducts"),
            icon: ShoppingBag,
          },
        ]
      : []),
    ...(role === "buyer"
      ? [
          {
            id: "following" as const,
            label: t("dashboard.dashboardNavFollowing"),
            icon: Users,
          },
          {
            id: "messages" as const,
            label: t("dashboard.dashboardNavMessages"),
            icon: MessageCircle,
          },
        ]
      : []),
    ...(role === "seller"
      ? [
          {
            id: "products" as const,
            label: t("dashboard.dashboardNavProducts"),
            icon: Package,
          },
          {
            id: "documents" as const,
            label: t("dashboard.dashboardNavDocuments"),
            icon: FileText,
          },
          {
            id: "support-team" as const,
            label: t("dashboard.dashboardNavSupportTeam"),
            icon: LifeBuoy,
            badge: t("dashboard.proBadge"),
            onClick: openSupportTeam,
            loading: supportOpening,
          },
        ]
      : []),
  ];
  const safeActiveSection = navItems.some((item) => item.id === activeSection)
    ? activeSection
    : "overview";
  const settingsSelected = stripLocale(pathname) === "/dashboard/settings";
  return (
    <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
      <aside className="h-fit min-w-0 rounded-2xl border p-2 theme-surface-elevated">
        <nav
          className="-mx-1 flex gap-2 overflow-x-auto px-1 lg:mx-0 lg:grid lg:gap-1 lg:overflow-visible lg:px-0"
          aria-label={t("dashboard.label")}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const selected = safeActiveSection === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.onClick) {
                    item.onClick();
                    return;
                  }
                  setActiveSection(item.id);
                }}
                className={dashboardNavItemClass(selected)}
                aria-current={selected ? "page" : undefined}
                disabled={item.loading}
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{item.label}</span>
                {item.badge ? (
                  <span className="ml-auto rounded-full border px-1.5 py-0.5 text-[10px] font-semibold leading-none theme-success-badge">
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
          {role === "seller" ? (
            <Link
              href={withLocale("/dashboard/settings", locale)}
              className={dashboardNavItemClass(settingsSelected)}
              aria-current={settingsSelected ? "page" : undefined}
            >
              <SettingsIcon className="size-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{t("dashboard.dashboardNavSettings")}</span>
            </Link>
          ) : null}
        </nav>
      </aside>

      <div className="grid gap-4">
        <section className="rounded-2xl border p-4 theme-surface-elevated">
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
                    className="truncate text-lg font-semibold theme-foreground"
                  >
                    {company.tradeName || company.legalName}
                  </h1>
                  {context?.isAdmin ? <AdminBadge /> : null}
                  {verifiedSeller ? <VerifiedSellerBadge /> : null}
                </div>
                <p className="mt-1 text-sm theme-muted">
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
              />
            </div>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-[1fr_auto]">
          <div className="rounded-2xl border p-4 theme-surface">
            <p className="text-sm theme-muted">
              {t("settings.verificationStatus")}
            </p>
            <div className="mt-2">
              <VerificationBadge status={status} subject={role} />
            </div>
            <p className="mt-2 text-sm theme-muted">
              {status === "verified"
                ? t("settings.verifiedCompanyText")
                : status === "rejected"
                  ? rejectionReason || t("settings.rejectedCompanyText")
                  : t("settings.pendingCompanyText")}
            </p>
            <p className="mt-2 text-sm font-medium theme-foreground">
              {status === "verified"
                ? t("dashboard.publicListingLive")
                : t("dashboard.publicListingHidden")}
            </p>
          </div>
          <div className="rounded-2xl border p-4 theme-surface md:min-w-40">
            <p className="text-sm theme-muted">
              {t("settings.profileCompleteness")}
            </p>
            <p className="mt-1 text-xl font-semibold theme-foreground">
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
          supportError={supportError}
        />
      </div>
    </div>
  );
}

function dashboardNavItemClass(selected: boolean) {
  return cx(
    "relative z-10 inline-flex h-10 min-w-max items-center gap-2 rounded-lg px-3 text-left text-sm font-medium transition lg:w-full lg:min-w-0",
    selected
      ? "theme-primary-button shadow-sm"
      : "theme-ghost-button hover:-translate-y-0.5",
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
  if (role === "seller" && value === "documents") return value;
  if (role === "seller" && value === "support-team") return value;
  if (role === "buyer" && value === "saved-products") return value;
  return null;
}

function Action({
  href,
  label,
  locale,
  primary = false,
}: {
  href: string;
  label: string;
  locale: "en" | "ko";
  primary?: boolean;
}) {
  return (
    <Link
      href={withLocale(href, locale)}
      className={
        primary
          ? "inline-flex h-8 items-center justify-center rounded-md px-2.5 text-xs font-semibold theme-primary-button"
          : "inline-flex h-8 items-center justify-center rounded-md border px-2.5 text-xs font-medium theme-secondary-button"
      }
    >
      {label}
    </Link>
  );
}
