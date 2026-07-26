import type { Metadata } from "next";

import { JsonLd } from "@/components/json-ld";
import { MarketplaceClient } from "@/components/marketplace-client";
import { MarketplaceSeoContent } from "@/components/public-marketplace-seo-content";
import { getInitialMarketplaceData } from "@/lib/public-marketplace-initial-data";
import {
  marketplaceQueryStateFromRoute,
  type MarketplaceRouteSearchParams,
} from "@/lib/public-marketplace-query-state";
import {
  breadcrumbJsonLd,
  marketplaceItemListJsonLd,
  publicPageMetadata,
} from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = publicPageMetadata({
  title: "Marketplace | Trade82",
  description:
    "Browse Korean products from verified suppliers for wholesale sourcing. Compare product information, minimum order quantities, pricing availability, shipping terms, certifications, and seller profiles before starting an inquiry.",
  path: "/marketplace",
  languages: {
    en: "/marketplace",
    ko: "/ko/marketplace",
  },
});

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<MarketplaceRouteSearchParams>;
}) {
  const queryState = marketplaceQueryStateFromRoute(await searchParams);
  const initialData = await getInitialMarketplaceData({
    locale: "en",
    queryState,
  }).catch(() => null);

  return (
    <main className="min-h-screen bg-white text-zinc-950">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Marketplace", path: "/marketplace" },
        ])}
      />
      {initialData?.products.length ? (
        <JsonLd data={marketplaceItemListJsonLd(initialData.products, "en")} />
      ) : null}
      <div className="mx-auto grid max-w-[1440px] gap-7 px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <MarketplaceSeoContent locale="en" />
        <MarketplaceClient
          initialProducts={initialData?.products}
          initialPagination={initialData?.pagination}
          initialFilterOptions={initialData?.filterOptions}
          initialQueryState={queryState}
          initialError={!initialData}
        />
      </div>
    </main>
  );
}
