import Link from "next/link";

import { withLocale, type Locale } from "@/lib/i18n";

const marketplaceCopy = {
  en: {
    eyebrow: "Trade82 Marketplace",
    title: "Korean Products Marketplace",
    description:
      "Discover Korean products prepared for global B2B sourcing. Trade82 helps buyers compare seller profiles, product details, pricing visibility, logistics terms, and submitted documents before starting an inquiry.",
    primaryCta: "Browse Korean sellers",
    secondaryCta: "Join Trade82",
    categoriesTitle: "Explore Korean product categories",
    compareTitle: "What buyers can compare",
    faqTitle: "Sourcing Korean products through Trade82",
    categories: [
      ["Beauty & Personal Care", "Skincare, cosmetics, beauty devices, and personal care products."],
      ["Food & Snacks", "Packaged food, beverages, snacks, wellness foods, and pantry products."],
      ["Household", "Home goods, kitchenware, household products, and lifestyle items."],
      ["Lifestyle", "Stationery, character goods, fashion accessories, and retail-ready goods."],
      ["Industrial", "B2B supplies, components, materials, and operational products."],
      ["Packaging", "Packaging materials, containers, cartons, and export-ready formats."],
    ],
    compare: [
      "Minimum order quantity and price visibility",
      "Lead time, sample availability, and monthly supply capacity",
      "Seller profile, export experience, and product categories",
      "Submitted documents, HS code, compliance notes, and shipping terms",
    ],
    faq: [
      [
        "Can buyers contact sellers directly?",
        "Yes. Buyers can open a product inquiry and continue the conversation through Trade82 messages.",
      ],
      [
        "Are prices always public?",
        "No. Sellers can mark sensitive fields as public, private, or inquiry required.",
      ],
      [
        "Does every shipment need the same documents?",
        "No. Requirements vary by product, importer, shipment method, and government agency.",
      ],
    ],
  },
  ko: {
    eyebrow: "Trade82 마켓플레이스",
    title: "한국 상품 마켓플레이스",
    description:
      "글로벌 B2B 소싱 검토에 필요한 한국 상품 정보를 확인하세요. Trade82는 바이어가 셀러 프로필, 상품 정보, 가격 공개 범위, 물류 조건, 제출 서류를 비교한 뒤 문의를 시작할 수 있도록 돕습니다.",
    primaryCta: "한국 셀러 보기",
    secondaryCta: "Trade82 가입",
    categoriesTitle: "한국 상품 카테고리 탐색",
    compareTitle: "바이어가 비교할 수 있는 정보",
    faqTitle: "Trade82를 통한 한국 상품 소싱",
    categories: [
      ["뷰티 & 퍼스널케어", "스킨케어, 화장품, 뷰티 디바이스, 퍼스널케어 상품"],
      ["식품 & 스낵", "가공식품, 음료, 스낵, 웰니스 식품, 식료품"],
      ["생활용품", "홈굿즈, 주방용품, 생활 소비재, 라이프스타일 상품"],
      ["라이프스타일", "문구, 캐릭터 상품, 패션 잡화, 리테일 상품"],
      ["산업/B2B", "B2B 소모품, 부품, 소재, 운영 관련 상품"],
      ["패키징", "포장재, 용기, 박스, 수출 포장 형식"],
    ],
    compare: [
      "MOQ와 가격 공개 범위",
      "리드타임, 샘플 가능 여부, 월 공급량",
      "셀러 프로필, 수출 경험, 취급 카테고리",
      "제출 서류, HS 코드, 규정 관련 메모, 선적 조건",
    ],
    faq: [
      [
        "바이어가 셀러에게 직접 문의할 수 있나요?",
        "네. 바이어는 상품 문의를 시작하고 Trade82 메시지에서 대화를 이어갈 수 있습니다.",
      ],
      [
        "가격이 항상 공개되나요?",
        "아니요. 셀러는 민감한 항목을 공개, 비공개, 문의 필요로 설정할 수 있습니다.",
      ],
      [
        "모든 선적에 같은 서류가 필요한가요?",
        "아니요. 필요 서류는 상품, 수입자, 운송 방식, 관련 기관에 따라 달라집니다.",
      ],
    ],
  },
} as const;

