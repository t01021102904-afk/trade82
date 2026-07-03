"use client";

import { useState } from "react";

import { ProductImage } from "@/components/product-image";
import { safeImageUrl } from "@/lib/url-security";

export function ProductImageGallery({
  images,
  productName,
}: {
  images: string[];
  productName: string;
}) {
  const safeImages = images
    .map((image) => safeImageUrl(image, ""))
    .filter((image) => image && image !== "/window.svg");
  const [selected, setSelected] = useState(0);
  const active = safeImages[selected] ?? safeImages[0];

  return (
    <div className="grid gap-3">
      <ProductImage
        urls={[active]}
        alt={`${productName} 이미지 ${selected + 1}`}
        sizes="(max-width: 1023px) 100vw, 50vw"
        className="aspect-square rounded-md"
        imageClassName="object-contain p-4"
      />
      {safeImages.length > 1 ? (
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-6">
          {safeImages.map((image, index) => (
            <button
              key={`${image}-${index}`}
              type="button"
              onClick={() => setSelected(index)}
              className={`relative aspect-square overflow-hidden rounded-md border-2 ${
                selected === index
                  ? "border-zinc-950"
                  : "border-transparent hover:border-zinc-300"
              }`}
              aria-label={`${productName} 이미지 ${index + 1} 보기`}
              aria-pressed={selected === index}
            >
              <ProductImage
                urls={[image]}
                alt=""
                sizes="120px"
                className="size-full rounded-none"
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
