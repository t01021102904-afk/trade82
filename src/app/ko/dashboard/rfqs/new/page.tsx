import { NewBuyerRfqPageContent } from "@/components/buyer-rfq-pages";
import { requireDashboardRole } from "@/lib/require-auth";

export default async function KoreanNewBuyerRfqPage() {
  await requireDashboardRole("/ko/dashboard/rfqs/new", "buyer");
  return <NewBuyerRfqPageContent locale="ko" />;
}
