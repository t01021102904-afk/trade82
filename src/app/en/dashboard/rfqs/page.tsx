import { BuyerRfqsPageContent } from "../../../dashboard/rfqs/page";
import { requireDashboardRole } from "@/lib/require-auth";

export default async function EnglishBuyerRfqsPage() {
  await requireDashboardRole("/en/dashboard/rfqs", "buyer");
  return <BuyerRfqsPageContent locale="en" />;
}
