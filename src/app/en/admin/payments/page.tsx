import { AdminPaymentsPageContent } from "@/components/admin-payments-page";
import { requireAdmin } from "@/lib/require-auth";

export default async function EnglishAdminPaymentsPage() {
  await requireAdmin("/en/admin/payments");
  return <AdminPaymentsPageContent locale="en" />;
}
