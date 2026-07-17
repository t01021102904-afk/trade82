import { AdminSettlementsPageContent } from "@/components/admin-trade-operations-pages";
import { requireAdmin } from "@/lib/authz";

export default async function EnglishAdminSettlementsPage() {
  await requireAdmin();
  return <AdminSettlementsPageContent locale="en" />;
}
