import { AdminRfqsPageContent } from "@/components/admin-rfq-page";
import { requireAdmin } from "@/lib/require-auth";

export default async function AdminRfqsPage() {
  await requireAdmin("/admin/rfqs");
  return <AdminRfqsPageContent locale="en" />;
}
