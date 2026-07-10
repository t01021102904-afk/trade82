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
    title: "Product buyers are seeing now",
    subtitle: "Promoted products from active Trade82 sellers.",
    viewAll: "Explore marketplace",
  },
  ko: {
    label: "인기 상품",
    title: "바이어가 지금 보고 있는 상품",
    subtitle: "Trade82 셀러가 노출 중인 상품입니다.",
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
            <p className="mt-2 text-sm theme-muted">{text.subtitle}</p>
          </div>
          <Link
            href={withLocale("/marketplace", locale)}
            className="text-sm font-semibold theme-muted hover:text-[var(--accent-foreground)]"
          >
            {text.viewAll}
          </Link>
        </div>

        <div className="product-exposure-marquee-mask">
          {isLoading ? (
            <div className="flex gap-4 overflow-hidden">
              {Array.from({ length: 6 }, (_, index) => (
                <div
                  key={index}
                  className="w-[210px] shrink-0 sm:w-[230px] lg:w-[240px]"
                >
                  <ProductCardSkeleton />
                </div>
              ))}
            </div>
          ) : (
            <div className="product-exposure-marquee-track flex w-max">
              <ProductMarqueeGroup products={products} />
              <div className="product-exposure-marquee-copy flex" aria-hidden="true">
                <ProductMarqueeGroup products={products} keyPrefix="copy" />
              </div>
            </div>
          )}
        </div>
        {!isLoading ? (
          <p className="sr-only" aria-live="polite">
            {products.length} {text.label}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function ProductMarqueeGroup({
  products,
  keyPrefix = "primary",
}: {
  products: Product[];
  keyPrefix?: string;
}) {
  return (
    <div className="flex gap-4 pr-4">
      {products.map((product) => (
        <div
          key={`${keyPrefix}-${product.id}`}
          className="w-[210px] shrink-0 sm:w-[230px] lg:w-[240px]"
        >
          <ProductCard product={product} />
        </div>
      ))}
    </div>
  );
}
