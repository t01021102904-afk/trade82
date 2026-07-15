import type { Metadata } from "next";

import { BackButton } from "@/components/back-button";
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
    <div className="bm-grid-surface theme-bg">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Marketplace", path: "/marketplace" },
        ])}
      />
      {initialData?.products.length ? (
        <JsonLd data={marketplaceItemListJsonLd(initialData.products, "en")} />
      ) : null}
      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-6 sm:px-6 lg:px-8">
        <BackButton fallbackHref="/" />
        <MarketplaceSeoContent locale="en" />
        <MarketplaceClient
          initialProducts={initialData?.products}
          initialPagination={initialData?.pagination}
          initialFilterOptions={initialData?.filterOptions}
          initialQueryState={queryState}
          initialError={!initialData}
        />
      </div>
    </div>
  );
}
