import { AdminPaymentRequests } from "@/components/admin-payment-requests";
import { BackButton } from "@/components/back-button";
import { SectionHeader } from "@/components/section-header";
import { getDictionary, type Locale } from "@/lib/i18n";

export function AdminPaymentsPageContent({ locale }: { locale: Locale }) {
  const messages = getDictionary(locale);

  return (
    <div className="min-h-screen theme-bg">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <BackButton fallbackHref="/admin" />
        <SectionHeader
          label={messages.admin.label}
          title={messages.payments.adminTitle}
          description={messages.payments.adminDescription}
        />
        <AdminPaymentRequests />
      </div>
    </div>
  );
}
