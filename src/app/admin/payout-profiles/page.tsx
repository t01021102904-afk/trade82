import { AdminPayoutProfilesPageContent } from "@/components/admin-trade-operations-pages";
import { requireAdmin } from "@/lib/authz";

export default async function AdminPayoutProfilesPage() {
  await requireAdmin();
  return <AdminPayoutProfilesPageContent locale="en" />;
}
