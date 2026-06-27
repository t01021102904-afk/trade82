import Link from "next/link";

import { Badge } from "@/components/badge";
import { HomePublicPreviews } from "@/components/home-public-previews";
import {
  AnimatedGridBackground,
  FloatingMarketplacePreview,
  HowItWorksMotion,
} from "@/components/premium-motion";
import { SectionHeader } from "@/components/section-header";
import { getDictionary, withLocale, type Locale } from "@/lib/i18n";

export function HomeExperience({ locale }: { locale: Locale }) {
  const messages = getDictionary(locale);
  const valueCards = [
    { title: messages.home.valueTitle1, description: messages.home.valueText1 },
    { title: messages.home.valueTitle2, description: messages.home.valueText2 },
    { title: messages.home.valueTitle3, description: messages.home.valueText3 },
  ];
  const processSteps =
    locale === "ko"
      ? [
          {
            title: "한국 셀러가 회사와 상품을 등록합니다",
            description: "회사 정보, 상품 정보, 거래 조건을 한곳에 정리합니다.",
          },
          {
            title: "미국 바이어가 회사를 팔로우하거나 상품을 저장합니다",
            description: "관심 있는 셀러와 상품을 저장하고 비교합니다.",
          },
          {
            title: "바이어가 문의를 보냅니다",
            description: "수량, 일정, 샘플 요청 등 필요한 내용을 구조화해 보냅니다.",
          },
          {
            title: "셀러와 바이어가 대화를 이어갑니다",
            description: "메시지에서 조건을 확인하고 다음 거래 단계를 준비합니다.",
          },
        ]
      : [
          {
            title: "Korean seller lists company and product",
            description: "Company details, product data, and trade terms stay together.",
          },
          {
            title: "American buyer follows or saves",
            description: "Buyers track Korean sellers and products while comparing options.",
          },
          {
            title: "Buyer sends inquiry",
            description: "Quantity, timing, samples, and channel context arrive in one thread.",
          },
          {
            title: "Seller and buyer continue conversation",
            description: "Messages keep sourcing follow-up clear and organized.",
          },
        ];

  return (
    <div className="bg-white">
      <AnimatedGridBackground>
        <div className="mx-auto grid min-h-[620px] max-w-7xl items-center gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
          <div className="bm-section-in min-w-0">
            <Badge tone="blue">{messages.home.heroBadge}</Badge>
            <h1 className="mt-6 max-w-4xl text-4xl font-semibold leading-tight tracking-normal text-zinc-950 sm:text-6xl">
              {messages.home.headline}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-600">
              {messages.home.subheadline}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href={withLocale("/marketplace", locale)}
                className="inline-flex min-h-12 items-center justify-center rounded-md bg-zinc-950 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-zinc-950/10 transition hover:-translate-y-0.5 hover:bg-blue-700"
              >
                {messages.common.browseProducts}
              </Link>
              <Link
                href={withLocale("/sellers", locale)}
                className="inline-flex min-h-12 items-center justify-center rounded-md border border-zinc-200 bg-white/80 px-5 py-3 text-sm font-semibold text-zinc-800 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:text-blue-700"
              >
                {messages.common.viewSellers}
              </Link>
            </div>
          </div>
          <FloatingMarketplacePreview
            labels={{
              seller: locale === "ko" ? "한국 셀러" : "Korean Seller",
              buyer: locale === "ko" ? "미국 바이어" : "U.S. Buyer",
              inquiry: locale === "ko" ? "문의" : "Inquiry",
              sample: locale === "ko" ? "상품 정보" : "Product Details",
              follow: locale === "ko" ? "회사 팔로우" : "Follow Company",
            }}
          />
        </div>
      </AnimatedGridBackground>

      <section className="border-y border-zinc-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-5 px-4 py-14 sm:px-6 lg:grid-cols-3 lg:px-8">
          {valueCards.map((card, index) => (
            <div
              key={card.title}
              className="bm-premium-card bm-section-in rounded-lg border border-zinc-200 bg-white p-6 shadow-sm shadow-zinc-100"
              style={{ animationDelay: `${index * 70}ms` }}
            >
              <h2 className="relative z-10 break-words text-lg font-semibold text-zinc-950">
                {card.title}
              </h2>
              <p className="relative z-10 mt-3 text-sm leading-6 text-zinc-600">
                {card.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <SectionHeader
          label={messages.home.howItWorks}
          title={messages.home.howTitle}
          description={messages.home.howDescription}
        />
        <HowItWorksMotion steps={processSteps} />
      </section>

      <HomePublicPreviews />

      <section className="border-t border-zinc-200 bg-zinc-950">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-14 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="min-w-0">
            <h2 className="break-words text-3xl font-semibold text-white">
              {messages.home.ctaTitle}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-300">
              {messages.home.ctaText}
            </p>
          </div>
          <Link
            href={withLocale("/onboarding/buyer", locale)}
            className="inline-flex min-h-12 items-center justify-center rounded-md bg-white px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:-translate-y-0.5 hover:bg-blue-50 hover:text-blue-700"
          >
            {messages.common.joinAsBuyer}
          </Link>
        </div>
      </section>
    </div>
  );
}
