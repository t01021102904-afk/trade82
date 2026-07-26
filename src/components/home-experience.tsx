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
import { HomeHero } from "@/components/home-hero";
import { HomeMarketingExposureStrip } from "@/components/home-marketing-exposure-strip";
import { HomePublicPreviews } from "@/components/home-public-previews";
import {
  createTranslator,
  getDictionary,
  withLocale,
  type Locale,
} from "@/lib/i18n";
import { listPublicHomepagePromotions } from "@/lib/homepage-promotions";

const workflowIcons = [
  Search,
  SlidersHorizontal,
  MessageSquare,
  Handshake,
  BadgeCheck,
] as const;

export async function HomeExperience({ locale }: { locale: Locale }) {
  const t = createTranslator(getDictionary(locale));
  const promotions = await listPublicHomepagePromotions(locale).catch(() => []);

  return (
    <main className="overflow-hidden bg-white text-zinc-950">
      <HomeHero locale={locale} promotions={promotions} />

      <HomeCategoryVisualScroller />
      <HomeMarketingExposureStrip />
      <HomePublicPreviews />

      <section className="border-y border-zinc-200 bg-zinc-950 text-white">
        <div className="mx-auto max-w-[1240px] px-4 py-10 sm:px-5 sm:py-12 lg:px-6">
          <div className="grid gap-4 border-b border-white/20 pb-6 lg:grid-cols-[0.65fr_1.35fr] lg:items-end">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#34B386]">
              {t("home.howItWorks")}
            </p>
            <div>
              <h2 className="text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
                {t("home.discoveryHowTitle")}
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-300">
                {t("home.discoveryHowText")}
              </p>
            </div>
          </div>

          <ol className="grid divide-y divide-white/15 md:grid-cols-5 md:divide-x md:divide-y-0">
            {workflowIcons.map((Icon, index) => (
              <li key={index} className="px-0 py-5 md:px-4 md:py-6 first:pl-0 last:pr-0">
                <div className="flex items-center justify-between">
                  <Icon className="size-5 text-[#34B386]" aria-hidden="true" />
                  <span className="text-xs font-semibold text-zinc-400">
                    0{index + 1}
                  </span>
                </div>
                <h3 className="mt-6 text-sm font-semibold">
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

      <section className="mx-auto max-w-[1240px] px-4 py-10 sm:px-5 sm:py-12 lg:px-6">
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
    <article className="p-5 sm:p-7 lg:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-700">
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
        className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-md bg-zinc-950 px-5 text-sm font-semibold text-white transition hover:bg-zinc-800"
      >
        {label}
        <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </article>
  );
}
