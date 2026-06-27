import { AdminConsolePageContent } from "../../admin/page";
import { requireAdmin } from "@/lib/require-auth";

export default async function KoreanAdminConsolePage() {
  await requireAdmin("/ko/admin");

  return <AdminConsolePageContent locale="ko" />;
}
