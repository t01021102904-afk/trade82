import type { Locale } from "@/lib/i18n";

const marketplaceCopy = {
  en: {
    title: "Marketplace",
    description: "Korean products from verified sellers.",
  },
  ko: {
    title: "마켓플레이스",
    description: "검증된 셀러의 한국 상품을 확인하세요.",
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
