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
  path: "/ko/sellers",
  languages: {
    en: "/sellers",
    ko: "/ko/sellers",
  },
});

export default function KoSellersPage() {
  return (
    <div className="bm-grid-surface theme-bg">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "홈", path: "/ko" },
          { name: "셀러", path: "/ko/sellers" },
        ])}
      />
      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-6 sm:px-6 lg:px-8">
        <BackButton fallbackHref="/" />
        <SellersSeoContent locale="ko" />
        <SellersClient />
      </div>
    </div>
  );
}
