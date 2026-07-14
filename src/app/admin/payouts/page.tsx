import { AdminPayoutsPageContent } from "@/components/admin-trade-operations-pages";
import { requireAdmin } from "@/lib/authz";

export default async function AdminPayoutsPage() {
  await requireAdmin();
  return <AdminPayoutsPageContent locale="en" />;
}
