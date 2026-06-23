import { BuyersClient } from "@/components/buyers-client";
import { SectionHeader } from "@/components/section-header";
import { getDictionary, type Locale } from "@/lib/i18n";
import { publicBuyers } from "@/lib/mock-data";

export function BuyersPageContent({ locale }: { locale: Locale }) {
  const messages = getDictionary(locale);

  return (
    <div className="bg-zinc-50">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:px-8">
        <SectionHeader
          label={messages.buyers.label}
          title={messages.buyers.title}
          description={messages.buyers.description}
        />
        <BuyersClient buyers={publicBuyers} />
      </div>
    </div>
  );
}
