import { notFound } from "next/navigation";

import { AdminPartnerDetailPage } from "@/components/admin-partner-detail-page";
import { getAdminPartnerDashboardData } from "@/lib/partner-dashboard";
import { parseAdminPartnerDetailQuery } from "@/lib/admin-partners";
import { requireAdmin } from "@/lib/authz";
import { getAppUrl } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export default async function AdminPartnerDetailRoute({
  params,
  searchParams,
}: {
  params: Promise<{ partnerProfileId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const { partnerProfileId } = await params;
  if (!partnerProfileId || partnerProfileId.length > 100) notFound();
  const query = parseAdminPartnerDetailQuery(await searchParams);
  const data = await getAdminPartnerDashboardData({
    partnerProfileId,
    commissionPage: query.commissionPage,
    memberPage: query.memberPage,
    pageSize: 20,
    analyticsRange: query.analyticsRange,
  });
  if (!data) notFound();
  return (
    <AdminPartnerDetailPage
      locale="en"
      data={data}
      partnerProfileId={partnerProfileId}
      query={query}
      referralUrl={`${getAppUrl().replace(/\/$/, "")}/r/${data.partner.referralCode}`}
    />
  );
}
