"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useI18n } from "@/components/i18n-provider";
import { ProductCard, ProductCardSkeleton } from "@/components/product-card";
import { SectionHeader } from "@/components/section-header";
import { SellerCard } from "@/components/seller-card";
import { withLocale } from "@/lib/i18n";
import {
  databaseCompanyToSeller,
  databaseProductToCard,
} from "@/lib/public-marketplace-presenters";
import type { Product, Seller } from "@/lib/types";

export function HomePublicPreviews() {
  const { locale, t } = useI18n();
  const [products, setProducts] = useState<Product[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [retryVersion, setRetryVersion] = useState(0);

  useEffect(() => {
    void Promise.all([
      fetch("/api/public/marketplace?resource=products&pageSize=4"),
      fetch("/api/public/marketplace?resource=companies&pageSize=3"),
    ])
      .then(async ([productResponse, sellerResponse]) => {
        if (!productResponse.ok || !sellerResponse.ok) {
          throw new Error("Home marketplace preview request failed");
        }
        const [productResult, sellerResult] = await Promise.all([
          productResponse.json(),
          sellerResponse.json(),
        ]);
        return {
          products: productResult.products,
          companies: sellerResult.companies,
        } as {
          products?: Array<Record<string, unknown>>;
          companies?: Array<Record<string, unknown>>;
        };
      })
      .then((result) => {
        setProducts(
          (result.products ?? [])
            .map((product) => databaseProductToCard(product, locale))
            .slice(0, 4),
        );
        setSellers(
          (result.companies ?? [])
            .filter((company) => company.companyRole === "seller")
            .map((company) => databaseCompanyToSeller(company, locale))
            .slice(0, 3),
        );
        setIsLoading(false);
      })
      .catch(() => {
        setProducts([]);
        setSellers([]);
        setIsLoading(false);
        setIsError(true);
      });
  }, [locale, retryVersion]);

  const retry = () => {
    setIsLoading(true);
    setIsError(false);
    setRetryVersion((value) => value + 1);
  };

  return (
    <>
      <section className="mx-auto grid max-w-[1440px] gap-8 px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <SectionHeader
          label={t("home.featuredProducts")}
          title={t("home.catalogPreview")}
          description={t("home.catalogDescription")}
          action={
            <Link href={withLocale("/marketplace", locale)} className="text-sm font-semibold text-emerald-800">
              {t("home.viewAllProducts")}
            </Link>
          }
        />
        {isError ? (
          <PreviewError
            message={t("home.previewError")}
            retryLabel={t("marketplace.retry")}
            onRetry={retry}
          />
        ) : isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <ProductCardSkeleton key={index} />
            ))}
          </div>
        ) : products.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <EmptyState title={t("marketplace.noProductsListed")} />
        )}
      </section>

      <section className="border-t border-zinc-200 bg-zinc-50">
        <div className="mx-auto grid max-w-[1440px] gap-8 px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <SectionHeader
            label={t("home.featuredSellers")}
            title={t("home.sellerPreview")}
            description={t("home.sellerDescription")}
            action={
              <Link href={withLocale("/sellers", locale)} className="text-sm font-semibold text-emerald-800">
                {t("home.viewAllSellers")}
              </Link>
            }
          />
          {isError ? (
            <PreviewError
              message={t("home.previewError")}
              retryLabel={t("marketplace.retry")}
              onRetry={retry}
            />
          ) : isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }, (_, index) => (
                <div
                  key={index}
                  className="h-80 animate-pulse border border-zinc-200 bg-white"
                  aria-hidden="true"
                />
              ))}
            </div>
          ) : sellers.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {sellers.map((seller) => (
                <SellerCard key={seller.id} seller={seller} />
              ))}
            </div>
          ) : (
            <EmptyState title={t("sellers.noCompaniesListed")} />
          )}
        </div>
      </section>
    </>
  );
}

function EmptyState({ title }: { title: string }) {
  return (
    <div className="border border-dashed border-zinc-300 bg-white p-10 text-center">
      <p className="text-lg font-semibold text-zinc-950">{title}</p>
    </div>
  );
}

function PreviewError({
  message,
  retryLabel,
  onRetry,
}: {
  message: string;
  retryLabel: string;
  onRetry: () => void;
}) {
  return (
    <div className="border border-amber-200 bg-amber-50 p-5" role="alert">
      <p className="text-sm text-amber-900">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 min-h-10 rounded-md border border-amber-300 bg-white px-4 text-sm font-semibold text-amber-950"
      >
        {retryLabel}
      </button>
    </div>
  );
}
