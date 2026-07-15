import type { Metadata } from "next";

import { BackButton } from "@/components/back-button";
import { JsonLd } from "@/components/json-ld";
import { MarketplaceClient } from "@/components/marketplace-client";
import { MarketplaceSeoContent } from "@/components/public-marketplace-seo-content";
import { getInitialMarketplaceData } from "@/lib/public-marketplace-initial-data";
import {
  marketplaceQueryStateFromRoute,
  type MarketplaceRouteSearchParams,
} from "@/lib/public-marketplace-query-state";
import {
  breadcrumbJsonLd,
  marketplaceItemListJsonLd,
  publicPageMetadata,
} from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = publicPageMetadata({
  title: "한국 B2B 상품 마켓플레이스 | Trade82",
  description:
    "검증된 공급사의 한국 상품을 도매 소싱 목적으로 확인하세요. 문의 전에 상품 정보, 최소주문수량, 가격 공개 여부, 배송 조건, 인증 정보와 셀러 프로필을 비교할 수 있습니다.",
  path: "/ko/marketplace",
  languages: {
    en: "/marketplace",
    ko: "/ko/marketplace",
  },
});

export default async function KoMarketplacePage({
  searchParams,
}: {
  searchParams: Promise<MarketplaceRouteSearchParams>;
}) {
  const queryState = marketplaceQueryStateFromRoute(await searchParams);
  const initialData = await getInitialMarketplaceData({
    locale: "ko",
    queryState,
  }).catch(() => null);

  return (
    <div className="bm-grid-surface theme-bg">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "홈", path: "/ko" },
          { name: "마켓플레이스", path: "/ko/marketplace" },
        ])}
      />
      {initialData?.products.length ? (
        <JsonLd data={marketplaceItemListJsonLd(initialData.products, "ko")} />
      ) : null}
      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-6 sm:px-6 lg:px-8">
        <BackButton fallbackHref="/" />
        <MarketplaceSeoContent locale="ko" />
        <MarketplaceClient
          initialProducts={initialData?.products}
          initialPagination={initialData?.pagination}
          initialFilterOptions={initialData?.filterOptions}
          initialQueryState={queryState}
          initialError={!initialData}
        />
      </div>
    </div>
  );
}
