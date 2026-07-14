import { AdminPayoutsPageContent } from "@/components/admin-trade-operations-pages";
import { requireAdmin } from "@/lib/authz";

export default async function KoreanAdminPayoutsPage() {
  await requireAdmin();
  return <AdminPayoutsPageContent locale="ko" />;
}
