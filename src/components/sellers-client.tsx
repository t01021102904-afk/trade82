"use client";

import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

import { useI18n } from "@/components/i18n-provider";
import { PaginationControls } from "@/components/pagination-controls";
import { SellerCard } from "@/components/seller-card";
import { marketplaceCategoryMessageKey } from "@/lib/home-product-categories";
import { countryLabel } from "@/lib/company-select-options";
import { marketplaceCategories } from "@/lib/marketplace";
import { databaseCompanyToSeller } from "@/lib/public-marketplace-presenters";
import type { Seller } from "@/lib/types";

type PaginationState = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

const DEFAULT_PAGINATION: PaginationState = {
  page: 1,
  pageSize: 24,
  total: 0,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
};

export function SellersClient() {
  return (
    <Suspense fallback={<SellersSkeleton />}>
      <SellersClientContent />
    </Suspense>
  );
}

function SellersClientContent() {
  const { locale, t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const gridTopRef = useRef<HTMLDivElement>(null);
  const [databaseSellers, setDatabaseSellers] = useState<Seller[]>([]);
  const [pagination, setPagination] =
    useState<PaginationState>(DEFAULT_PAGINATION);
  const [filterOptions, setFilterOptions] = useState<{
    states: string[];
    exportCountries: string[];
  }>({
    states: [],
    exportCountries: [],
  });
  const [databaseLoading, setDatabaseLoading] = useState(true);
  const [requestError, setRequestError] = useState(false);
  const [retryVersion, setRetryVersion] = useState(0);
  const search = searchParams.get("q") ?? "";
  const category = searchParams.get("category") ?? "all";
  const state = searchParams.get("state") ?? "all";
  const exportExperience = searchParams.get("exportExperience") ?? "all";
  const exportCountry = searchParams.get("exportCountry") ?? "all";
  const page = parsePositiveInteger(searchParams.get("page"));

  useEffect(() => {
    const requestParams = new URLSearchParams({
      resource: "companies",
      page: String(page),
      pageSize: "24",
    });
    setQueryParam(requestParams, "q", search);
    setQueryParam(requestParams, "category", category);
    setQueryParam(requestParams, "state", state);
    setQueryParam(requestParams, "exportExperience", exportExperience);
    setQueryParam(requestParams, "exportCountry", exportCountry);

    const controller = new AbortController();
    void fetch(`/api/public/marketplace?${requestParams.toString()}`, {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Seller directory request failed: ${response.status}`);
        }
        return response.json();
      })
      .then(
        (result: {
          companies?: Array<Record<string, unknown>>;
          pagination?: PaginationState;
          filterOptions?: { states?: string[]; exportCountries?: string[] };
        }) => {
          if (controller.signal.aborted) return;
          setDatabaseSellers(
            (result.companies ?? []).map((company) =>
              databaseCompanyToSeller(company, locale),
            ),
          );
          setPagination(result.pagination ?? DEFAULT_PAGINATION);
          setFilterOptions({
            states: result.filterOptions?.states ?? [],
            exportCountries: result.filterOptions?.exportCountries ?? [],
          });
          setDatabaseLoading(false);
        },
      )
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.error("Seller directory request failed", error);
        setRequestError(true);
        setDatabaseLoading(false);
      });

    return () => controller.abort();
  }, [category, exportCountry, exportExperience, locale, page, retryVersion, search, state]);

  const states = filterOptions.states;
  const exportCountries = filterOptions.exportCountries;
  const activeFilters = [
    search
      ? { key: "q", label: search }
      : null,
    category !== "all"
      ? {
          key: "category",
          label: t(
            marketplaceCategoryMessageKey(
              category as (typeof marketplaceCategories)[number],
            ),
          ),
        }
      : null,
    state !== "all" ? { key: "state", label: state } : null,
    exportExperience !== "all"
      ? {
          key: "exportExperience",
          label:
            exportExperience === "multi"
              ? t("sellers.markets3")
              : t("sellers.exportsToKorea"),
        }
      : null,
    exportCountry !== "all"
      ? {
          key: "exportCountry",
          label: countryLabel(exportCountry, locale),
        }
      : null,
  ].filter((filter): filter is { key: string; label: string } => Boolean(filter));

  const updateFilters = (
    updates: Record<string, string>,
    options: { scroll?: boolean; replace?: boolean } = { replace: true },
  ) => {
    setDatabaseLoading(true);
    setRequestError(false);
    const nextParams = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (!value || value === "all" || (key === "q" && !value.trim())) {
        nextParams.delete(key);
      } else {
        nextParams.set(key, value);
      }
    });
    if (!("page" in updates)) nextParams.delete("page");
    const query = nextParams.toString();
    const nextUrl = query ? `${pathname}?${query}` : pathname;
    if (options.replace === false) {
      router.push(nextUrl, { scroll: false });
    } else {
      router.replace(nextUrl, { scroll: false });
    }
    if (options.scroll) {
      requestAnimationFrame(() => {
        gridTopRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }
  };

  return (
    <div className="grid min-w-0 gap-5">
      <div className="min-w-0 border-y border-zinc-200 py-4">
        <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-[1.4fr_repeat(4,minmax(0,1fr))]">
          <label className="relative grid min-w-0 gap-1.5 text-sm">
            <span className="font-semibold text-zinc-950">
              {t("sellers.search")}
            </span>
            <Search
              className="pointer-events-none absolute bottom-3 left-3.5 size-4 text-zinc-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => updateFilters({ q: event.target.value })}
              placeholder={t("sellers.searchPlaceholder")}
              className="h-10 min-w-0 rounded-md border border-zinc-300 pl-10 pr-3 outline-none focus:border-[#34B386] focus:ring-2 focus:ring-[#34B386]/20"
            />
          </label>
          <SelectField
            label={t("marketplace.category")}
            value={category}
            onChange={(value) =>
              updateFilters({ category: value }, { replace: false })
            }
            options={[
              { label: t("marketplace.allCategories"), value: "all" },
              ...marketplaceCategories.map((item) => ({
                label: t(marketplaceCategoryMessageKey(item)),
                value: item,
              })),
            ]}
          />
          <SelectField
            label={t("sellers.state")}
            value={state}
            onChange={(value) =>
              updateFilters({ state: value }, { replace: false })
            }
            options={[
              { label: t("sellers.allStates"), value: "all" },
              ...states.map((item) => ({ label: item, value: item })),
            ]}
          />
          <SelectField
            label={t("sellers.exportExperience")}
            value={exportExperience}
            onChange={(value) =>
              updateFilters({ exportExperience: value }, { replace: false })
            }
            options={[
              { label: t("sellers.anyExperience"), value: "all" },
              { label: t("sellers.exportsToKorea"), value: "korea" },
              { label: t("sellers.markets3"), value: "multi" },
            ]}
          />
          <SelectField
            label={t("sellers.exportCountry")}
            value={exportCountry}
            onChange={(value) =>
              updateFilters({ exportCountry: value }, { replace: false })
            }
            options={[
              { label: t("sellers.allExportCountries"), value: "all" },
              ...exportCountries.map((item) => ({
                label: countryLabel(item, locale),
                value: item,
              })),
            ]}
          />
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-zinc-200 pt-3 text-sm text-zinc-600">
          <span>
            {pagination.total} {t("sellers.sellerFound")}
          </span>
          <button
            type="button"
            onClick={() =>
              updateFilters({
                q: "",
                category: "all",
                state: "all",
                exportExperience: "all",
                exportCountry: "all",
              }, { replace: false })
            }
            className="min-h-9 font-semibold text-zinc-700 hover:text-zinc-950"
          >
            {t("common.clearFilters")}
          </button>
        </div>
        {activeFilters.length ? (
          <div className="mt-3 flex min-w-0 flex-wrap gap-2" aria-label={t("marketplace.activeFilters")}>
            {activeFilters.map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() =>
                  updateFilters(
                    { [filter.key]: filter.key === "q" ? "" : "all" },
                    { replace: false },
                  )
                }
                className="inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-full border border-[#34B386]/40 bg-[#34B386]/10 px-3 text-xs font-semibold text-zinc-800"
                aria-label={`${t("marketplace.removeFilter")}: ${filter.label}`}
              >
                <span className="truncate">{filter.label}</span>
                <X className="size-3.5 shrink-0 text-zinc-700" aria-hidden="true" />
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div ref={gridTopRef} className="scroll-mt-24" />
      {requestError ? (
        <div className="border border-amber-200 bg-amber-50 p-5" role="alert">
          <p className="text-sm text-amber-900">{t("sellers.errorText")}</p>
          <button
            type="button"
            onClick={() => {
              setDatabaseLoading(true);
              setRequestError(false);
              setRetryVersion((value) => value + 1);
            }}
            className="mt-3 min-h-10 rounded-md border border-amber-300 bg-white px-4 text-sm font-semibold text-amber-950"
          >
            {t("marketplace.retry")}
          </button>
        </div>
      ) : databaseLoading && !databaseSellers.length ? (
        <SellersSkeleton cardsOnly />
      ) : databaseSellers.length ? (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {databaseSellers.map((seller) => (
              <SellerCard key={seller.id} seller={seller} />
            ))}
          </div>
          <PaginationControls
            page={pagination.page}
            totalPages={pagination.totalPages}
            locale={locale}
            onPageChange={(nextPage) =>
              updateFilters(
                { page: nextPage === 1 ? "" : String(nextPage) },
                { replace: false, scroll: true },
              )
            }
          />
        </>
      ) : (
        <div className="border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center">
          <h2 className="text-base font-semibold text-zinc-950">
            {t("sellers.emptyTitle")}
          </h2>
          <p className="mt-2 text-sm text-zinc-600">
            {t("sellers.emptyText")}
          </p>
        </div>
      )}
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
    <label className="grid min-w-0 gap-1.5 text-sm">
      <span className="font-semibold text-zinc-950">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full min-w-0 max-w-full rounded-md border border-zinc-300 bg-white px-3 text-zinc-800 outline-none focus:border-[#34B386] focus:ring-2 focus:ring-[#34B386]/20"
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

function SellersSkeleton({ cardsOnly = false }: { cardsOnly?: boolean }) {
  return (
    <div className="grid gap-7">
      {!cardsOnly ? (
        <div className="min-h-32 animate-pulse border-y border-zinc-200 bg-white" />
      ) : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            className="h-80 animate-pulse border border-zinc-200 bg-white"
            aria-hidden="true"
          />
        ))}
      </div>
    </div>
  );
}

function parsePositiveInteger(value: string | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

function setQueryParam(
  params: URLSearchParams,
  key: string,
  value: string,
) {
  if (!value || value === "all" || (key === "q" && !value.trim())) return;
  params.set(key, value);
}
