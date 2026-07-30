import { BulkProductRegistration } from "@/components/bulk-product-registration";
import { SellerDashboardShell } from "@/components/seller-dashboard-shell";
import { requireDashboardRole } from "@/lib/require-auth";

export default async function EnBulkProductRegistrationPage() {
  await requireDashboardRole("/en/dashboard/seller/products/bulk", "seller");
  return <SellerDashboardShell content={<BulkProductRegistration />} />;
}
