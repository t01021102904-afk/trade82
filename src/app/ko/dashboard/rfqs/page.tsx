import { BuyerRfqsPageContent } from "@/components/buyer-rfq-pages";
import { requireDashboardRole } from "@/lib/require-auth";

export default async function KoreanBuyerRfqsPage() {
  await requireDashboardRole("/ko/dashboard/rfqs", "buyer");
  return <BuyerRfqsPageContent locale="ko" />;
}
