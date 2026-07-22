import { AdminPartnersPageContent } from "@/components/admin-partners-page";
import { loadAdminPartnerListRouteData } from "@/lib/admin-partner-route-data";

export const dynamic = "force-dynamic";

export default async function KoreanAdminPartnersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { query, data, failed } = await loadAdminPartnerListRouteData(
    await searchParams,
  );
  return <AdminPartnersPageContent locale="ko" query={query} data={data} failed={failed} />;
}
