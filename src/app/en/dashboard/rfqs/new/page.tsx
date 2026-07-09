import { NewBuyerRfqPageContent } from "../../../../dashboard/rfqs/new/page";
import { requireDashboardRole } from "@/lib/require-auth";

export default async function EnglishNewBuyerRfqPage() {
  await requireDashboardRole("/en/dashboard/rfqs/new", "buyer");
  return <NewBuyerRfqPageContent locale="en" />;
}
