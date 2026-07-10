import type { Metadata } from "next";

import { BuyersPageContent } from "@/components/buyers-page";
import { JsonLd } from "@/components/json-ld";
import { breadcrumbJsonLd, publicPageMetadata } from "@/lib/seo";

export const metadata: Metadata = publicPageMetadata({
  title: "Buyers | Trade82",
  description:
    "Trade82에서 글로벌 바이어 프로필과 소싱 관심 분야를 확인하세요.",
  path: "/ko/buyers",
  languages: {
    en: "/en/buyers",
    ko: "/ko/buyers",
  },
});

export default function KoBuyersPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "홈", path: "/ko" },
          { name: "바이어", path: "/ko/buyers" },
        ])}
      />
      <BuyersPageContent locale="ko" />
    </>
  );
}
