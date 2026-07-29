"use client";

import { PayoutInformationClient } from "@/components/payout-information-client";
import { useI18n } from "@/components/i18n-provider";

export function SellerPayoutInformationSection() {
  const { locale } = useI18n();
  return (
    <div className="[&>main]:mx-0 [&>main]:max-w-none [&>main]:px-0 [&>main]:py-0">
      <PayoutInformationClient locale={locale} />
    </div>
  );
}
