"use client";

import Image from "next/image";
import Link from "next/link";

import { useI18n } from "@/components/i18n-provider";
import { SaveButton } from "@/components/save-button";
import { withLocale } from "@/lib/i18n";
import type { Product } from "@/lib/types";

export function ProductCard({ product }: { product: Product }) {
  const { locale } = useI18n();
  const href = withLocale(`/products/${product.id}`, locale);

  return (
    <article className="group min-w-0">
      <div className="relative aspect-square overflow-hidden rounded-md bg-zinc-100">
        <Link href={href} className="block size-full">
          <Image
            src={product.imagePlaceholder || "/window.svg"}
            alt={product.name}
            fill
            sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 25vw"
            unoptimized
            className="object-cover transition-transform duration-[180ms] ease-out motion-safe:group-hover:scale-[1.02]"
          />
        </Link>
        <SaveButton
          id={product.id}
          kind="product"
          iconOnly
          className="absolute right-2 top-2 border-white/80 bg-white/90 shadow-sm backdrop-blur"
        />
      </div>

      <div className="grid gap-1.5 pt-3">
        <Link href={href} className="min-w-0">
          <h3 className="line-clamp-2 text-base font-semibold leading-6 text-zinc-950 transition-colors group-hover:text-blue-700">
            {product.name}
          </h3>
        </Link>
        <p className="text-lg font-bold text-zinc-950">{product.wholesalePrice}</p>
        <Link
          href={withLocale(`/stores/${product.sellerId}`, locale)}
          className="truncate text-sm text-zinc-600 hover:text-blue-700"
        >
          {product.sellerName}
        </Link>
        <div className="flex min-w-0 items-center gap-2 text-xs text-zinc-500">
          <span className="truncate">
            {product.sellerLocation || product.category}
          </span>
          <span aria-hidden="true">·</span>
          <time dateTime={product.createdAt}>
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
      <div className="aspect-square rounded-md bg-zinc-200" />
      <div className="grid gap-2 pt-3">
        <div className="h-5 w-4/5 rounded bg-zinc-200" />
        <div className="h-6 w-2/5 rounded bg-zinc-200" />
        <div className="h-4 w-3/5 rounded bg-zinc-100" />
        <div className="h-3 w-1/2 rounded bg-zinc-100" />
      </div>
    </div>
  );
}

function formatCreatedTime(value: string | undefined, locale: "en" | "ko") {
  if (!value) return locale === "ko" ? "방금 전" : "Just now";

  const elapsed = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(elapsed) || elapsed < 60_000) {
    return locale === "ko" ? "방금 전" : "Just now";
  }

  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 60) {
    return locale === "ko" ? `${minutes}분 전` : `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return locale === "ko" ? `${hours}시간 전` : `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  return locale === "ko" ? `${days}일 전` : `${days}d ago`;
}
