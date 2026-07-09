import { BackButton } from "@/components/back-button";
import { BuyerRfqDetail } from "@/components/buyer-rfq-detail";
import { SectionHeader } from "@/components/section-header";
import { getDictionary, type Locale } from "@/lib/i18n";
import { requireDashboardRole } from "@/lib/require-auth";

export default async function BuyerRfqDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireDashboardRole("/dashboard/rfqs", "buyer");
  const { id } = await params;
  return <BuyerRfqDetailPageContent id={id} locale="en" />;
}

export function BuyerRfqDetailPageContent({
  id,
  locale,
}: {
  id: string;
  locale: Locale;
}) {
  const messages = getDictionary(locale);
  return (
    <div className="min-h-screen theme-bg">
      <div className="mx-auto grid max-w-4xl gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <BackButton fallbackHref="/dashboard/rfqs" />
        <SectionHeader
          label={messages.rfq.rfq}
          title={messages.rfq.rfqDetails}
          description={messages.rfq.reviewNotice}
        />
        <BuyerRfqDetail id={id} />
      </div>
    </div>
  );
}
