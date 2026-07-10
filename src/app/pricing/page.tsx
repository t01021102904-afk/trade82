import type { Metadata } from "next";

import { JsonLd } from "@/components/json-ld";
import { SellerMarketingPage } from "@/components/seller-marketing-page";
import { breadcrumbJsonLd, publicPageMetadata } from "@/lib/seo";

export const metadata: Metadata = publicPageMetadata({
  title: "Pricing | Trade82",
  description:
    "View Trade82 pricing for product marketing exposure and seller growth tools.",
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
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Pricing", path: "/pricing" },
        ])}
      />
      <SellerMarketingPage initialSuccess={params.marketing === "success"} />
    </>
  );
}
