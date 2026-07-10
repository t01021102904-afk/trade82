import Link from "next/link";

import { BackButton } from "@/components/back-button";
import { BuyerRfqDetail } from "@/components/buyer-rfq-detail";
import { BuyerRfqForm } from "@/components/buyer-rfq-form";
import { BuyerRfqs } from "@/components/buyer-rfqs";
import { SectionHeader } from "@/components/section-header";
import { getDictionary, type Locale, withLocale } from "@/lib/i18n";

export function BuyerRfqsPageContent({ locale }: { locale: Locale }) {
  const messages = getDictionary(locale);
  return (
    <div className="min-h-screen theme-bg">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <BackButton fallbackHref="/dashboard/buyer" />
        <SectionHeader
          label={messages.dashboard.label}
          title={messages.rfq.myRfqs}
          description={messages.rfq.reviewNotice}
          action={
            <Link
              href={withLocale("/dashboard/rfqs/new", locale)}
              className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-semibold theme-primary-button"
            >
              {messages.rfq.createRfq}
            </Link>
          }
        />
        <BuyerRfqs />
      </div>
    </div>
  );
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
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:px-8">
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
