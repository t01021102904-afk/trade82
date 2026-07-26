import {
  ArrowRight,
  BadgeCheck,
  Handshake,
  MessageSquare,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import Link from "next/link";

import { HomeCategoryVisualScroller } from "@/components/home-category-visual-scroller";
import { HomeMarketingExposureStrip } from "@/components/home-marketing-exposure-strip";
import { HomePublicPreviews } from "@/components/home-public-previews";
import {
  createTranslator,
  getDictionary,
  withLocale,
  type Locale,
} from "@/lib/i18n";

const workflowIcons = [
  Search,
  SlidersHorizontal,
  MessageSquare,
  Handshake,
  BadgeCheck,
] as const;

export function HomeExperience({ locale }: { locale: Locale }) {
  const t = createTranslator(getDictionary(locale));

  return (
    <main className="overflow-hidden bg-white text-zinc-950">
      <section className="border-b border-zinc-200">
        <div className="mx-auto grid max-w-[1440px] gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end lg:px-8 lg:py-24">
          <div className="max-w-4xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
              {t("home.discoveryEyebrow")}
            </p>
            <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-[1.04] tracking-[-0.045em] text-zinc-950 sm:text-5xl lg:text-7xl">
              {t("home.discoveryHeadline")}
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-zinc-600 sm:text-lg">
              {t("home.discoverySubheadline")}
            </p>

            <form
              action={withLocale("/marketplace", locale)}
              method="get"
              className="mt-9 flex max-w-3xl flex-col gap-2 border-y border-zinc-300 py-3 sm:flex-row"
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
                  className="h-12 w-full border-0 bg-transparent pl-11 pr-3 text-base text-zinc-950 outline-none placeholder:text-zinc-400 focus-visible:ring-2 focus-visible:ring-emerald-600/35"
                />
              </label>
              <button
                type="submit"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-emerald-700 px-6 text-sm font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2"
              >
                {t("home.discoverySearchCta")}
                <ArrowRight className="size-4" aria-hidden="true" />
              </button>
            </form>
          </div>

          <div className="grid gap-3 border-l border-zinc-200 pl-5">
            <p className="text-sm leading-6 text-zinc-600">
              {t("home.discoveryPrompt")}
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href={withLocale("/marketplace", locale)}
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-zinc-950 px-4 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-950 hover:text-white"
              >
                {t("common.browseProducts")}
              </Link>
              <Link
                href={withLocale("/sellers", locale)}
                className="inline-flex min-h-11 items-center justify-center rounded-md px-4 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
              >
                {t("home.browseSuppliers")}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <HomeCategoryVisualScroller />
      <HomeMarketingExposureStrip />
      <HomePublicPreviews />

      <section className="border-y border-zinc-200 bg-zinc-950 text-white">
        <div className="mx-auto max-w-[1440px] px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="grid gap-5 border-b border-white/20 pb-8 lg:grid-cols-[0.65fr_1.35fr] lg:items-end">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
              {t("home.howItWorks")}
            </p>
            <div>
              <h2 className="text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
                {t("home.discoveryHowTitle")}
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-300">
                {t("home.discoveryHowText")}
              </p>
            </div>
          </div>

          <ol className="grid divide-y divide-white/15 md:grid-cols-5 md:divide-x md:divide-y-0">
            {workflowIcons.map((Icon, index) => (
              <li key={index} className="px-0 py-6 md:px-5 md:py-8 first:pl-0 last:pr-0">
                <div className="flex items-center justify-between">
                  <Icon className="size-5 text-emerald-300" aria-hidden="true" />
                  <span className="text-xs font-semibold text-zinc-400">
                    0{index + 1}
                  </span>
                </div>
                <h3 className="mt-8 text-base font-semibold">
                  {t(`home.discoveryStep${index + 1}`)}
                </h3>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  {t(`home.discoveryStep${index + 1}Text`)}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="grid border border-zinc-200 md:grid-cols-2 md:divide-x md:divide-zinc-200">
          <RoleCta
            eyebrow={t("home.buyerCtaEyebrow")}
            title={t("home.buyerCtaTitle")}
            description={t("home.buyerCtaText")}
            href={withLocale("/signup?role=buyer", locale)}
            label={t("common.joinAsBuyer")}
          />
          <RoleCta
            eyebrow={t("home.sellerCtaEyebrow")}
            title={t("home.sellerCtaTitle")}
            description={t("home.sellerCtaText")}
            href={withLocale("/signup?role=seller", locale)}
            label={t("common.joinAsSeller")}
          />
        </div>
      </section>
    </main>
  );
}

function RoleCta({
  eyebrow,
  title,
  description,
  href,
  label,
}: {
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  label: string;
}) {
  return (
    <article className="p-6 sm:p-9 lg:p-12">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
        {eyebrow}
      </p>
      <h2 className="mt-4 max-w-lg text-2xl font-semibold tracking-[-0.03em] text-zinc-950 sm:text-3xl">
        {title}
      </h2>
      <p className="mt-4 max-w-xl text-sm leading-6 text-zinc-600">
        {description}
      </p>
      <Link
        href={href}
        className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-md bg-zinc-950 px-5 text-sm font-semibold text-white transition hover:bg-emerald-800"
      >
        {label}
        <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </article>
  );
}
