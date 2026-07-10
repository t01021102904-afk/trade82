import { DashboardSettingsClient } from "@/components/dashboard-settings-client";
import { getCurrentUserProfile } from "@/lib/authz";
import { getDb } from "@/lib/db";
import type { Locale } from "@/lib/i18n";
import { requireAppProfile } from "@/lib/require-auth";

function serializeDate(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

export async function DashboardSettingsPage({
  locale,
  redirectUrl,
}: {
  locale: Locale;
  redirectUrl: string;
}) {
  const [{ role }, profile] = await Promise.all([
    requireAppProfile(redirectUrl),
    getCurrentUserProfile(),
  ]);
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
