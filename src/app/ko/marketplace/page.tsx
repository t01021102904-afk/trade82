import type { Metadata } from "next";

import { MarketplaceClient } from "@/components/marketplace-client";
import { SectionHeader } from "@/components/section-header";
import { getDictionary } from "@/lib/i18n";
import { publicPageMetadata } from "@/lib/seo";

export const metadata: Metadata = publicPageMetadata({
  title: "Marketplace | Trade82",
  description: "Discover Korean products from verified sellers for U.S. B2B sourcing.",
  path: "/ko/marketplace",
  languages: {
    en: "/marketplace",
    ko: "/ko/marketplace",
  },
});

export default function KoMarketplacePage() {
  const messages = getDictionary("ko");
  return (
    <div className="bm-grid-surface theme-bg">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:px-8">
        <SectionHeader label={messages.marketplace.label} title={messages.marketplace.title} description={messages.marketplace.description} />
        <MarketplaceClient />
      </div>
    </div>
  );
}
