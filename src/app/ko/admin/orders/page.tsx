import { AdminOrdersPageContent } from "@/components/admin-trade-operations-pages";
import { requireAdmin } from "@/lib/authz";

export default async function KoreanAdminOrdersPage() {
  await requireAdmin();
  return <AdminOrdersPageContent locale="ko" />;
}
