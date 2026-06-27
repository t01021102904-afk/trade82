import { DatabaseProductDetail } from "@/components/database-public-detail";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <DatabaseProductDetail id={id} />;
}
