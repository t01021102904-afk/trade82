import type { Metadata } from "next";

import { JsonLd } from "@/components/json-ld";
import { SellerMarketingPage } from "@/components/seller-marketing-page";
import { breadcrumbJsonLd, publicPageMetadata } from "@/lib/seo";

export const metadata: Metadata = publicPageMetadata({
  title: "Pricing | Trade82",
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
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "홈", path: "/ko" },
          { name: "Pricing", path: "/ko/pricing" },
        ])}
      />
      <SellerMarketingPage initialSuccess={params.marketing === "success"} />
    </>
  );
}
