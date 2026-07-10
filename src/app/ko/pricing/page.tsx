import type { Metadata } from "next";

import { SellerMarketingPage } from "@/components/seller-marketing-page";
import { publicPageMetadata } from "@/lib/seo";

export const metadata: Metadata = publicPageMetadata({
  title: "Trade82 마케팅 | Trade82",
  description:
    "Trade82 랜딩페이지에 상품을 노출하여 글로벌 바이어에게 더 많이 보여주세요.",
  path: "/ko/pricing",
  languages: {
    en: "/pricing",
    ko: "/ko/pricing",
  },
});

export default async function KoPricingPage({
  searchParams,
}: {
  searchParams: Promise<{ marketing?: string | string[] }>;
}) {
  const params = await searchParams;
  return <SellerMarketingPage initialSuccess={params.marketing === "success"} />;
}
