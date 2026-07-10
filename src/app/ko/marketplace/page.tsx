import type { Metadata } from "next";

import { BackButton } from "@/components/back-button";
import { JsonLd } from "@/components/json-ld";
import { MarketplaceClient } from "@/components/marketplace-client";
import { MarketplaceSeoContent } from "@/components/public-marketplace-seo-content";
import { breadcrumbJsonLd, publicPageMetadata } from "@/lib/seo";

export const metadata: Metadata = publicPageMetadata({
  title: "Marketplace | Trade82",
  description: "Discover Korean products from verified sellers for global B2B sourcing.",
  path: "/ko/marketplace",
  languages: {
    en: "/marketplace",
    ko: "/ko/marketplace",
  },
});

export default function KoMarketplacePage() {
  return (
    <div className="bm-grid-surface theme-bg">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "홈", path: "/ko" },
          { name: "마켓플레이스", path: "/ko/marketplace" },
        ])}
      />
      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-6 sm:px-6 lg:px-8">
        <BackButton fallbackHref="/" />
        <MarketplaceSeoContent locale="ko" />
        <MarketplaceClient />
      </div>
    </div>
  );
}
