"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";

import { useI18n } from "@/components/i18n-provider";
import {
  MarketplaceResultsPresentation,
  MarketplaceResultsSummary,
} from "@/components/marketplace-results-presentation";
import { PaginationControls } from "@/components/pagination-controls";
import { ProductCard, ProductCardSkeleton } from "@/components/product-card";
import { marketplaceCategories } from "@/lib/marketplace";
import {
  MarketplaceRequestAbortManager,
  MarketplaceRequestCoordinator,
  marketplaceQueryFromUrl,
  marketplaceResultsViewState,
  marketplaceUrlWithUpdates,
  scheduleMarketplaceSearch,
  updateMarketplaceHistory,
  type MarketplaceQueryUpdates,
} from "@/lib/public-marketplace-client-state";
import { databaseProductToCard } from "@/lib/public-marketplace-presenters";
import {
  marketplaceQueryState,
  marketplaceSearchParams,
  sameMarketplaceQuery,
  type MarketplacePagination,
  type MarketplaceProductFilterOptions,
  type MarketplaceQueryState,
} from "@/lib/public-marketplace-query-state";
import type { Product } from "@/lib/types";

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium theme-foreground">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-md border px-3 outline-none theme-input focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

const DEFAULT_PAGINATION: MarketplacePagination = {
  page: 1,
  pageSize: 24,
  total: 0,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
};

const DEFAULT_QUERY_STATE: MarketplaceQueryState = marketplaceQueryState(
  new URLSearchParams(),
);

type MarketplaceClientProps = {
  initialProducts?: Product[];
  initialPagination?: MarketplacePagination;
  initialFilterOptions?: MarketplaceProductFilterOptions;
  initialQueryState?: MarketplaceQueryState;
  initialError?: boolean;
};

type MarketplaceApiResponse = {
  products?: Array<Record<string, unknown>>;
  pagination?: MarketplacePagination;
  filterOptions?: MarketplaceProductFilterOptions;
};

function marketplaceErrorDetails(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    name: "UnknownError",
    message: "Unknown marketplace error",
  };
}

function isMarketplaceAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function initialDataSignature({
  initialProducts,
  initialPagination,
  initialFilterOptions,
  initialQueryState,
  initialError,
}: MarketplaceClientProps) {
  return JSON.stringify({
    initialProducts,
    initialPagination,
    initialFilterOptions,
    initialQueryState,
    initialError,
  });
}

export function MarketplaceClient(props: MarketplaceClientProps) {
  return (
    <MarketplaceClientContent key={initialDataSignature(props)} {...props} />
  );
}

