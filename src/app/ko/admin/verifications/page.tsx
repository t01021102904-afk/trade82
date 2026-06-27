import { AdminVerificationsPageContent } from "../../../admin/verifications/page";
import { requireAdmin } from "@/lib/require-auth";

export default async function KoreanAdminVerificationsPage() {
  await requireAdmin("/ko/admin/verifications");

  return <AdminVerificationsPageContent locale="ko" />;
}