const sellersCopy = {
  en: {
    eyebrow: "Seller Directory",
    title: "Korean Seller Companies",
    description:
      "Browse Korean manufacturers, distributors, wholesalers, and brand owners preparing products for global sourcing conversations. Seller profiles help buyers understand company focus before sending an inquiry.",
    primaryCta: "Explore marketplace",
    secondaryCta: "Join as supplier",
    profileTitle: "What seller profiles can show",
    profileItems: [
      "Company role, product categories, and location",
      "Export experience, sales channels, and available documents",
      "Company description, product count, and inquiry entry points",
      "Public listing status and Trade82 marketplace profile information",
    ],
    directoryTitle: "Seller directory categories",
    categories: [
      "Beauty & Personal Care",
      "Food & Snacks",
      "Household Goods",
      "Health & Wellness",
      "Packaging",
      "Industrial / B2B Supplies",
    ],
    faqTitle: "Finding Korean sellers on Trade82",
    faq: [
      [
        "Can buyers browse sellers before contacting them?",
        "Yes. Public seller profiles are designed to help buyers review basic company and product context first.",
      ],
      [
        "Can sellers list multiple products?",
        "Yes. Seller dashboard product management supports multiple listings and status control.",
      ],
      [
        "Does Trade82 guarantee a transaction?",
        "No. Trade82 provides marketplace and workflow tools. Buyers and sellers should complete their own due diligence.",
      ],
    ],
  },
  ko: {
    eyebrow: "셀러 디렉터리",
    title: "한국 셀러 회사",
    description:
      "글로벌 소싱 상담을 준비하는 한국 제조사, 유통사, 도매사, 브랜드 오너를 확인하세요. 셀러 프로필은 바이어가 문의 전 회사의 주요 카테고리와 상품 맥락을 이해하는 데 도움을 줍니다.",
    primaryCta: "마켓플레이스 보기",
    secondaryCta: "셀러로 가입",
    profileTitle: "셀러 프로필에서 확인할 수 있는 정보",
    profileItems: [
      "회사 역할, 취급 카테고리, 소재 지역",
      "수출 경험, 판매 채널, 제공 가능 문서",
      "회사 소개, 상품 수, 문의 진입점",
      "공개 상태와 Trade82 마켓플레이스 프로필 정보",
    ],
    directoryTitle: "셀러 디렉터리 카테고리",
    categories: [
      "뷰티 & 퍼스널케어",
      "식품 & 스낵",
      "생활용품",
      "헬스 & 웰니스",
      "패키징",
      "산업/B2B 용품",
    ],
    faqTitle: "Trade82에서 한국 셀러 찾기",
    faq: [
      [
        "바이어가 문의 전 셀러를 확인할 수 있나요?",
        "네. 공개 셀러 프로필은 바이어가 기본 회사 정보와 상품 맥락을 먼저 검토할 수 있도록 구성됩니다.",
      ],
      [
        "셀러가 여러 상품을 등록할 수 있나요?",
        "네. 셀러 대시보드에서 여러 상품을 관리하고 공개 상태를 조정할 수 있습니다.",
      ],
      [
        "Trade82가 거래 성사를 보증하나요?",
        "아니요. Trade82는 마켓플레이스와 업무 도구를 제공합니다. 바이어와 셀러는 자체 실사를 진행해야 합니다.",
      ],
    ],
  },
} as const;