function MarketplaceClientContent({
  initialProducts,
  initialPagination,
  initialFilterOptions,
  initialQueryState,
  initialError = false,
}: MarketplaceClientProps) {
  const { locale, t } = useI18n();
  const gridTopRef = useRef<HTMLDivElement>(null);
  const requestCoordinatorRef = useRef(
    new MarketplaceRequestCoordinator(initialQueryState),
  );
  const abortManagerRef = useRef(new MarketplaceRequestAbortManager());
  const [databaseProducts, setDatabaseProducts] = useState<Product[]>(
    initialProducts ?? [],
  );
  const [pagination, setPagination] = useState<MarketplacePagination>(
    initialPagination ?? DEFAULT_PAGINATION,
  );
  const [filterOptions, setFilterOptions] =
    useState<MarketplaceProductFilterOptions>({
      certifications: initialFilterOptions?.certifications ?? [],
      shippingTerms: initialFilterOptions?.shippingTerms ?? [],
    });
  const [queryState, setQueryState] = useState<MarketplaceQueryState>(
    initialQueryState ?? DEFAULT_QUERY_STATE,
  );
  const [searchInput, setSearchInput] = useState(
    (initialQueryState ?? DEFAULT_QUERY_STATE).q,
  );
  const [databaseLoading, setDatabaseLoading] = useState(
    !initialQueryState && !initialError,
  );
  const [requestError, setRequestError] = useState(initialError);

  useEffect(() => {
    const plan = requestCoordinatorRef.current.nextRequest(queryState);
    if (plan !== "client") return;

    const abortManager = abortManagerRef.current;
    const request = abortManager.begin();
    const requestParams = marketplaceSearchParams(queryState);

    setDatabaseLoading(true);
    setRequestError(false);

    void fetch(`/api/public/marketplace?${requestParams.toString()}`, {
      signal: request.controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Marketplace request failed with status ${response.status}`);
        }

        try {
          return (await response.json()) as MarketplaceApiResponse;
        } catch (error) {
          console.error(
            "Marketplace response JSON parsing failed",
            marketplaceErrorDetails(error),
          );
          throw error;
        }
      })
      .then((result) => {
        if (!abortManager.isCurrent(request)) return;
        if (!Array.isArray(result.products) || !result.pagination) {
          const error = new Error("Marketplace response was incomplete");
          console.error(
            "Marketplace response validation failed",
            marketplaceErrorDetails(error),
          );
          throw error;
        }

        let mappedProducts: Product[];
        try {
          mappedProducts = result.products.map((product) =>
            databaseProductToCard(product, locale),
          );
        } catch (error) {
          console.error(
            "Marketplace product mapping failed",
            marketplaceErrorDetails(error),
          );
          throw error;
        }

        try {
          setDatabaseProducts(mappedProducts);
          setPagination(result.pagination);
          setFilterOptions(
            result.filterOptions ?? { certifications: [], shippingTerms: [] },
          );
          setDatabaseLoading(false);
        } catch (error) {
          console.error(
            "Marketplace results state update failed",
            marketplaceErrorDetails(error),
          );
          throw error;
        }
        abortManager.clear(request);
      })
      .catch((error: unknown) => {
        if (!abortManager.isCurrent(request)) return;
        if (isMarketplaceAbortError(error)) return;

        console.error(
          "Marketplace search request failed",
          marketplaceErrorDetails(error),
        );

        setRequestError(true);
        setDatabaseLoading(false);
        abortManager.clear(request);
      });

    return () => abortManager.abort(request);
  }, [locale, queryState]);

  const updateQuery = useCallback(
    (
      updates: MarketplaceQueryUpdates,
      options: { history?: "push" | "replace"; scroll?: boolean } = {},
    ) => {
      try {
        const currentUrl = new URL(window.location.href);
        const nextUrl = marketplaceUrlWithUpdates({
          pathname: currentUrl.pathname,
          currentSearch: currentUrl.search,
          updates,
        });
        const nextQueryState = marketplaceQueryFromUrl(nextUrl);

        if (`${currentUrl.pathname}${currentUrl.search}` !== nextUrl) {
          updateMarketplaceHistory(
            window.history,
            nextUrl,
            options.history === "push" ? "push" : "replace",
          );
        }

        if (Object.prototype.hasOwnProperty.call(updates, "q")) {
          setSearchInput(nextQueryState.q);
        }
        setQueryState((current) =>
          sameMarketplaceQuery(current, nextQueryState)
            ? current
            : nextQueryState,
        );

        if (options.scroll) {
          requestAnimationFrame(() => {
            gridTopRef.current?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
          });
        }
      } catch (error) {
        console.error(
          "Marketplace URL update failed",
          marketplaceErrorDetails(error),
        );
        setRequestError(true);
        setDatabaseLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    const handlePopState = () => {
      try {
        const nextQueryState = marketplaceQueryFromUrl(window.location.href);
        setSearchInput(nextQueryState.q);
        setQueryState((current) =>
          sameMarketplaceQuery(current, nextQueryState) ? current : nextQueryState,
        );
      } catch (error) {
        console.error(
          "Marketplace browser history update failed",
          marketplaceErrorDetails(error),
        );
        setRequestError(true);
        setDatabaseLoading(false);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (searchInput === queryState.q) return;

    return scheduleMarketplaceSearch({
      value: searchInput,
      onCommit: (value) => updateQuery({ q: value }),
    });
  }, [queryState.q, searchInput, updateQuery]);

  const certifications = useMemo(
    () => filterOptions.certifications,
    [filterOptions.certifications],
  );
  const shippingTerms = useMemo(
    () => filterOptions.shippingTerms,
    [filterOptions.shippingTerms],
  );
  const resultState = marketplaceResultsViewState({
    loading: databaseLoading,
    requestError,
    productCount: databaseProducts.length,
  });
  const {
    category,
    price,
    moq,
    certification,
    shipping: shippingTerm,
  } = queryState;

  return (
    <div className="grid min-w-0 gap-8">
      <div className="bm-premium-card grid min-w-0 gap-5 rounded-lg border p-4 backdrop-blur theme-surface-elevated">
        <label className="relative block">
          <span className="sr-only">{t("marketplace.searchProducts")}</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 theme-muted" aria-hidden="true" />
          <input
            data-testid="marketplace-search-input"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={t("marketplace.searchPlaceholder")}
            className="h-12 w-full rounded-md border pl-12 pr-4 outline-none theme-input focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
          />
        </label>

        <div className="-mx-4 min-w-0 max-w-full overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="flex min-w-max gap-2 pb-1" role="group" aria-label={t("marketplace.category")}>
            {[
              { label: t("marketplace.allCategories"), value: "all" },
              ...marketplaceCategories.map((item) => ({ label: item, value: item })),
            ].map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => updateQuery({ category: item.value })}
                className={`min-h-11 rounded-md border px-4 text-sm font-medium transition ${
                  category === item.value
                    ? "theme-primary-button"
                    : "theme-secondary-button"
                }`}
                aria-pressed={category === item.value}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <details className="relative z-10 rounded-md border theme-surface">
          <summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm font-medium theme-foreground">
            {t("marketplace.moreFilters")}
          </summary>
          <div className="grid gap-4 border-t p-4 theme-border sm:grid-cols-2 lg:grid-cols-4">
            <SelectField
              label={t("marketplace.price")}
              value={price}
              onChange={(value) => updateQuery({ price: value })}
              options={[
                { label: t("marketplace.anyPrice"), value: "all" },
                { label: t("marketplace.under3"), value: "under-3" },
                { label: t("marketplace.threeToEight"), value: "3-8" },
                { label: t("marketplace.eightPlus"), value: "8-plus" },
              ]}
            />
            <SelectField
              label={t("marketplace.moq")}
              value={moq}
              onChange={(value) => updateQuery({ moq: value })}
              options={[
                { label: t("marketplace.anyMoq"), value: "all" },
                { label: t("marketplace.moq1000"), value: "1000" },
                { label: t("marketplace.moq5000"), value: "5000" },
                { label: t("marketplace.moq10000"), value: "10000" },
              ]}
            />
            <SelectField
              label={t("marketplace.certification")}
              value={certification}
              onChange={(value) => updateQuery({ certification: value })}
              options={[
                { label: t("marketplace.anyCertification"), value: "all" },
                ...certifications.map((item) => ({ label: item, value: item })),
              ]}
            />
            <SelectField
              label={t("marketplace.shipping")}
              value={shippingTerm}
              onChange={(value) => updateQuery({ shipping: value })}
              options={[
                { label: t("marketplace.anyTerm"), value: "all" },
                ...shippingTerms.map((item) => ({ label: item, value: item })),
              ]}
            />
          </div>
        </details>

        <div className="relative z-10 flex min-h-11 items-center justify-between border-t pt-3 text-sm theme-border theme-muted">
          <MarketplaceResultsSummary
            locale={locale}
            state={resultState}
            total={pagination.total}
            productsFoundLabel={t("marketplace.productsFound")}
          />
          <button
            type="button"
            onClick={() =>
              updateQuery({
                q: "",
                category: "all",
                price: "all",
                moq: "all",
                certification: "all",
                shipping: "all",
              })
            }
            className="min-h-11 px-2 font-medium text-[var(--accent-foreground)] hover:text-[var(--foreground)]"
          >
            {t("common.clearFilters")}
          </button>
        </div>
      </div>

      <div ref={gridTopRef} className="scroll-mt-24" />
      <MarketplaceResultsPresentation
        state={resultState}
        products={databaseProducts}
        renderLoading={() => (
          <div className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }, (_, index) => (
              <ProductCardSkeleton key={index} />
            ))}
          </div>
        )}
        renderProducts={(products) => (
          <>
            <div className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
            <PaginationControls
              page={pagination.page}
              totalPages={pagination.totalPages}
              locale={locale}
              onPageChange={(nextPage) =>
                updateQuery(
                  { page: nextPage === 1 ? "" : String(nextPage) },
                  { history: "push", scroll: true },
                )
              }
            />
          </>
        )}
        renderEmpty={() => <MarketplaceEmpty t={t} />}
        renderError={() => <MarketplaceUnavailable locale={locale} />}
      />
    </div>
  );
}

function MarketplaceEmpty({ t }: { t: (key: string) => string }) {
  return (
    <div className="rounded-lg border border-dashed p-5 text-center theme-surface">
      <h2 className="text-base font-semibold theme-foreground">
        {t("marketplace.emptyTitle")}
      </h2>
      <p className="mt-2 text-sm theme-muted">{t("marketplace.emptyText")}</p>
    </div>
  );
}

function MarketplaceUnavailable({ locale }: { locale: "en" | "ko" }) {
  const message = locale === "ko"
    ? "현재 상품 목록을 불러올 수 없습니다. 잠시 후 다시 시도해 주세요."
    : "Product listings are temporarily unavailable. Please try again shortly.";

  return (
    <div className="rounded-lg border border-dashed p-5 text-center theme-surface" role="status">
      <p className="text-sm theme-muted">{message}</p>
    </div>
  );
}
