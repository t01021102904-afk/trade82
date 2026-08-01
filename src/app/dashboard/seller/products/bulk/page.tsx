import { BulkProductRegistration } from "@/components/bulk-product-registration";
import { SellerDashboardShell } from "@/components/seller-dashboard-shell";
import { requireApprovedSupplierDashboard } from "@/lib/require-auth";

export default async function BulkProductRegistrationPage() {
  await requireApprovedSupplierDashboard("/dashboard/seller/products/bulk");
  return <SellerDashboardShell content={<BulkProductRegistration />} />;
}
