import type { Metadata } from "next";

import { BackButton } from "@/components/back-button";
import { JsonLd } from "@/components/json-ld";
import { SellersSeoContent } from "@/components/public-marketplace-seo-content";
import { SellersClient } from "@/components/sellers-client";
import { breadcrumbJsonLd, publicPageMetadata } from "@/lib/seo";

export const metadata: Metadata = publicPageMetadata({
  title: "Sellers | Trade82",
  description:
    "Browse Korean seller companies and discover export-ready products on Trade82.",
  path: "/en/sellers",
  languages: {
    en: "/en/sellers",
    ko: "/ko/sellers",
  },
});

export default function EnSellersPage() {
  return (
    <div className="bm-grid-surface theme-bg">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/en" },
          { name: "Sellers", path: "/en/sellers" },
        ])}
      />
      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-6 sm:px-6 lg:px-8">
        <BackButton fallbackHref="/" />
        <SellersSeoContent locale="en" />
        <SellersClient />
      </div>
    </div>
  );
}
