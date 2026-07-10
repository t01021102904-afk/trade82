import { AdminRfqsPageContent } from "@/components/admin-rfq-page";
import { requireAdmin } from "@/lib/require-auth";

export default async function KoreanAdminRfqsPage() {
  await requireAdmin("/ko/admin/rfqs");
  return <AdminRfqsPageContent locale="ko" />;
}
