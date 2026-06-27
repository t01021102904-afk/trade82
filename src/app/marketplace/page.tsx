import { MarketplaceClient } from "@/components/marketplace-client";
import { SectionHeader } from "@/components/section-header";
import { getDictionary } from "@/lib/i18n";

export default function MarketplacePage() {
  const messages = getDictionary("en");
  return (
    <div className="bm-grid-surface bg-zinc-50">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:px-8">
        <SectionHeader
          label={messages.marketplace.label}
          title={messages.marketplace.title}
          description={messages.marketplace.description}
        />
        <MarketplaceClient />
      </div>
    </div>
  );
}
