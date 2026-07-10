"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useI18n } from "@/components/i18n-provider";
import { PaginationControls } from "@/components/pagination-controls";
import { ProductCard, ProductCardSkeleton } from "@/components/product-card";
import { marketplaceCategories } from "@/lib/marketplace";
import { databaseProductToCard } from "@/lib/public-marketplace-presenters";
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

type PaginationState = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

type ProductFilterOptions = {
  certifications: string[];
  shippingTerms: string[];
};

const DEFAULT_PAGINATION: PaginationState = {
  page: 1,
  pageSize: 24,
  total: 0,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
};

export function MarketplaceClient() {
  return (
    <Suspense
      fallback={
        <div className="grid min-w-0 gap-8">
          <div className="bm-premium-card min-h-40 rounded-lg border p-4 theme-surface-elevated" />
          <div className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }, (_, index) => (
              <ProductCardSkeleton key={index} />
            ))}
          </div>
        </div>
      }
    >
      <MarketplaceClientContent />
    </Suspense>
  );
}

function MarketplaceClientContent() {
  const { locale, t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const gridTopRef = useRef<HTMLDivElement>(null);
  const [databaseProducts, setDatabaseProducts] = useState<Product[]>([]);
  const [pagination, setPagination] =
    useState<PaginationState>(DEFAULT_PAGINATION);
  const [filterOptions, setFilterOptions] = useState<ProductFilterOptions>({
    certifications: [],
    shippingTerms: [],
  });
  const [databaseLoading, setDatabaseLoading] = useState(true);
  const search = searchParams.get("q") ?? "";
  const category = searchParams.get("category") ?? "all";
  const price = searchParams.get("price") ?? "all";
  const moq = searchParams.get("moq") ?? "all";
  const certification = searchParams.get("certification") ?? "all";
  const shippingTerm = searchParams.get("shipping") ?? "all";
  const page = parsePositiveInteger(searchParams.get("page"));

  useEffect(() => {
    const requestParams = new URLSearchParams({
      resource: "products",
      page: String(page),
      pageSize: "24",
    });
    setQueryParam(requestParams, "q", search);
    setQueryParam(requestParams, "category", category);
    setQueryParam(requestParams, "price", price);
    setQueryParam(requestParams, "moq", moq);
    setQueryParam(requestParams, "certification", certification);
    setQueryParam(requestParams, "shipping", shippingTerm);

    let active = true;
    void fetch(`/api/public/marketplace?${requestParams.toString()}`)
      .then((response) =>
        response.ok
          ? response.json()
          : { products: [], pagination: DEFAULT_PAGINATION },
      )
      .then(
        (result: {
          products?: Array<Record<string, unknown>>;
          pagination?: PaginationState;
          filterOptions?: ProductFilterOptions;
        }) => {
          if (!active) return;
          setDatabaseProducts(
            (result.products ?? []).map((product) =>
              databaseProductToCard(product, locale),
            ),
          );
          setPagination(result.pagination ?? DEFAULT_PAGINATION);
          setFilterOptions(
            result.filterOptions ?? { certifications: [], shippingTerms: [] },
          );
          setDatabaseLoading(false);
        },
      )
      .catch(() => {
        if (!active) return;
        setDatabaseProducts([]);
        setPagination(DEFAULT_PAGINATION);
        setDatabaseLoading(false);
      });

    return () => {
      active = false;
    };
  }, [locale, page, search, category, price, moq, certification, shippingTerm]);

  const certifications = useMemo(
    () => filterOptions.certifications,
    [filterOptions.certifications],
  );
  const shippingTerms = useMemo(
    () => filterOptions.shippingTerms,
    [filterOptions.shippingTerms],
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
    <div className="grid min-w-0 gap-8">
      <div className="bm-premium-card grid min-w-0 gap-5 rounded-lg border p-4 backdrop-blur theme-surface-elevated">
        <label className="relative block">
          <span className="sr-only">{t("marketplace.searchProducts")}</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 theme-muted" aria-hidden="true" />
          <input
            value={search}
            onChange={(event) => updateFilters({ q: event.target.value })}
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
                onClick={() => updateFilters({ category: item.value })}
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
              onChange={(value) => updateFilters({ price: value })}
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
              onChange={(value) => updateFilters({ moq: value })}
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
              onChange={(value) => updateFilters({ certification: value })}
              options={[
                { label: t("marketplace.anyCertification"), value: "all" },
                ...certifications.map((item) => ({ label: item, value: item })),
              ]}
            />
            <SelectField
              label={t("marketplace.shipping")}
              value={shippingTerm}
              onChange={(value) => updateFilters({ shipping: value })}
              options={[
                { label: t("marketplace.anyTerm"), value: "all" },
                ...shippingTerms.map((item) => ({ label: item, value: item })),
              ]}
            />
          </div>
        </details>

        <div className="relative z-10 flex min-h-11 items-center justify-between border-t pt-3 text-sm theme-border theme-muted">
          <span>{pagination.total} {t("marketplace.productsFound")}</span>
          <button
            type="button"
            onClick={() => {
              updateFilters({
                q: "",
                category: "all",
                price: "all",
                moq: "all",
                certification: "all",
                shipping: "all",
              });
            }}
            className="min-h-11 px-2 font-medium text-[var(--accent-foreground)] hover:text-[var(--foreground)]"
          >
            {t("common.clearFilters")}
          </button>
        </div>
      </div>

      <div ref={gridTopRef} className="scroll-mt-24" />
      {databaseLoading && !databaseProducts.length ? (
        <div className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <ProductCardSkeleton key={index} />
          ))}
        </div>
      ) : databaseProducts.length ? (
        <>
          <div className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            {databaseProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
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
            {t("marketplace.emptyTitle")}
          </h2>
          <p className="mt-2 text-sm theme-muted">
            {t("marketplace.emptyText")}
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
