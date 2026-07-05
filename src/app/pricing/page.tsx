import type { Metadata } from "next";

import { SellerSupportPricingPage } from "@/components/seller-support-pricing-page";
import { publicPageMetadata } from "@/lib/seo";

export const metadata: Metadata = publicPageMetadata({
  title: "Seller Support Pricing | Trade82",
  description:
    "Choose a Trade82 Seller Support plan for U.S. buyer-facing copy, inquiry replies, and product page improvements.",
  path: "/pricing",
  languages: {
    en: "/pricing",
    ko: "/ko/pricing",
  },
});

export default function PricingPage() {
  return <SellerSupportPricingPage />;
}
