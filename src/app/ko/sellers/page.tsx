import type { Metadata } from "next";

import { JsonLd } from "@/components/json-ld";
import { SellersSeoContent } from "@/components/public-marketplace-seo-content";
import { SellersClient } from "@/components/sellers-client";
import { breadcrumbJsonLd, publicPageMetadata } from "@/lib/seo";

export const metadata: Metadata = publicPageMetadata({
  title: "한국 공급사 | Trade82",
  description:
    "Trade82에서 검증된 한국 제조사, 브랜드사와 유통사의 회사 정보, 수출 경험, 인증 및 등록 상품을 확인하세요.",
  path: "/ko/sellers",
  languages: {
    en: "/sellers",
    ko: "/ko/sellers",
  },
});

export default function KoSellersPage() {
  return (
    <main className="min-h-screen bg-white text-zinc-950">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "홈", path: "/ko" },
          { name: "셀러", path: "/ko/sellers" },
        ])}
      />
      <div className="mx-auto grid max-w-[1440px] gap-7 px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <SellersSeoContent locale="ko" />
        <SellersClient />
      </div>
    </main>
  );
}
