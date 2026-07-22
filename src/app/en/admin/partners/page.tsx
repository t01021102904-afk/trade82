import { AdminPartnersPageContent } from "@/components/admin-partners-page";
import {
  getAdminPartnerListData,
  parseAdminPartnerListQuery,
} from "@/lib/admin-partners";
import { requireAdmin } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function EnglishAdminPartnersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const query = parseAdminPartnerListQuery(await searchParams);
  let data: Awaited<ReturnType<typeof getAdminPartnerListData>> | null = null;
  let failed = false;
  try {
    data = await getAdminPartnerListData(query);
  } catch {
    failed = true;
  }
  return <AdminPartnersPageContent locale="en" query={query} data={data} failed={failed} />;
}
