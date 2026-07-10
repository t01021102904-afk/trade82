import { NewBuyerRfqPageContent } from "@/components/buyer-rfq-pages";
import { requireDashboardRole } from "@/lib/require-auth";

export default async function EnglishNewBuyerRfqPage() {
  await requireDashboardRole("/en/dashboard/rfqs/new", "buyer");
  return <NewBuyerRfqPageContent locale="en" />;
}
