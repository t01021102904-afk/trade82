"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ProductCard, ProductCardSkeleton } from "@/components/product-card";
import { SectionHeader } from "@/components/section-header";
import { SellerCard } from "@/components/seller-card";
import { useI18n } from "@/components/i18n-provider";
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

  useEffect(() => {
    void fetch("/api/public/marketplace")
      .then((response) => (response.ok ? response.json() : { products: [], companies: [] }))
      .then((result: { products?: Array<Record<string, unknown>>; companies?: Array<Record<string, unknown>> }) => {
        setProducts((result.products ?? []).map(databaseProductToCard).slice(0, 3));
        setSellers(
          (result.companies ?? [])
            .filter((company) => company.companyRole === "seller")
            .map(databaseCompanyToSeller)
            .slice(0, 3),
        );
        setIsLoading(false);
      })
      .catch(() => {
        setProducts([]);
        setSellers([]);
        setIsLoading(false);
      });
  }, []);

  return (
    <>
      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 lg:px-8">
        <SectionHeader
          label={t("home.featuredProducts")}
          title={t("home.catalogPreview")}
          description={t("home.catalogDescription")}
          action={
            <Link href={withLocale("/marketplace", locale)} className="text-sm font-semibold text-blue-700">
              {t("home.viewAllProducts")}
            </Link>
          }
        />
        {isLoading ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
              <ProductCardSkeleton key={index} />
            ))}
          </div>
        ) : products.length ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <EmptyState title={t("marketplace.noProductsListed")} />
        )}
      </section>

      <section className="bg-zinc-50">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 lg:px-8">
          <SectionHeader
            label={t("home.featuredSellers")}
            title={t("home.sellerPreview")}
            description={t("home.sellerDescription")}
            action={
              <Link href={withLocale("/sellers", locale)} className="text-sm font-semibold text-blue-700">
                {t("home.viewAllSellers")}
              </Link>
            }
          />
          {isLoading ? (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }, (_, index) => (
                <div
                  key={index}
                  className="h-80 animate-pulse rounded-lg border border-zinc-200 bg-white shadow-sm shadow-zinc-100"
                  aria-hidden="true"
                />
              ))}
            </div>
          ) : sellers.length ? (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
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
    <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-10 text-center shadow-sm shadow-zinc-100">
      <p className="text-lg font-semibold text-zinc-950">{title}</p>
    </div>
  );
}
