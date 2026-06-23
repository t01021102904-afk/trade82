import { SectionHeader } from "@/components/section-header";
import { SellersClient } from "@/components/sellers-client";
import { getDictionary } from "@/lib/i18n";
import { publicSellers } from "@/lib/mock-data";

export default function KoSellersPage() {
  const messages = getDictionary("ko");
  return (
    <div className="bg-zinc-50">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:px-8">
        <SectionHeader label={messages.sellers.label} title={messages.sellers.title} description={messages.sellers.description} />
        <SellersClient sellers={publicSellers} />
      </div>
    </div>
  );
}
