import { SellerDashboardShell } from "@/components/seller-dashboard-shell";
import { requireApprovedSupplierDashboard } from "@/lib/require-auth";

export default async function KoSellerDashboardPage() {
  await requireApprovedSupplierDashboard("/ko/dashboard/seller");
  return <SellerDashboardShell />;
}
