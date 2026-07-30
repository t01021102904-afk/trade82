export const PUBLIC_MARKETPLACE_PAGE_SIZE = 24;
export const MARKETPLACE_MIN_PRICE = 1;
export const MARKETPLACE_MAX_PRICE = 800;

export type MarketplaceQueryState = {
  q: string;
  category: string;
  minPrice: number;
  maxPrice: number;
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
  const parsedMin = parseMarketplacePrice(
    searchParams.get("minPrice"),
    MARKETPLACE_MIN_PRICE,
  );
  const parsedMax = parseMarketplacePrice(
    searchParams.get("maxPrice"),
    MARKETPLACE_MAX_PRICE,
  );

  return {
    q: searchParams.get("q") ?? "",
    category: searchParams.get("category") ?? "all",
    minPrice: Math.min(parsedMin, parsedMax),
    maxPrice: Math.max(parsedMin, parsedMax),
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
  setMarketplacePriceParam(
    searchParams,
    "minPrice",
    query.minPrice,
    MARKETPLACE_MIN_PRICE,
  );
  setMarketplacePriceParam(
    searchParams,
    "maxPrice",
    query.maxPrice,
    MARKETPLACE_MAX_PRICE,
  );
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
    left.minPrice === right.minPrice &&
    left.maxPrice === right.maxPrice &&
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

export function parseMarketplacePrice(value: string | null, fallback: number) {
  if (value == null || !value.trim()) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(
    MARKETPLACE_MAX_PRICE,
    Math.max(MARKETPLACE_MIN_PRICE, Math.round(parsed)),
  );
}

export function isDefaultMarketplacePriceRange({
  minPrice,
  maxPrice,
}: Pick<MarketplaceQueryState, "minPrice" | "maxPrice">) {
  return (
    minPrice === MARKETPLACE_MIN_PRICE && maxPrice === MARKETPLACE_MAX_PRICE
  );
}

function setMarketplaceQueryParam(
  searchParams: URLSearchParams,
  key: string,
  value: string,
) {
  if (!value || value === "all" || (key === "q" && !value.trim())) return;
  searchParams.set(key, value);
}

function setMarketplacePriceParam(
  searchParams: URLSearchParams,
  key: "minPrice" | "maxPrice",
  value: number,
  defaultValue: number,
) {
  if (value === defaultValue) return;
  searchParams.set(key, String(value));
}
