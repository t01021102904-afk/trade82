import { SellerDashboardShell } from "@/components/seller-dashboard-shell";
import { requireDashboardRole } from "@/lib/require-auth";

export default async function EnSellerDashboardPage() {
  await requireDashboardRole("/en/dashboard/seller", "seller");
  return <SellerDashboardShell />;
}
