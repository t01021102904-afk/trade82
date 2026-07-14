"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { useI18n } from "@/components/i18n-provider";
import {
  homeProductCategories,
  homeProductCategoryHref,
} from "@/lib/home-product-categories";

type ScrollState = {
  canScrollBack: boolean;
  canScrollForward: boolean;
};

const initialScrollState: ScrollState = {
  canScrollBack: false,
  canScrollForward: true,
};

export function HomeCategoryScroller() {
  const { locale, t } = useI18n();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [scrollState, setScrollState] = useState(initialScrollState);

  const updateScrollState = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const maxScrollLeft = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    setScrollState({
      canScrollBack: scroller.scrollLeft > 2,
      canScrollForward: scroller.scrollLeft < maxScrollLeft - 2,
    });
  }, []);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    updateScrollState();
    const observer = new ResizeObserver(updateScrollState);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, [updateScrollState]);

  function scrollCategories(direction: "previous" | "next") {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    scroller.scrollBy({
      left: (direction === "next" ? 1 : -1) * Math.max(260, Math.round(scroller.clientWidth * 0.72)),
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }

  return (
    <section className="border-t theme-border" aria-labelledby="home-category-heading">
      <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
        <div className="mb-4 flex items-center justify-between gap-4 sm:mb-5">
          <h2 id="home-category-heading" className="text-lg font-semibold theme-foreground sm:text-xl">
            {t("home.categorySection.title")}
          </h2>
          <div className="hidden items-center gap-2 sm:flex">
            <button
              type="button"
              aria-label={t("home.categorySection.previous")}
              onClick={() => scrollCategories("previous")}
              disabled={!scrollState.canScrollBack}
              className="inline-flex size-9 items-center justify-center rounded-full border transition theme-secondary-button disabled:pointer-events-none disabled:opacity-35"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={t("home.categorySection.next")}
              onClick={() => scrollCategories("next")}
              disabled={!scrollState.canScrollForward}
              className="inline-flex size-9 items-center justify-center rounded-full border transition theme-secondary-button disabled:pointer-events-none disabled:opacity-35"
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div
          ref={scrollerRef}
          onScroll={updateScrollState}
          tabIndex={0}
          className="home-category-scroll -mx-4 flex min-w-0 gap-3 overflow-x-auto px-4 pb-2 outline-none sm:mx-0 sm:px-0"
        >
          {homeProductCategories.map((item) => (
            <Link
              key={item.id}
              href={homeProductCategoryHref(item.category, locale)}
              className="group flex w-[132px] shrink-0 flex-col items-center rounded-2xl border p-3 text-center transition duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 theme-surface-elevated sm:w-[144px]"
            >
              <span className="flex h-[92px] w-full items-center justify-center overflow-hidden rounded-xl bg-[linear-gradient(145deg,rgba(244,252,249,0.92),rgba(238,246,255,0.88))]">
                <Image
                  src={item.imageSrc}
                  alt=""
                  width={144}
                  height={112}
                  className="h-[86px] w-[112px] object-contain transition duration-200 group-hover:scale-[1.03]"
                />
              </span>
              <span className="mt-2 line-clamp-2 min-h-10 text-xs font-semibold leading-5 theme-foreground">
                {t(`home.categorySection.items.${item.id}`)}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
