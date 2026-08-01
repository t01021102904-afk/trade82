import { SellerDashboardShell } from "@/components/seller-dashboard-shell";
import { requireApprovedSupplierDashboard } from "@/lib/require-auth";

export default async function SellerDashboardPage() {
  await requireApprovedSupplierDashboard("/dashboard/seller");
  return <SellerDashboardShell />;
}
