"use client";

import Link from "next/link";

import { AdminBadge } from "@/components/admin-badge";
import { useI18n } from "@/components/i18n-provider";
import { ProductImage } from "@/components/product-image";
import { SaveButton } from "@/components/save-button";
import { WholesalePriceGate } from "@/components/wholesale-price-gate";
import { withLocale } from "@/lib/i18n";
import type { Product } from "@/lib/types";

export function ProductCard({ product }: { product: Product }) {
  const { locale, t } = useI18n();
  const href = withLocale(`/products/${product.id}`, locale);

  return (
    <article className="group flex min-w-0 flex-col border border-zinc-200 bg-white p-3 transition-colors hover:border-zinc-400">
      <div className="relative aspect-[4/3] overflow-hidden bg-zinc-50">
        <Link href={href} className="relative block size-full">
          <ProductImage
            urls={[product.imagePlaceholder, ...(product.imageUrls ?? [])]}
            alt={product.name}
            sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 25vw"
            className="size-full rounded-none"
            imageClassName="bg-white object-contain p-3 transition-transform duration-[180ms] ease-out motion-safe:group-hover:scale-[1.015]"
          />
        </Link>
        <SaveButton
          id={product.id}
          kind="product"
          iconOnly
          className="absolute right-2 top-2 min-h-10 min-w-10 border border-zinc-200 bg-white/95 shadow-sm backdrop-blur"
        />
      </div>

      <div className="relative z-10 flex min-w-0 flex-1 flex-col pt-3">
        <p className="mb-1.5 truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-600">
          {product.category}
        </p>
        <Link href={href} className="min-w-0">
          <h3 className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-zinc-950 transition-colors group-hover:text-[#34B386]">
            {product.name}
          </h3>
        </Link>
        <WholesalePriceGate
          value={product.wholesalePrice}
          className="mt-2.5 max-w-full"
          valueClassName="truncate text-base font-semibold text-zinc-950"
          gateClassName="text-sm"
        />
        {product.moq ? (
          <p className="mt-1 truncate text-xs text-zinc-500">
            <span className="font-medium text-zinc-700">{t("marketplace.moq")}:</span>{" "}
            {product.moq}
          </p>
        ) : null}
        <div className="mt-3 border-t border-zinc-200 pt-2.5">
        <Link
          href={withLocale(`/companies/${product.sellerId}`, locale)}
          className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-zinc-700 hover:text-[#34B386]"
        >
          <span className="truncate">{product.sellerName}</span>
          {product.sellerIsTrade82Team ? <AdminBadge compact /> : null}
        </Link>
        <div className="mt-1 min-w-0 overflow-hidden text-xs text-zinc-500">
          <span className="truncate">{product.sellerLocation}</span>
        </div>
        </div>
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="animate-pulse border border-zinc-200 bg-white p-3" aria-hidden="true">
      <div className="aspect-[4/3] bg-zinc-100" />
      <div className="grid gap-2 pt-4">
        <div className="h-3 w-2/5 rounded bg-zinc-100" />
        <div className="h-5 w-4/5 rounded bg-zinc-100" />
        <div className="h-5 w-3/5 rounded bg-zinc-100" />
        <div className="mt-2 h-6 w-2/5 rounded bg-zinc-100" />
        <div className="h-4 w-3/5 rounded bg-zinc-100" />
        <div className="mt-3 h-px bg-zinc-100" />
        <div className="h-4 w-1/2 rounded bg-zinc-100" />
      </div>
    </div>
  );
}
