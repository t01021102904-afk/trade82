import { BackButton } from "@/components/back-button";
import { BuyerRfqForm } from "@/components/buyer-rfq-form";
import { SectionHeader } from "@/components/section-header";
import { getDictionary, type Locale } from "@/lib/i18n";
import { requireDashboardRole } from "@/lib/require-auth";

export default async function NewBuyerRfqPage() {
  await requireDashboardRole("/dashboard/rfqs/new", "buyer");
  return <NewBuyerRfqPageContent locale="en" />;
}

export function NewBuyerRfqPageContent({ locale }: { locale: Locale }) {
  const messages = getDictionary(locale);
  return (
    <div className="min-h-screen theme-bg">
      <div className="mx-auto grid max-w-4xl gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <BackButton fallbackHref="/dashboard/rfqs" />
        <SectionHeader
          label={messages.rfq.rfq}
          title={messages.rfq.createRfq}
          description={messages.rfq.reviewNotice}
        />
        <BuyerRfqForm />
      </div>
    </div>
  );
}
