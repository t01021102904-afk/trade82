"use client";

import {
  Check,
  Filter,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useI18n } from "@/components/i18n-provider";
import {
  MarketplaceResultsPresentation,
  MarketplaceResultsSummary,
} from "@/components/marketplace-results-presentation";
import { PaginationControls } from "@/components/pagination-controls";
import { ProductCard, ProductCardSkeleton } from "@/components/product-card";
import { useAccessibleDialog } from "@/hooks/use-accessible-dialog";
import {
  complianceClaimLabel,
  incotermLabel,
} from "@/lib/company-select-options";
import { marketplaceCategoryMessageKey } from "@/lib/home-product-categories";
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
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { name: "UnknownError", message: "Unknown marketplace error" };
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
  const filterDialogRef = useRef<HTMLDivElement>(null);
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
  const [retryVersion, setRetryVersion] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const closeFilters = useCallback(() => setFiltersOpen(false), []);

  useAccessibleDialog({
    open: filtersOpen,
    dialogRef: filterDialogRef,
    onClose: closeFilters,
  });

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
          throw new Error(
            `Marketplace request failed with status ${response.status}`,
          );
        }
        try {
          return (await response.json()) as MarketplaceApiResponse;
        } catch (error) {
          if (!isMarketplaceAbortError(error)) {
            console.error(
              "Marketplace response JSON parsing failed",
              marketplaceErrorDetails(error),
            );
          }
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

        setDatabaseProducts(mappedProducts);
        setPagination(result.pagination);
        setFilterOptions(
          result.filterOptions ?? { certifications: [], shippingTerms: [] },
        );
        setDatabaseLoading(false);
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
  }, [locale, queryState, retryVersion]);

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
          sameMarketplaceQuery(current, nextQueryState)
            ? current
            : nextQueryState,
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
  const activeFilters = marketplaceActiveFilters(queryState, locale, t);
  const advancedFilterCount = activeFilters.filter(
    (filter) => filter.key !== "q" && filter.key !== "category",
  ).length;

  const clearFilters = useCallback(() => {
    updateQuery({
      q: "",
      category: "all",
      price: "all",
      moq: "all",
      certification: "all",
      shipping: "all",
    });
  }, [updateQuery]);

  const retry = useCallback(() => {
    requestCoordinatorRef.current = new MarketplaceRequestCoordinator();
    setRetryVersion((value) => value + 1);
  }, []);

  const filterPanel = (
    <MarketplaceFilterPanel
      query={queryState}
      certifications={certifications}
      shippingTerms={shippingTerms}
      locale={locale}
      updateQuery={updateQuery}
      t={t}
    />
  );

  return (
    <div className="grid min-w-0 gap-7">
      <div className="grid gap-5 border-y border-zinc-200 py-5">
        <label className="relative block">
          <span className="sr-only">{t("marketplace.searchProducts")}</span>
          <Search
            className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-zinc-400"
            aria-hidden="true"
          />
          <input
            data-testid="marketplace-search-input"
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={t("marketplace.searchPlaceholder")}
            className="h-14 w-full rounded-md border border-zinc-300 bg-white pl-12 pr-4 text-base text-zinc-950 outline-none placeholder:text-zinc-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
          />
        </label>

        <div className="-mx-4 min-w-0 max-w-full overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div
            className="flex min-w-max gap-1.5 pb-1"
            role="group"
            aria-label={t("marketplace.category")}
          >
            {[
              { label: t("marketplace.allCategories"), value: "all" },
              ...marketplaceCategories.map((item) => ({
                label: t(marketplaceCategoryMessageKey(item)),
                value: item,
              })),
            ].map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => updateQuery({ category: item.value })}
                className={`min-h-10 rounded-full border px-4 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/35 ${
                  queryState.category === item.value
                    ? "border-zinc-950 bg-zinc-950 text-white"
                    : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400 hover:text-zinc-950"
                }`}
                aria-pressed={queryState.category === item.value}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div ref={gridTopRef} className="scroll-mt-24" />
      <div className="grid min-w-0 gap-7 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start">
        <aside className="hidden border-r border-zinc-200 pr-6 lg:block">
          <div className="sticky top-24">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-950">
                <SlidersHorizontal className="size-4" aria-hidden="true" />
                {t("marketplace.filters")}
              </h2>
              {advancedFilterCount ? (
                <span className="text-xs font-semibold text-emerald-700">
                  {advancedFilterCount}
                </span>
              ) : null}
            </div>
            {filterPanel}
            {activeFilters.length ? (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-6 min-h-10 text-sm font-semibold text-emerald-800 hover:text-zinc-950"
              >
                {t("common.clearFilters")}
              </button>
            ) : null}
          </div>
        </aside>

        <section className="min-w-0" aria-labelledby="marketplace-results-heading">
          <h2 id="marketplace-results-heading" className="sr-only">
            {t("marketplace.results")}
          </h2>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-4">
            <p className="text-sm font-medium text-zinc-700">
              <MarketplaceResultsSummary
                locale={locale}
                state={resultState}
                total={pagination.total}
                productsFoundLabel={t("marketplace.productsFound")}
              />
            </p>
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className="inline-flex min-h-10 items-center gap-2 rounded-md border border-zinc-300 px-3.5 text-sm font-semibold text-zinc-800 lg:hidden"
              aria-expanded={filtersOpen}
              aria-controls="marketplace-filter-dialog"
            >
              <Filter className="size-4" aria-hidden="true" />
              {t("marketplace.filters")}
              {advancedFilterCount ? (
                <span className="inline-flex size-5 items-center justify-center rounded-full bg-emerald-700 text-[11px] text-white">
                  {advancedFilterCount}
                </span>
              ) : null}
            </button>
          </div>

          {activeFilters.length ? (
            <div className="mb-6 flex flex-wrap items-center gap-2" aria-label={t("marketplace.activeFilters")}>
              {activeFilters.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() =>
                    updateQuery({
                      [filter.key]:
                        filter.key === "q" ? "" : "all",
                    } as MarketplaceQueryUpdates)
                  }
                  className="inline-flex min-h-9 items-center gap-2 rounded-full bg-emerald-50 px-3 text-xs font-semibold text-emerald-900 hover:bg-emerald-100"
                  aria-label={`${t("marketplace.removeFilter")}: ${filter.label}`}
                >
                  {filter.label}
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              ))}
              <button
                type="button"
                onClick={clearFilters}
                className="min-h-9 px-2 text-xs font-semibold text-zinc-600 hover:text-zinc-950"
              >
                {t("common.clearFilters")}
              </button>
            </div>
          ) : null}

          <MarketplaceResultsPresentation
            state={resultState}
            products={databaseProducts}
            renderLoading={() => (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 9 }, (_, index) => (
                  <ProductCardSkeleton key={index} />
                ))}
              </div>
            )}
            renderProducts={(products) => (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
            renderEmpty={() => (
              <MarketplaceEmpty
                t={t}
                onClear={clearFilters}
                hasFilters={activeFilters.length > 0}
              />
            )}
            renderError={() => (
              <MarketplaceUnavailable locale={locale} onRetry={retry} t={t} />
            )}
          />
        </section>
      </div>

      {filtersOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-zinc-950/40"
            onClick={closeFilters}
            aria-label={t("common.close")}
          />
          <div
            ref={filterDialogRef}
            id="marketplace-filter-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="marketplace-filter-title"
            tabIndex={-1}
            className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-2xl bg-white p-5 outline-none"
          >
            <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
              <h2 id="marketplace-filter-title" className="text-lg font-semibold text-zinc-950">
                {t("marketplace.filters")}
              </h2>
              <button
                type="button"
                onClick={closeFilters}
                className="inline-flex size-10 items-center justify-center rounded-md hover:bg-zinc-100"
                aria-label={t("common.close")}
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <div className="py-5">{filterPanel}</div>
            <div className="sticky bottom-0 grid grid-cols-2 gap-2 border-t border-zinc-200 bg-white py-4">
              <button
                type="button"
                onClick={clearFilters}
                className="min-h-11 rounded-md border border-zinc-300 text-sm font-semibold text-zinc-800"
              >
                {t("common.clearFilters")}
              </button>
              <button
                type="button"
                onClick={closeFilters}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 text-sm font-semibold text-white"
              >
                <Check className="size-4" aria-hidden="true" />
                {t("marketplace.applyFilters")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MarketplaceFilterPanel({
  query,
  certifications,
  shippingTerms,
  locale,
  updateQuery,
  t,
}: {
  query: MarketplaceQueryState;
  certifications: string[];
  shippingTerms: string[];
  locale: "en" | "ko";
  updateQuery: (updates: MarketplaceQueryUpdates) => void;
  t: (key: string) => string;
}) {
  return (
    <div className="grid gap-5">
      <SelectField
        label={t("marketplace.price")}
        value={query.price}
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
        value={query.moq}
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
        value={query.certification}
        onChange={(value) => updateQuery({ certification: value })}
        options={[
          { label: t("marketplace.anyCertification"), value: "all" },
          ...certifications.map((item) => ({
            label: complianceClaimLabel(item, locale),
            value: item,
          })),
        ]}
      />
      <SelectField
        label={t("marketplace.shipping")}
        value={query.shipping}
        onChange={(value) => updateQuery({ shipping: value })}
        options={[
          { label: t("marketplace.anyTerm"), value: "all" },
          ...shippingTerms.map((item) => ({
            label: incotermLabel(item, locale),
            value: item,
          })),
        ]}
      />
    </div>
  );
}

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
    <label className="grid gap-2 text-sm">
      <span className="font-semibold text-zinc-950">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-md border border-zinc-300 bg-white px-3 text-zinc-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
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

function marketplaceActiveFilters(
  query: MarketplaceQueryState,
  locale: "en" | "ko",
  t: (key: string) => string,
) {
  const labels: Array<{
    key: keyof MarketplaceQueryUpdates;
    value: string;
    label: string;
  }> = [
    { key: "q", value: query.q, label: query.q },
    {
      key: "category",
      value: query.category,
      label:
        query.category === "all"
          ? query.category
          : t(
              marketplaceCategoryMessageKey(
                query.category as (typeof marketplaceCategories)[number],
              ),
            ),
    },
    {
      key: "price",
      value: query.price,
      label:
        query.price === "under-3"
          ? t("marketplace.under3")
          : query.price === "3-8"
            ? t("marketplace.threeToEight")
            : t("marketplace.eightPlus"),
    },
    {
      key: "moq",
      value: query.moq,
      label:
        query.moq === "1000"
          ? t("marketplace.moq1000")
          : query.moq === "5000"
            ? t("marketplace.moq5000")
            : t("marketplace.moq10000"),
    },
    {
      key: "certification",
      value: query.certification,
      label: complianceClaimLabel(query.certification, locale),
    },
    {
      key: "shipping",
      value: query.shipping,
      label: incotermLabel(query.shipping, locale),
    },
  ];
  return labels.filter(
    (filter) => filter.value && filter.value !== "all",
  );
}

function MarketplaceEmpty({
  t,
  onClear,
  hasFilters,
}: {
  t: (key: string) => string;
  onClear: () => void;
  hasFilters: boolean;
}) {
  return (
    <div className="border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center">
      <h2 className="text-lg font-semibold text-zinc-950">
        {t("marketplace.emptyTitle")}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-600">
        {t("marketplace.emptyText")}
      </p>
      {hasFilters ? (
        <button
          type="button"
          onClick={onClear}
          className="mt-5 min-h-11 rounded-md border border-zinc-950 px-4 text-sm font-semibold text-zinc-950 hover:bg-zinc-950 hover:text-white"
        >
          {t("common.clearFilters")}
        </button>
      ) : null}
    </div>
  );
}

function MarketplaceUnavailable({
  locale,
  onRetry,
  t,
}: {
  locale: "en" | "ko";
  onRetry: () => void;
  t: (key: string) => string;
}) {
  const message =
    locale === "ko"
      ? "현재 상품 목록을 불러올 수 없습니다. 잠시 후 다시 시도해 주세요."
      : "Product listings are temporarily unavailable. Please try again shortly.";

  return (
    <div className="border border-amber-200 bg-amber-50 p-5" role="alert">
      <p className="text-sm text-amber-900">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 min-h-10 rounded-md border border-amber-300 bg-white px-4 text-sm font-semibold text-amber-950 hover:bg-amber-100"
      >
        {t("marketplace.retry")}
      </button>
    </div>
  );
}
