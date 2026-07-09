import { BuyerRfqDetailPageContent } from "../../../../dashboard/rfqs/[id]/page";
import { requireDashboardRole } from "@/lib/require-auth";

export default async function KoreanBuyerRfqDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireDashboardRole("/ko/dashboard/rfqs", "buyer");
  const { id } = await params;
  return <BuyerRfqDetailPageContent id={id} locale="ko" />;
}
