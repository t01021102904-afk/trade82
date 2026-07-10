import type { Metadata } from "next";

import { BuyersPageContent } from "@/components/buyers-page";
import { JsonLd } from "@/components/json-ld";
import { breadcrumbJsonLd, publicPageMetadata } from "@/lib/seo";

export const metadata: Metadata = publicPageMetadata({
  title: "Buyers | Trade82",
  description:
    "Browse global buyer profiles and sourcing interests on Trade82.",
  path: "/buyers",
  languages: {
    en: "/buyers",
    ko: "/ko/buyers",
  },
});

export default function BuyersPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Buyers", path: "/buyers" },
        ])}
      />
      <BuyersPageContent locale="en" />
    </>
  );
}
