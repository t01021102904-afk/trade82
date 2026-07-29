import { SellerDashboardShell } from "@/components/seller-dashboard-shell";
import { requireDashboardRole } from "@/lib/require-auth";

export default async function SellerDashboardPage() {
  await requireDashboardRole("/dashboard/seller", "seller");
  return <SellerDashboardShell />;
}
