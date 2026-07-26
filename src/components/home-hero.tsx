"use client";

import { ArrowRight, Search } from "lucide-react";

import {
  HomePromotionCarousel,
  type PublicHomepagePromotion,
} from "@/components/home-promotion-carousel";
import { useI18n } from "@/components/i18n-provider";
import { withLocale, type Locale } from "@/lib/i18n";

export function HomeHero({
  locale,
  promotions,
}: {
  locale: Locale;
  promotions: PublicHomepagePromotion[];
}) {
  const { t } = useI18n();

  return (
    <section className="border-b border-zinc-200">
      <div className="mx-auto max-w-[1240px] px-4 py-10 sm:px-5 sm:py-12 lg:px-6 lg:py-14">
        <div
          className={
            promotions.length
              ? "grid gap-8 lg:grid-cols-[minmax(0,1.22fr)_minmax(360px,1fr)] lg:items-center"
              : ""
          }
        >
          <div className={promotions.length ? "min-w-0" : "max-w-3xl"}>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-700">
              {t("home.discoveryEyebrow")}
            </p>
            <h1 className="mt-3 max-w-3xl text-3xl font-semibold leading-[1.08] tracking-[-0.04em] text-zinc-950 sm:text-4xl lg:text-5xl">
              {t("home.discoveryHeadline")}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-600 sm:text-base">
              {t("home.discoverySubheadline")}
            </p>

            <form
              action={withLocale("/marketplace", locale)}
              method="get"
              className="mt-6 flex max-w-2xl flex-col gap-2 border-y border-zinc-300 py-2.5 sm:flex-row"
              role="search"
            >
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">{t("marketplace.searchProducts")}</span>
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-zinc-400"
                  aria-hidden="true"
                />
                <input
                  name="q"
                  type="search"
                  placeholder={t("home.discoverySearchPlaceholder")}
                  className="h-10 w-full border-0 bg-transparent pl-10 pr-3 text-sm text-zinc-950 outline-none placeholder:text-zinc-400 focus-visible:ring-2 focus-visible:ring-[#34B386]/35"
                />
              </label>
              <button
                type="submit"
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-zinc-950 px-5 text-sm font-semibold text-white transition hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#34B386]/50 focus-visible:ring-offset-2"
              >
                {t("home.discoverySearchCta")}
                <ArrowRight className="size-4" aria-hidden="true" />
              </button>
            </form>
          </div>
          {promotions.length ? (
            <HomePromotionCarousel promotions={promotions} />
          ) : null}
        </div>
      </div>
    </section>
  );
}
