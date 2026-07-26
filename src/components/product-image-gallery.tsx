"use client";

import { useState } from "react";

import { useI18n } from "@/components/i18n-provider";
import { ProductImage } from "@/components/product-image";
import { safeImageUrl } from "@/lib/url-security";

export function ProductImageGallery({
  images,
  productName,
}: {
  images: string[];
  productName: string;
}) {
  const { t } = useI18n();
  const safeImages = images
    .map((image) => safeImageUrl(image, ""))
    .filter((image) => image && image !== "/window.svg");
  const [selected, setSelected] = useState(0);
  const active = safeImages[selected] ?? safeImages[0];

  return (
    <div className="grid gap-3 md:grid-cols-[72px_minmax(0,1fr)] md:items-start">
      <ProductImage
        urls={[active]}
        alt={`${productName} - ${t("productDetail.image")} ${selected + 1}`}
        sizes="(max-width: 1023px) 100vw, 50vw"
        className="aspect-square rounded-none border border-zinc-200 bg-white md:col-start-2 md:row-start-1"
        imageClassName="object-contain p-5 sm:p-8"
      />
      {safeImages.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1 md:col-start-1 md:row-start-1 md:flex-col md:overflow-visible">
          {safeImages.map((image, index) => (
            <button
              key={`${image}-${index}`}
              type="button"
              onClick={() => setSelected(index)}
              className={`relative aspect-square w-16 shrink-0 overflow-hidden border-2 ${
                selected === index
                  ? "border-emerald-700"
                  : "border-zinc-200 hover:border-zinc-400"
              }`}
              aria-label={`${productName} - ${t("productDetail.viewImage")} ${index + 1}`}
              aria-pressed={selected === index}
            >
              <ProductImage
                urls={[image]}
                alt=""
                sizes="120px"
                className="size-full rounded-none"
                imageClassName="bg-white object-contain p-1"
                placeholderClassName="p-1"
                showLabel={false}
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
