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
    title: "Sellers",
    description: "Browse Korean sellers and manufacturers.",
  },
  ko: {
    title: "셀러",
    description: "한국 셀러와 제조사를 둘러보세요.",
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
    <header className="max-w-3xl" aria-labelledby={headingId}>
      <h1
        id={headingId}
        className="text-2xl font-semibold tracking-tight theme-foreground sm:text-3xl"
      >
        {title}
      </h1>
      <p className="mt-2 text-sm leading-6 theme-muted">{description}</p>
    </header>
  );
}
