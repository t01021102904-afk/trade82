import { DatabaseCompanyDetail } from "@/components/database-public-detail";

export const dynamic = "force-dynamic";

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <DatabaseCompanyDetail id={id} />;
}
