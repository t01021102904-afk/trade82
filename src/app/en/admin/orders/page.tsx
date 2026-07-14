import { AdminOrdersPageContent } from "@/components/admin-trade-operations-pages";
import { requireAdmin } from "@/lib/authz";

export default async function EnglishAdminOrdersPage() {
  await requireAdmin();
  return <AdminOrdersPageContent locale="en" />;
}
