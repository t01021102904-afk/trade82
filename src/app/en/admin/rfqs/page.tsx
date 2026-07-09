import { AdminRfqsPageContent } from "../../../admin/rfqs/page";
import { requireAdmin } from "@/lib/require-auth";

export default async function EnglishAdminRfqsPage() {
  await requireAdmin("/en/admin/rfqs");
  return <AdminRfqsPageContent locale="en" />;
}
