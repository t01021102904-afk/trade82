import {
  marketplaceQueryState,
  type MarketplaceQueryState,
} from "@/lib/public-marketplace-query-state";

export const MARKETPLACE_SEARCH_DEBOUNCE_MS = 300;

export type MarketplaceQueryUpdates = Partial<
  Record<
    "q" | "category" | "price" | "moq" | "certification" | "shipping" | "page",
    string
  >
>;

export type MarketplaceRequestPlan = "server" | "client" | "none";

export function marketplaceQueryKey(query: MarketplaceQueryState) {
  return JSON.stringify([
    query.q,
    query.category,
    query.price,
    query.moq,
    query.certification,
    query.shipping,
    query.page,
  ]);
}

export function marketplaceUrlWithUpdates({
  pathname,
  currentSearch,
  updates,
}: {
  pathname: string;
  currentSearch: string;
  updates: MarketplaceQueryUpdates;
}) {
  const searchParams = new URLSearchParams(currentSearch);

  for (const [key, value] of Object.entries(updates) as Array<
    [keyof MarketplaceQueryUpdates, string]
  >) {
    if (!value || value === "all" || (key === "q" && !value.trim())) {
      searchParams.delete(key);
    } else {
      searchParams.set(key, value);
    }
  }

  if (!Object.prototype.hasOwnProperty.call(updates, "page")) {
    searchParams.delete("page");
  }

  const query = searchParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function marketplaceQueryFromUrl(url: string) {
  const parsed = new URL(url, "https://trade82.com");
  return marketplaceQueryState(parsed.searchParams);
}

export class MarketplaceRequestCoordinator {
  private pendingServerQueryKey: string | null;
  private lastResolvedQueryKey: string | null = null;

  constructor(initialServerQuery?: MarketplaceQueryState) {
    this.pendingServerQueryKey = initialServerQuery
      ? marketplaceQueryKey(initialServerQuery)
      : null;
  }

  nextRequest(query: MarketplaceQueryState): MarketplaceRequestPlan {
    const queryKey = marketplaceQueryKey(query);

    if (this.pendingServerQueryKey) {
      if (this.pendingServerQueryKey === queryKey) {
        this.pendingServerQueryKey = null;
        this.lastResolvedQueryKey = queryKey;
        return "server";
      }
      return "none";
    }

    if (this.lastResolvedQueryKey === queryKey) return "none";

    this.lastResolvedQueryKey = queryKey;
    return "client";
  }
}

export type MarketplaceRequestHandle = {
  id: number;
  controller: AbortController;
};

export class MarketplaceRequestAbortManager {
  private current: MarketplaceRequestHandle | null = null;
  private nextId = 1;

  begin(): MarketplaceRequestHandle {
    this.current?.controller.abort();
    const request = {
      id: this.nextId++,
      controller: new AbortController(),
    };
    this.current = request;
    return request;
  }

  isCurrent(request: MarketplaceRequestHandle) {
    return this.current?.id === request.id && !request.controller.signal.aborted;
  }

  clear(request: MarketplaceRequestHandle) {
    if (this.current?.id === request.id) {
      this.current = null;
    }
  }

  abort(request: MarketplaceRequestHandle) {
    request.controller.abort();
    this.clear(request);
  }
}

type MarketplaceTimer = ReturnType<typeof setTimeout>;

type MarketplaceTimerApi = {
  setTimeout: (callback: () => void, delay: number) => MarketplaceTimer;
  clearTimeout: (timer: MarketplaceTimer) => void;
};

const browserTimerApi: MarketplaceTimerApi = {
  setTimeout,
  clearTimeout,
};

export function scheduleMarketplaceSearch({
  value,
  onCommit,
  timerApi = browserTimerApi,
}: {
  value: string;
  onCommit: (value: string) => void;
  timerApi?: MarketplaceTimerApi;
}) {
  const timer = timerApi.setTimeout(
    () => onCommit(value),
    MARKETPLACE_SEARCH_DEBOUNCE_MS,
  );

  return () => timerApi.clearTimeout(timer);
}

export type MarketplaceResultsViewState =
  | "loading"
  | "loaded"
  | "empty"
  | "error";

export function marketplaceResultsViewState({
  loading,
  requestError,
  productCount,
}: {
  loading: boolean;
  requestError: boolean;
  productCount: number;
}): MarketplaceResultsViewState {
  if (requestError) return "error";
  if (loading) return "loading";
  return productCount > 0 ? "loaded" : "empty";
}
