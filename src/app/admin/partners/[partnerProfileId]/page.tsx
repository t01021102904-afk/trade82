import { notFound } from "next/navigation";

import { AdminPartnerDetailPage } from "@/components/admin-partner-detail-page";
import { loadAdminPartnerDetailRouteData } from "@/lib/admin-partner-route-data";
import { getAppUrl } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export default async function AdminPartnerDetailRoute({
  params,
  searchParams,
}: {
  params: Promise<{ partnerProfileId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { partnerProfileId } = await params;
  if (!partnerProfileId || partnerProfileId.length > 100) notFound();
  const { query, data } = await loadAdminPartnerDetailRouteData(
    partnerProfileId,
    await searchParams,
  );
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
