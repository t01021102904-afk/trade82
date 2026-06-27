import Link from "next/link";

import { AdminCompanies } from "@/components/admin-companies";
import { SectionHeader } from "@/components/section-header";
import { getDictionary, type Locale, withLocale } from "@/lib/i18n";
import { requireAdmin } from "@/lib/require-auth";

export default async function AdminCompaniesPage() {
  await requireAdmin("/admin/companies");

  return <AdminCompaniesPageContent locale="en" />;
}

export function AdminCompaniesPageContent({ locale }: { locale: Locale }) {
  const messages = getDictionary(locale);
  const admin = messages.admin;

  return (
    <div className="bg-zinc-50">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:px-8">
        <SectionHeader
          label={admin.label}
          title={admin.companiesPageTitle}
          description={admin.companiesPageDescription}
          action={
            <Link
              href={withLocale("/admin", locale)}
              className="rounded-md border border-zinc-200 bg-white px-3.5 py-2 text-sm font-medium text-zinc-700 hover:border-blue-200 hover:text-blue-700"
            >
              ← {admin.backToAdmin}
            </Link>
          }
        />
        <AdminCompanies />
      </div>
    </div>
  );
}
