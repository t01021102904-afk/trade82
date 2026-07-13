import { AdminPaymentsPageContent } from "@/components/admin-payments-page";
import { requireAdmin } from "@/lib/require-auth";

export default async function KoreanAdminPaymentsPage() {
  await requireAdmin("/ko/admin/payments");
  return <AdminPaymentsPageContent locale="ko" />;
}
