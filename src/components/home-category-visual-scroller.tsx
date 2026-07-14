"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type WheelEvent } from "react";

import { useI18n } from "@/components/i18n-provider";
import { homeCategoryHref, homeProductCategories } from "@/lib/home-product-categories";

type ScrollAvailability = {
  previous: boolean;
  next: boolean;
};

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function HomeCategoryVisualScroller() {
  const { locale, t } = useI18n();
  const trackRef = useRef<HTMLDivElement>(null);
  const [availability, setAvailability] = useState<ScrollAvailability>({ previous: false, next: true });

  const updateAvailability = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;

    const maxScrollLeft = Math.max(0, track.scrollWidth - track.clientWidth);
    setAvailability({
      previous: track.scrollLeft > 1,
      next: track.scrollLeft < maxScrollLeft - 1,
    });
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const frame = window.requestAnimationFrame(updateAvailability);
    const observer = new ResizeObserver(updateAvailability);
    observer.observe(track);
    track.addEventListener("scroll", updateAvailability, { passive: true });
    window.addEventListener("resize", updateAvailability);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      track.removeEventListener("scroll", updateAvailability);
      window.removeEventListener("resize", updateAvailability);
    };
  }, [updateAvailability]);

  const moveTrack = (direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;

    track.scrollBy({
      left: direction * Math.max(track.clientWidth * 0.78, 320),
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (!event.shiftKey) return;

    const horizontalDistance = event.deltaX || event.deltaY;
    if (!horizontalDistance) return;

    event.preventDefault();
    trackRef.current?.scrollBy({
      left: horizontalDistance,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  };

  return (
    <section className="relative border-t py-8 theme-border sm:py-10" aria-labelledby="home-category-heading">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-4 flex items-center justify-between gap-4 sm:mb-5">
          <h2 id="home-category-heading" className="text-lg font-semibold tracking-[-0.01em] theme-foreground sm:text-xl">
            {t("home.categorySection.title")}
          </h2>
          <div className="hidden items-center gap-2 sm:flex">
            <button
              type="button"
              onClick={() => moveTrack(-1)}
              disabled={!availability.previous}
              aria-label={t("home.categorySection.previous")}
              className="inline-flex size-9 items-center justify-center rounded-full border transition hover:border-[#34B386] hover:text-[#16785a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#34B386]/40 disabled:cursor-not-allowed disabled:opacity-35 theme-surface-elevated"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => moveTrack(1)}
              disabled={!availability.next}
              aria-label={t("home.categorySection.next")}
              className="inline-flex size-9 items-center justify-center rounded-full border transition hover:border-[#34B386] hover:text-[#16785a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#34B386]/40 disabled:cursor-not-allowed disabled:opacity-35 theme-surface-elevated"
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div
          ref={trackRef}
          onWheel={handleWheel}
          tabIndex={0}
          aria-label={t("home.categorySection.scrollRegion")}
          className="home-category-visual-scroll -mr-4 flex gap-3 overflow-x-auto pr-4 pb-1 outline-none sm:-mr-6 sm:gap-4 sm:pr-6 lg:-mr-8 lg:pr-8"
        >
          {homeProductCategories.map((item) => (
            <Link
              key={item.id}
              href={homeCategoryHref(item.category, locale)}
              className="home-category-visual-item group flex w-[116px] shrink-0 snap-start flex-col items-center justify-center rounded-[23px] border px-2 py-3 text-center transition hover:-translate-y-0.5 hover:border-[#34B386] focus-visible:-translate-y-0.5 focus-visible:border-[#34B386] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#34B386]/35 sm:w-[145px] sm:px-3 sm:py-4 lg:w-[152px] theme-surface-elevated"
            >
              <Image
                src={item.imageSrc}
                alt=""
                aria-hidden="true"
                width={184}
                height={150}
                className="h-[74px] w-[100px] object-contain sm:h-[88px] sm:w-[116px]"
              />
              <span className="mt-2 line-clamp-2 text-xs font-semibold leading-4 theme-foreground sm:mt-3 sm:text-[13px]">
                {t(`home.categorySection.items.${item.id}`)}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
