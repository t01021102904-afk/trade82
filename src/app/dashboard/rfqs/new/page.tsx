import { NewBuyerRfqPageContent } from "@/components/buyer-rfq-pages";
import { requireDashboardRole } from "@/lib/require-auth";

export default async function NewBuyerRfqPage() {
  await requireDashboardRole("/dashboard/rfqs/new", "buyer");
  return <NewBuyerRfqPageContent locale="en" />;
}
