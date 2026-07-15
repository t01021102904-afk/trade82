export const PUBLIC_MARKETPLACE_PAGE_SIZE = 24;

export type MarketplaceQueryState = {
  q: string;
  category: string;
  price: string;
  moq: string;
  certification: string;
  shipping: string;
  page: number;
};

export type MarketplacePagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export type MarketplaceProductFilterOptions = {
  certifications: string[];
  shippingTerms: string[];
};

type SearchParamsReader = {
  get(name: string): string | null;
};

export type MarketplaceRouteSearchParams = Record<
  string,
  string | string[] | undefined
>;

export function marketplaceQueryState(
  searchParams: SearchParamsReader,
): MarketplaceQueryState {
  return {
    q: searchParams.get("q") ?? "",
    category: searchParams.get("category") ?? "all",
    price: searchParams.get("price") ?? "all",
    moq: searchParams.get("moq") ?? "all",
    certification: searchParams.get("certification") ?? "all",
    shipping: searchParams.get("shipping") ?? "all",
    page: parseMarketplacePage(searchParams.get("page")),
  };
}

export function marketplaceQueryStateFromRoute(
  searchParams: MarketplaceRouteSearchParams,
) {
  return marketplaceQueryState({
    get(name) {
      const value = searchParams[name];
      return Array.isArray(value) ? value[0] ?? null : value ?? null;
    },
  });
}

export function marketplaceSearchParams(query: MarketplaceQueryState) {
  const searchParams = new URLSearchParams({
    resource: "products",
    page: String(query.page),
    pageSize: String(PUBLIC_MARKETPLACE_PAGE_SIZE),
  });

  setMarketplaceQueryParam(searchParams, "q", query.q);
  setMarketplaceQueryParam(searchParams, "category", query.category);
  setMarketplaceQueryParam(searchParams, "price", query.price);
  setMarketplaceQueryParam(searchParams, "moq", query.moq);
  setMarketplaceQueryParam(searchParams, "certification", query.certification);
  setMarketplaceQueryParam(searchParams, "shipping", query.shipping);

  return searchParams;
}

export function sameMarketplaceQuery(
  left: MarketplaceQueryState,
  right: MarketplaceQueryState,
) {
  return (
    left.q === right.q &&
    left.category === right.category &&
    left.price === right.price &&
    left.moq === right.moq &&
    left.certification === right.certification &&
    left.shipping === right.shipping &&
    left.page === right.page
  );
}

export function shouldFetchMarketplaceProducts({
  isInitialRender,
  initialQueryState,
  currentQueryState,
}: {
  isInitialRender: boolean;
  initialQueryState?: MarketplaceQueryState;
  currentQueryState: MarketplaceQueryState;
}) {
  return !(
    isInitialRender &&
    initialQueryState &&
    sameMarketplaceQuery(initialQueryState, currentQueryState)
  );
}

export function marketplacePagination(
  page: number,
  pageSize: number,
  total: number,
): MarketplacePagination {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return {
    page,
    pageSize,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

export function parseMarketplacePage(value: string | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

function setMarketplaceQueryParam(
  searchParams: URLSearchParams,
  key: string,
  value: string,
) {
  if (!value || value === "all" || (key === "q" && !value.trim())) return;
  searchParams.set(key, value);
}
