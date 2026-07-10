"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useI18n } from "@/components/i18n-provider";
import { PaginationControls } from "@/components/pagination-controls";
import { SellerCard } from "@/components/seller-card";
import { marketplaceCategories } from "@/lib/marketplace";
import { databaseCompanyToSeller } from "@/lib/public-marketplace-presenters";
import type { Seller } from "@/lib/types";

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
      <span className="font-medium text-zinc-700">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-zinc-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
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
    <Suspense
      fallback={
        <div className="grid gap-8">
          <div className="bm-premium-card min-h-32 rounded-lg border border-zinc-200 bg-white/90 p-4 shadow-sm shadow-zinc-100" />
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <div
                key={index}
                className="h-80 animate-pulse rounded-lg border border-zinc-200 bg-white shadow-sm shadow-zinc-100"
                aria-hidden="true"
              />
            ))}
          </div>
        </div>
      }
    >
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
  const [filterOptions, setFilterOptions] = useState<{ states: string[] }>({
    states: [],
  });
  const [databaseLoading, setDatabaseLoading] = useState(true);
  const search = searchParams.get("q") ?? "";
  const category = searchParams.get("category") ?? "all";
  const state = searchParams.get("state") ?? "all";
  const verified = searchParams.get("verified") ?? "all";
  const exportExperience = searchParams.get("exportExperience") ?? "all";
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
    setQueryParam(requestParams, "verified", verified);
    setQueryParam(requestParams, "exportExperience", exportExperience);

    let active = true;
    void fetch(`/api/public/marketplace?${requestParams.toString()}`)
      .then((response) =>
        response.ok
          ? response.json()
          : { companies: [], pagination: DEFAULT_PAGINATION },
      )
      .then(
        (result: {
          companies?: Array<Record<string, unknown>>;
          pagination?: PaginationState;
          filterOptions?: { states?: string[] };
        }) => {
          if (!active) return;
          setDatabaseSellers(
            (result.companies ?? []).map((company) =>
              databaseCompanyToSeller(company, locale),
            ),
          );
          setPagination(result.pagination ?? DEFAULT_PAGINATION);
          setFilterOptions({ states: result.filterOptions?.states ?? [] });
          setDatabaseLoading(false);
        },
      )
      .catch(() => {
        if (!active) return;
        setDatabaseSellers([]);
        setPagination(DEFAULT_PAGINATION);
        setDatabaseLoading(false);
      });

    return () => {
      active = false;
    };
  }, [locale, page, search, category, state, verified, exportExperience]);

  const states = useMemo(
    () => filterOptions.states,
    [filterOptions.states],
  );

  const updateFilters = (
    updates: Record<string, string>,
    options: { scroll?: boolean; replace?: boolean } = { replace: true },
  ) => {
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
    <div className="grid gap-8">
      <div className="bm-premium-card rounded-lg border border-zinc-200 bg-white/90 p-4 shadow-sm shadow-zinc-100 backdrop-blur">
        <div className="grid gap-4 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-zinc-700">{t("sellers.search")}</span>
            <input
              value={search}
              onChange={(event) => updateFilters({ q: event.target.value })}
              placeholder={t("sellers.searchPlaceholder")}
              className="h-10 rounded-md border border-zinc-200 px-3 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <SelectField
            label={t("marketplace.category")}
            value={category}
            onChange={(value) => updateFilters({ category: value })}
            options={[
              { label: t("marketplace.allCategories"), value: "all" },
              ...marketplaceCategories.map((item) => ({ label: item, value: item })),
            ]}
          />
          <SelectField
            label={t("sellers.state")}
            value={state}
            onChange={(value) => updateFilters({ state: value })}
            options={[
              { label: t("sellers.allStates"), value: "all" },
              ...states.map((item) => ({ label: item, value: item })),
            ]}
          />
          <SelectField
            label={t("sellers.verified")}
            value={verified}
            onChange={(value) => updateFilters({ verified: value })}
            options={[
              { label: t("sellers.anyStatus"), value: "all" },
              { label: t("sellers.verifiedOnly"), value: "verified" },
              { label: t("sellers.inReview"), value: "reviewing" },
            ]}
          />
          <SelectField
            label={t("sellers.exportExperience")}
            value={exportExperience}
            onChange={(value) => updateFilters({ exportExperience: value })}
            options={[
              { label: t("sellers.anyExperience"), value: "all" },
              { label: t("sellers.exportsToKorea"), value: "korea" },
              { label: t("sellers.markets3"), value: "multi" },
              { label: t("common.fastResponse"), value: "fast" },
            ]}
          />
        </div>
        <div className="relative z-10 mt-4 flex items-center justify-between border-t border-zinc-100 pt-4 text-sm text-zinc-600">
          <span>{pagination.total} {t("sellers.sellerFound")}</span>
          <button
            type="button"
            onClick={() => {
              updateFilters({
                q: "",
                category: "all",
                state: "all",
                verified: "all",
                exportExperience: "all",
              });
            }}
            className="font-medium text-blue-700 hover:text-blue-800"
          >
            {t("common.clearFilters")}
          </button>
        </div>
      </div>

      <div ref={gridTopRef} className="scroll-mt-24" />
      {databaseLoading && !databaseSellers.length ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div
              key={index}
              className="h-80 animate-pulse rounded-lg border border-zinc-200 bg-white shadow-sm shadow-zinc-100"
              aria-hidden="true"
            />
          ))}
        </div>
      ) : databaseSellers.length ? (
        <>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
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
        <div className="rounded-lg border border-dashed p-5 text-center theme-surface">
          <h2 className="text-base font-semibold theme-foreground">
            {t("sellers.emptyTitle")}
          </h2>
          <p className="mt-2 text-sm theme-muted">
            {t("sellers.emptyText")}
          </p>
        </div>
      )}
    </div>
  );
}

function parsePositiveInteger(value: string | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

function setQueryParam(params: URLSearchParams, key: string, value: string) {
  if (!value || value === "all" || (key === "q" && !value.trim())) return;
  params.set(key, value);
}
