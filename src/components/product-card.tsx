"use client";

import Link from "next/link";

import { AdminBadge } from "@/components/admin-badge";
import { useI18n } from "@/components/i18n-provider";
import { ProductImage } from "@/components/product-image";
import { SaveButton } from "@/components/save-button";
import { VerifiedSellerBadge } from "@/components/verified-seller-badge";
import { WholesalePriceGate } from "@/components/wholesale-price-gate";
import { withLocale } from "@/lib/i18n";
import type { Product } from "@/lib/types";

export function ProductCard({ product }: { product: Product }) {
  const { locale } = useI18n();
  const href = withLocale(`/products/${product.id}`, locale);

  return (
    <article className="bm-premium-card group min-w-0 rounded-lg border p-3 theme-surface">
      <div className="relative aspect-square overflow-hidden rounded-md">
        <Link href={href} className="relative block size-full">
          <ProductImage
            urls={[product.imagePlaceholder, ...(product.imageUrls ?? [])]}
            alt={product.name}
            sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 25vw"
            className="size-full rounded-md"
            imageClassName="bg-white object-contain p-2 transition-transform duration-[180ms] ease-out motion-safe:group-hover:scale-[1.02]"
          />
        </Link>
        <SaveButton
          id={product.id}
          kind="product"
          iconOnly
          className="absolute right-2 top-2 theme-secondary-button shadow-sm backdrop-blur"
        />
      </div>

      <div className="relative z-10 grid min-w-0 gap-1.5 pt-3">
        <Link href={href} className="min-w-0">
          <h3 className="line-clamp-2 text-sm font-semibold leading-5 theme-foreground transition-colors group-hover:text-[var(--accent-foreground)]">
            {product.name}
          </h3>
        </Link>
        <WholesalePriceGate
          value={product.wholesalePrice}
          className="max-w-full"
          valueClassName="truncate text-base font-semibold theme-foreground"
          gateClassName="text-sm"
        />
        <Link
          href={withLocale(`/stores/${product.sellerId}`, locale)}
          className="flex min-w-0 items-center gap-1.5 text-xs theme-muted hover:text-[var(--accent-foreground)]"
        >
          <span className="truncate">{product.sellerName}</span>
          {product.sellerIsTrade82Team ? <AdminBadge compact /> : null}
          {product.sellerIsVerifiedSeller ? <VerifiedSellerBadge compact /> : null}
        </Link>
        <div className="flex min-w-0 items-center gap-2 overflow-hidden text-xs theme-muted">
          <span className="truncate">
            {product.sellerLocation || product.category}
          </span>
          <span aria-hidden="true">·</span>
          <time dateTime={product.createdAt} className="shrink-0">
            {formatCreatedTime(product.createdAt, locale)}
          </time>
        </div>
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="animate-pulse" aria-hidden="true">
      <div className="aspect-square rounded-md theme-surface-muted" />
      <div className="grid gap-2 pt-3">
        <div className="h-5 w-4/5 rounded bg-[var(--muted)]" />
        <div className="h-6 w-2/5 rounded bg-[var(--muted)]" />
        <div className="h-4 w-3/5 rounded bg-[var(--muted)]" />
        <div className="h-3 w-1/2 rounded bg-[var(--muted)]" />
      </div>
    </div>
  );
}

function formatCreatedTime(value: string | undefined, locale: "en" | "ko") {
  if (!value) return locale === "ko" ? "최근 등록" : "Recently listed";

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return locale === "ko" ? "최근 등록" : "Recently listed";
  }

  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  return locale === "ko"
    ? `${year}.${String(month).padStart(2, "0")}.${String(day).padStart(2, "0")}`
    : `${month}/${day}/${year}`;
}
