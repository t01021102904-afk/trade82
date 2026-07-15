import "server-only";

import { getCurrentUserProfile, isAdminUser } from "@/lib/authz";
import { databaseProductToCard } from "@/lib/public-marketplace-presenters";
import { getPublicMarketplaceProducts } from "@/lib/public-marketplace-data";
import {
  marketplaceSearchParams,
  type MarketplacePagination,
  type MarketplaceProductFilterOptions,
  type MarketplaceQueryState,
} from "@/lib/public-marketplace-query-state";
import type { Locale } from "@/lib/i18n";
import type { Product } from "@/lib/types";

export type InitialMarketplaceData = {
  products: Product[];
  pagination: MarketplacePagination;
  filterOptions: MarketplaceProductFilterOptions;
};

export async function getInitialMarketplaceData({
  locale,
  queryState,
}: {
  locale: Locale;
  queryState: MarketplaceQueryState;
}): Promise<InitialMarketplaceData> {
  const profile = await getCurrentUserProfile().catch(() => null);
  const admin = profile ? await isAdminUser().catch(() => false) : false;
  const result = await getPublicMarketplaceProducts({
    searchParams: marketplaceSearchParams(queryState),
    profileId: profile?.id ?? null,
    admin,
  });

  return {
    products: result.products.map((product) =>
      databaseProductToCard(product, locale),
    ),
    pagination: result.pagination,
    filterOptions: result.filterOptions,
  };
}
