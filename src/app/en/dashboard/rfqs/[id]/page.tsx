import { BuyerRfqDetailPageContent } from "@/components/buyer-rfq-pages";
import { requireDashboardRole } from "@/lib/require-auth";

export default async function EnglishBuyerRfqDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireDashboardRole("/en/dashboard/rfqs", "buyer");
  const { id } = await params;
  return <BuyerRfqDetailPageContent id={id} locale="en" />;
}
