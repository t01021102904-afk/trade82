import { AdminConsolePageContent } from "../../admin/page";
import { requireAdmin } from "@/lib/require-auth";

export default async function EnglishAdminConsolePage() {
  await requireAdmin("/en/admin");

  return <AdminConsolePageContent locale="en" />;
}