export function MarketplaceSeoContent({ locale }: { locale: Locale }) {
  const copy = marketplaceCopy[locale];

  return (
    <section className="grid gap-8" aria-labelledby="marketplace-heading">
      <div className="grid gap-5 rounded-2xl border p-5 theme-surface-elevated sm:p-7 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] theme-success-text">
            {copy.eyebrow}
          </p>
          <h1
            id="marketplace-heading"
            className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight theme-foreground sm:text-4xl"
          >
            {copy.title}
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 theme-muted sm:text-base">
            {copy.description}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href={withLocale("/sellers", locale)} className="inline-flex h-10 items-center rounded-lg px-4 text-sm font-semibold theme-primary-button">
              {copy.primaryCta}
            </Link>
            <Link href={withLocale("/signup", locale)} className="inline-flex h-10 items-center rounded-lg border px-4 text-sm font-semibold theme-secondary-button">
              {copy.secondaryCta}
            </Link>
          </div>
        </div>
        <div className="grid gap-2 rounded-xl border p-4 theme-surface-muted">
          <h2 className="text-sm font-semibold theme-foreground">{copy.compareTitle}</h2>
          <ul className="grid gap-2 text-sm leading-6 theme-muted">
            {copy.compare.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-emerald-400" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid gap-4">
        <h2 className="text-lg font-semibold theme-foreground">{copy.categoriesTitle}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {copy.categories.map(([title, description]) => (
            <article key={title} className="rounded-xl border p-4 theme-surface">
              <h3 className="text-sm font-semibold theme-foreground">{title}</h3>
              <p className="mt-2 text-sm leading-6 theme-muted">{description}</p>
            </article>
          ))}
        </div>
      </div>

      <FaqBlock title={copy.faqTitle} items={copy.faq} />
    </section>
  );
}

export function SellersSeoContent({ locale }: { locale: Locale }) {
  const copy = sellersCopy[locale];

  return (
    <section className="grid gap-8" aria-labelledby="sellers-heading">
      <div className="grid gap-5 rounded-2xl border p-5 theme-surface-elevated sm:p-7 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] theme-success-text">
            {copy.eyebrow}
          </p>
          <h1
            id="sellers-heading"
            className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight theme-foreground sm:text-4xl"
          >
            {copy.title}
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 theme-muted sm:text-base">
            {copy.description}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href={withLocale("/marketplace", locale)} className="inline-flex h-10 items-center rounded-lg px-4 text-sm font-semibold theme-primary-button">
              {copy.primaryCta}
            </Link>
            <Link href={withLocale("/signup", locale)} className="inline-flex h-10 items-center rounded-lg border px-4 text-sm font-semibold theme-secondary-button">
              {copy.secondaryCta}
            </Link>
          </div>
        </div>
        <div className="grid gap-2 rounded-xl border p-4 theme-surface-muted">
          <h2 className="text-sm font-semibold theme-foreground">{copy.profileTitle}</h2>
          <ul className="grid gap-2 text-sm leading-6 theme-muted">
            {copy.profileItems.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-emerald-400" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-2xl border p-5 theme-surface">
        <h2 className="text-lg font-semibold theme-foreground">{copy.directoryTitle}</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {copy.categories.map((category) => (
            <span key={category} className="rounded-full border px-3 py-1 text-xs font-medium theme-surface-muted">
              {category}
            </span>
          ))}
        </div>
      </div>

      <FaqBlock title={copy.faqTitle} items={copy.faq} />
    </section>
  );
}

function FaqBlock({
  title,
  items,
}: {
  title: string;
  items: ReadonlyArray<readonly [string, string]>;
}) {
  return (
    <section className="grid gap-4" aria-label={title}>
      <h2 className="text-lg font-semibold theme-foreground">{title}</h2>
      <div className="grid gap-3 md:grid-cols-3">
        {items.map(([question, answer]) => (
          <article key={question} className="rounded-xl border p-4 theme-surface">
            <h3 className="text-sm font-semibold theme-foreground">{question}</h3>
            <p className="mt-2 text-sm leading-6 theme-muted">{answer}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
