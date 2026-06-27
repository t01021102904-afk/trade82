import { AdminCompaniesPageContent } from "../../../admin/companies/page";
import { requireAdmin } from "@/lib/require-auth";

export default async function KoreanAdminCompaniesPage() {
  await requireAdmin("/ko/admin/companies");

  return <AdminCompaniesPageContent locale="ko" />;
}
