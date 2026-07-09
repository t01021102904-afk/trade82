import type { Metadata } from "next";

import { BackButton } from "@/components/back-button";
import { SellersSeoContent } from "@/components/public-marketplace-seo-content";
import { SellersClient } from "@/components/sellers-client";
import { publicPageMetadata } from "@/lib/seo";

export const metadata: Metadata = publicPageMetadata({
  title: "Sellers | Trade82",
  description:
    "Browse Korean seller companies and discover export-ready products on Trade82.",
  path: "/sellers",
  languages: {
    en: "/sellers",
    ko: "/ko/sellers",
  },
});

export default function SellersPage() {
  return (
    <div className="bm-grid-surface theme-bg">
      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-6 sm:px-6 lg:px-8">
        <BackButton fallbackHref="/" />
        <SellersSeoContent locale="en" />
        <SellersClient />
      </div>
    </div>
  );
}
