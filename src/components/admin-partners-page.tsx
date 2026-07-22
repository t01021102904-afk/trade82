import Link from "next/link";

import { AdminPartnerManagement } from "@/components/admin-partner-management";
import type { AdminPartnerListData, AdminPartnerListQuery } from "@/lib/admin-partners";
import { getDictionary, type Locale, withLocale } from "@/lib/i18n";
import { SectionHeader } from "@/components/section-header";

export function AdminPartnersPageContent({
  locale,
  query,
  data,
  failed = false,
}: {
  locale: Locale;
  query: AdminPartnerListQuery;
  data: AdminPartnerListData | null;
  failed?: boolean;
}) {
  const admin = getDictionary(locale).admin;

  return (
    <div className="theme-bg">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:px-8">
        <SectionHeader
          label={admin.label}
          title={admin.partnerManagementTitle}
          description={admin.partnerManagementPageDescription}
          action={
            <Link
              href={withLocale("/admin", locale)}
              className="rounded-md border px-3.5 py-2 text-sm font-medium theme-secondary-button"
            >
              ← {admin.backToAdmin}
            </Link>
          }
        />
        {failed || !data ? (
          <div className="border p-8 theme-border theme-surface-elevated">
            <p className="text-sm theme-muted">{admin.partnerLoadError}</p>
          </div>
        ) : (
          <AdminPartnerManagement locale={locale} data={data} query={query} />
        )}
      </div>
    </div>
  );
}
