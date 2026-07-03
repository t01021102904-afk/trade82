import { DashboardSettingsClient, type SettingsTab } from "@/components/dashboard-settings-client";
import { getCurrentUserProfile } from "@/lib/authz";
import { getDb } from "@/lib/db";
import type { Locale } from "@/lib/i18n";
import { requireAppProfile } from "@/lib/require-auth";

type SettingsSearchParams = Promise<{
  tab?: string | string[];
}>;

function parseSettingsTab(value: string | string[] | undefined): SettingsTab {
  const tab = Array.isArray(value) ? value[0] : value;
  return tab === "account" ||
    tab === "company" ||
    tab === "billing" ||
    tab === "security"
    ? tab
    : "account";
}

function serializeDate(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

export async function DashboardSettingsPage({
  locale,
  redirectUrl,
  searchParams,
}: {
  locale: Locale;
  redirectUrl: string;
  searchParams: SettingsSearchParams;
}) {
  const [{ role }, profile, params] = await Promise.all([
    requireAppProfile(redirectUrl),
    getCurrentUserProfile(),
    searchParams,
  ]);
  const activeTab = parseSettingsTab(params.tab);
  const sellerCompany =
    profile && (role === "seller" || role === "both")
      ? await getDb().company.findFirst({
          where: {
            ownerUserId: profile.id,
            companyRole: "seller",
          },
          select: {
            id: true,
            legalName: true,
            tradeName: true,
            stripeCustomerId: true,
            subscriptionStatus: true,
            subscriptionPlan: true,
            subscriptionCurrentPeriodEnd: true,
            verifiedSellerSince: true,
          },
        })
      : null;

  return (
    <DashboardSettingsClient
      activeTab={activeTab}
      role={role}
      locale={locale}
      sellerCompany={
        sellerCompany
          ? {
              ...sellerCompany,
              subscriptionCurrentPeriodEnd: serializeDate(
                sellerCompany.subscriptionCurrentPeriodEnd,
              ),
              verifiedSellerSince: serializeDate(sellerCompany.verifiedSellerSince),
            }
          : null
      }
    />
  );
}
