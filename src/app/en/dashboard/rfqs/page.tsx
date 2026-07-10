import { BuyerRfqsPageContent } from "@/components/buyer-rfq-pages";
import { requireDashboardRole } from "@/lib/require-auth";

export default async function EnglishBuyerRfqsPage() {
  await requireDashboardRole("/en/dashboard/rfqs", "buyer");
  return <BuyerRfqsPageContent locale="en" />;
}
