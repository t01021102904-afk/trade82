import { SellerDashboardShell } from "@/components/seller-dashboard-shell";
import { requireApprovedSupplierDashboard } from "@/lib/require-auth";

export default async function EnSellerDashboardPage() {
  await requireApprovedSupplierDashboard("/en/dashboard/seller");
  return <SellerDashboardShell />;
}
