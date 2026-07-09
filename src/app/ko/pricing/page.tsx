import type { Metadata } from "next";

import { SellerSupportPricingPage } from "@/components/seller-support-pricing-page";
import { publicPageMetadata } from "@/lib/seo";

export const metadata: Metadata = publicPageMetadata({
  title: "Seller Support Pricing | Trade82",
  description:
    "Trade82 셀러 지원 플랜으로 글로벌 바이어 대상 카피, 문의 답변, 상품 페이지 개선을 지원받으세요.",
  path: "/ko/pricing",
  languages: {
    en: "/pricing",
    ko: "/ko/pricing",
  },
});

export default function KoPricingPage() {
  return <SellerSupportPricingPage />;
}
