import { BuyerRfqsPageContent } from "@/components/buyer-rfq-pages";
import { requireDashboardRole } from "@/lib/require-auth";

export default async function BuyerRfqsPage() {
  await requireDashboardRole("/dashboard/rfqs", "buyer");
  return <BuyerRfqsPageContent locale="en" />;
}
