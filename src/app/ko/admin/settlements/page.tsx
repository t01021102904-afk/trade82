import { AdminSettlementsPageContent } from "@/components/admin-trade-operations-pages";
import { requireAdmin } from "@/lib/authz";

export default async function KoreanAdminSettlementsPage() {
  await requireAdmin();
  return <AdminSettlementsPageContent locale="ko" />;
}
