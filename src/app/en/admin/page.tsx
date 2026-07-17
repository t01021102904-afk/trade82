import { AdminConsolePageContent } from "@/components/admin-console-page-content";
import { requireAdmin } from "@/lib/require-auth";

export default async function EnglishAdminConsolePage() {
  await requireAdmin("/en/admin");

  return <AdminConsolePageContent locale="en" />;
}
