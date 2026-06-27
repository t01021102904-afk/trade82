import { AdminVerificationsPageContent } from "../../../admin/verifications/page";
import { requireAdmin } from "@/lib/require-auth";

export default async function EnglishAdminVerificationsPage() {
  await requireAdmin("/en/admin/verifications");

  return <AdminVerificationsPageContent locale="en" />;
}
