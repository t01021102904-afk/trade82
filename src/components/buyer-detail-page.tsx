import { DatabaseCompanyDetail } from "@/components/database-public-detail";
import type { Locale } from "@/lib/i18n";

export function generateBuyerStaticParams() {
  return [];
}

export function BuyerDetailPageContent({
  id,
}: {
  id: string;
  locale: Locale;
}) {
  return <DatabaseCompanyDetail id={id} />;
}
