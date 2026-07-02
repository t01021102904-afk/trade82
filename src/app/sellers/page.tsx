import { SectionHeader } from "@/components/section-header";
import { SellersClient } from "@/components/sellers-client";
import { getDictionary } from "@/lib/i18n";

export default function SellersPage() {
  const messages = getDictionary("en");
  return (
    <div className="bm-grid-surface theme-bg">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:px-8">
        <SectionHeader
          label={messages.sellers.label}
          title={messages.sellers.title}
          description={messages.sellers.description}
        />
        <SellersClient />
      </div>
    </div>
  );
}
