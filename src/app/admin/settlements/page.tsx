import { AdminSettlementsPageContent } from "@/components/admin-trade-operations-pages";
import { requireAdmin } from "@/lib/authz";

export default async function AdminSettlementsPage() {
  await requireAdmin();
  return <AdminSettlementsPageContent locale="en" />;
}
