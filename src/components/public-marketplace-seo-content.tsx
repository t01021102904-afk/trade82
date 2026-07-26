import type { Locale } from "@/lib/i18n";

const marketplaceCopy = {
  en: {
    title: "Korean B2B Product Marketplace",
    description:
      "Browse Korean products from verified suppliers for wholesale sourcing. Compare product information, minimum order quantities, pricing availability, shipping terms, certifications, and seller profiles before starting an inquiry.",
  },
  ko: {
    title: "한국 B2B 상품 마켓플레이스",
    description:
      "검증된 공급사의 한국 상품을 도매 소싱 목적으로 확인하세요. 문의 전에 상품 정보, 최소주문수량, 가격 공개 여부, 배송 조건, 인증 정보와 셀러 프로필을 비교할 수 있습니다.",
  },
} as const;

const sellersCopy = {
  en: {
    title: "Korean Suppliers",
    description:
      "Review verified Korean manufacturers, brand owners, distributors, their products, export experience, certifications, and company information before making contact.",
  },
  ko: {
    title: "한국 공급사",
    description:
      "검증된 한국 제조사, 브랜드사, 유통사의 상품, 수출 경험, 인증 및 회사 정보를 검토한 뒤 문의하세요.",
  },
} as const;

export function MarketplaceSeoContent({ locale }: { locale: Locale }) {
  const copy = marketplaceCopy[locale];

  return (
    <CompactPageHeader
      headingId="marketplace-heading"
      title={copy.title}
      description={copy.description}
    />
  );
}

export function SellersSeoContent({ locale }: { locale: Locale }) {
  const copy = sellersCopy[locale];

  return (
    <CompactPageHeader
      headingId="sellers-heading"
      title={copy.title}
      description={copy.description}
    />
  );
}

function CompactPageHeader({
  headingId,
  title,
  description,
}: {
  headingId: string;
  title: string;
  description: string;
}) {
  return (
    <header className="grid gap-4 border-b border-zinc-200 pb-7 lg:grid-cols-[0.7fr_1.3fr] lg:items-end">
      <h1
        id={headingId}
        className="text-3xl font-semibold tracking-[-0.04em] text-zinc-950 sm:text-5xl"
      >
        {title}
      </h1>
      <p className="max-w-2xl text-sm leading-6 text-zinc-600 sm:text-base">
        {description}
      </p>
    </header>
  );
}
