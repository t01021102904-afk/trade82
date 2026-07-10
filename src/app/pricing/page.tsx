import type { Metadata } from "next";

import { SellerMarketingPage } from "@/components/seller-marketing-page";
import { publicPageMetadata } from "@/lib/seo";

export const metadata: Metadata = publicPageMetadata({
  title: "Trade82 Marketing | Trade82",
  description:
    "Promote your product on the Trade82 landing page and reach global buyers.",
  path: "/pricing",
  languages: {
    en: "/pricing",
    ko: "/ko/pricing",
  },
});

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ marketing?: string | string[] }>;
}) {
  const params = await searchParams;
  return <SellerMarketingPage initialSuccess={params.marketing === "success"} />;
}
