import { AdminVerifications } from "@/components/admin-verifications";
import { SectionHeader } from "@/components/section-header";
import { getDictionary, type Locale } from "@/lib/i18n";
import { requireAdmin } from "@/lib/require-auth";

export default async function AdminVerificationsPage() {
  await requireAdmin("/admin/verifications");

  return <AdminVerificationsPageContent locale="en" />;
}

export function AdminVerificationsPageContent({ locale }: { locale: Locale }) {
  const messages = getDictionary(locale);
  const admin = messages.admin;

  return (
    <div className="theme-bg">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:px-8">
        <SectionHeader
          label={admin.label}
          title={admin.reviewPageTitle}
          description={admin.reviewPageDescription}
        />
        <AdminVerifications />
      </div>
    </div>
  );
}
