"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ProductCard, ProductCardSkeleton } from "@/components/product-card";
import { useI18n } from "@/components/i18n-provider";
import { databaseProductToCard } from "@/lib/public-marketplace-presenters";
import { withLocale } from "@/lib/i18n";
import type { Product } from "@/lib/types";

const copy = {
  en: {
    label: "Trending products",
    title: "Products buyers are seeing now",
    viewAll: "Explore marketplace",
  },
  ko: {
    label: "인기 상품",
    title: "지금 바이어에게 노출 중인 상품",
    viewAll: "마켓플레이스 보기",
  },
};

export function HomeMarketingExposureStrip() {
  const { locale } = useI18n();
  const text = copy[locale];
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void fetch("/api/public/marketing-exposures", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : { products: [] }))
      .then((result: { products?: Array<Record<string, unknown>> }) => {
        if (!active) return;
        setProducts(
          (result.products ?? []).map((product) =>
            databaseProductToCard(product, locale),
          ),
        );
        setIsLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setProducts([]);
        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [locale]);

  if (!isLoading && !products.length) return null;

  return (
    <section className="border-t theme-border">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] theme-success-text">
              {text.label}
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-[-0.01em] theme-foreground sm:text-2xl">
              {text.title}
            </h2>
          </div>
          <Link
            href={withLocale("/marketplace", locale)}
            className="text-sm font-semibold theme-muted hover:text-[var(--accent-foreground)]"
          >
            {text.viewAll}
          </Link>
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <ProductCardSkeleton key={index} />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {products.slice(0, 8).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
