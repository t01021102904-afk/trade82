import { PartnerDashboardView } from "@/components/partner-dashboard-view";
import type { AdminPartnerDetailQuery } from "@/lib/admin-partners";
import type { getAdminPartnerDashboardData } from "@/lib/partner-dashboard";
import { type Locale } from "@/lib/i18n";

type AdminPartnerData = NonNullable<
  Awaited<ReturnType<typeof getAdminPartnerDashboardData>>
>;

export function AdminPartnerDetailPage({
  locale,
  data,
  referralUrl,
  partnerProfileId,
  query,
}: {
  locale: Locale;
  data: AdminPartnerData;
  referralUrl: string;
  partnerProfileId: string;
  query: AdminPartnerDetailQuery;
}) {
  return (
    <PartnerDashboardView
      locale={locale}
      data={data}
      referralUrl={referralUrl}
      viewMode="admin-readonly"
      paginationBasePath={`/admin/partners/${encodeURIComponent(partnerProfileId)}`}
      paginationQuery={{
        analyticsRange: query.analyticsRange,
        commissionPage: String(query.commissionPage),
        memberPage: String(query.memberPage),
      }}
    />
  );
}
