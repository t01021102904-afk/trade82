import { AdminCompaniesPageContent } from "../../../admin/companies/page";
import { requireAdmin } from "@/lib/require-auth";

export default async function EnglishAdminCompaniesPage() {
  await requireAdmin("/en/admin/companies");

  return <AdminCompaniesPageContent locale="en" />;
}
