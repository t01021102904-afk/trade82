import { SellerDashboardShell } from "@/components/seller-dashboard-shell";
import { requireDashboardRole } from "@/lib/require-auth";

export default async function KoSellerDashboardPage() {
  await requireDashboardRole("/ko/dashboard/seller", "seller");
  return <SellerDashboardShell />;
}
