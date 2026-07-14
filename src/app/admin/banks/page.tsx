import { AdminBanksPageContent } from "@/components/admin-trade-operations-pages";
import { requireAdmin } from "@/lib/authz";

export default async function AdminBanksPage() {
  await requireAdmin();
  return <AdminBanksPageContent locale="en" />;
}
