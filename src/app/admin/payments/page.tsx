import { AdminPaymentsPageContent } from "@/components/admin-payments-page";
import { requireAdmin } from "@/lib/require-auth";

export default async function AdminPaymentsPage() {
  await requireAdmin("/admin/payments");
  return <AdminPaymentsPageContent locale="en" />;
}
