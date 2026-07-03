"use client";

import { ImageIcon } from "lucide-react";
import Image from "next/image";
import { useMemo, useState } from "react";

import { safeImageUrl } from "@/lib/url-security";
import { cx } from "@/lib/utils";

type ProductImageProps = {
  urls: Array<string | null | undefined>;
  alt: string;
  sizes: string;
  className?: string;
  imageClassName?: string;
  placeholderClassName?: string;
  placeholderLabel?: string;
  showLabel?: boolean;
};

export function ProductImage({
  urls,
  alt,
  sizes,
  className,
  imageClassName,
  placeholderClassName,
  placeholderLabel = "No product image",
  showLabel = true,
}: ProductImageProps) {
  const candidates = useMemo(() => normalizeProductImageUrls(urls), [urls]);
  const [failedUrls, setFailedUrls] = useState<string[]>([]);
  const activeUrl = candidates.find((url) => !failedUrls.includes(url));

  return (
    <div className={cx("relative overflow-hidden theme-surface-muted", className)}>
      {activeUrl ? (
        <Image
          src={activeUrl}
          alt={alt}
          fill
          sizes={sizes}
          unoptimized
          className={cx("object-cover", imageClassName)}
          onError={() => {
            setFailedUrls((current) =>
              current.includes(activeUrl) ? current : [...current, activeUrl],
            );
          }}
        />
      ) : (
        <ProductImagePlaceholder
          label={placeholderLabel}
          showLabel={showLabel}
          className={placeholderClassName}
        />
      )}
    </div>
  );
}

export function ProductImagePlaceholder({
  label = "No product image",
  showLabel = true,
  className,
}: {
  label?: string;
  showLabel?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "flex size-full flex-col items-center justify-center gap-2 p-4 text-center theme-muted",
        className,
      )}
    >
      <span className="flex size-10 items-center justify-center rounded-full border theme-border theme-surface">
        <ImageIcon className="size-4" aria-hidden="true" />
      </span>
      {showLabel ? <span className="text-xs font-medium">{label}</span> : null}
    </div>
  );
}

function normalizeProductImageUrls(urls: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const value of urls) {
    const url = safeImageUrl(value, "");
    if (!url || url === "/window.svg" || seen.has(url)) continue;
    seen.add(url);
    normalized.push(url);
  }

  return normalized;
}
