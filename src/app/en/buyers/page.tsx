import type { Metadata } from "next";

import { BuyersPageContent } from "@/components/buyers-page";
import { JsonLd } from "@/components/json-ld";
import { breadcrumbJsonLd, publicPageMetadata } from "@/lib/seo";

export const metadata: Metadata = publicPageMetadata({
  title: "Buyers | Trade82",
  description:
    "Browse global buyer profiles and sourcing interests on Trade82.",
  path: "/en/buyers",
  languages: {
    en: "/en/buyers",
    ko: "/ko/buyers",
  },
});

export default function EnBuyersPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/en" },
          { name: "Buyers", path: "/en/buyers" },
        ])}
      />
      <BuyersPageContent locale="en" />
    </>
  );
}
