"use client";

import Image from "next/image";
import { useState } from "react";

export function ProductImageGallery({
  images,
  productName,
}: {
  images: string[];
  productName: string;
}) {
  const safeImages = images.length ? images : ["/window.svg"];
  const [selected, setSelected] = useState(0);
  const active = safeImages[selected] ?? safeImages[0];

  return (
    <div className="grid gap-3">
      <div className="relative aspect-square overflow-hidden rounded-md bg-zinc-100">
        <Image
          src={active}
          alt={`${productName} 이미지 ${selected + 1}`}
          fill
          sizes="(max-width: 1023px) 100vw, 50vw"
          unoptimized
          className="object-cover"
        />
      </div>
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
              <Image
                src={image}
                alt=""
                fill
                sizes="120px"
                unoptimized
                className="object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
