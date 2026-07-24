import { createElement, type ReactNode } from "react";

import type { Product } from "@/lib/types";
import type { MarketplaceResultsViewState } from "@/lib/public-marketplace-client-state";

export function MarketplaceResultsSummary({
  locale,
  state,
  total,
  productsFoundLabel,
}: {
  locale: "en" | "ko";
  state: MarketplaceResultsViewState;
  total: number;
  productsFoundLabel: string;
}) {
  const label = state === "error"
    ? locale === "ko"
      ? "현재 상품을 불러올 수 없음"
      : "Products temporarily unavailable"
    : state === "loading"
      ? locale === "ko"
        ? "상품을 불러오는 중"
        : "Loading products"
      : `${total} ${productsFoundLabel}`;

  return createElement(
    "span",
    { "data-marketplace-results-state": state },
    label,
  );
}

export function MarketplaceResultsPresentation({
  state,
  products,
  renderLoading,
  renderProducts,
  renderEmpty,
  renderError,
}: {
  state: MarketplaceResultsViewState;
  products: Product[];
  renderLoading: () => ReactNode;
  renderProducts: (products: Product[]) => ReactNode;
  renderEmpty: () => ReactNode;
  renderError: () => ReactNode;
}) {
  if (state === "error") {
    return createElement(
      "div",
      { className: "grid gap-4" },
      renderError(),
      products.length ? renderProducts(products) : null,
    );
  }
  if (state === "loading" && !products.length) return renderLoading();
  if (products.length) return renderProducts(products);
  return renderEmpty();
}
