import { AdminPayoutProfilesPageContent } from "@/components/admin-trade-operations-pages";
import { requireAdmin } from "@/lib/authz";

export default async function EnglishAdminPayoutProfilesPage() {
  await requireAdmin();
  return <AdminPayoutProfilesPageContent locale="en" />;
}
