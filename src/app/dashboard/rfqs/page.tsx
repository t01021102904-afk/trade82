import Link from "next/link";

import { BackButton } from "@/components/back-button";
import { BuyerRfqs } from "@/components/buyer-rfqs";
import { SectionHeader } from "@/components/section-header";
import { getDictionary, type Locale, withLocale } from "@/lib/i18n";
import { requireDashboardRole } from "@/lib/require-auth";

export default async function BuyerRfqsPage() {
  await requireDashboardRole("/dashboard/rfqs", "buyer");
  return <BuyerRfqsPageContent locale="en" />;
}

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
