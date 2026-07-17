import { AdminConsolePageContent } from "@/components/admin-console-page-content";
import { requireAdmin } from "@/lib/require-auth";

export default async function AdminConsolePage() {
  await requireAdmin("/admin");

  return <AdminConsolePageContent locale="en" />;
}
