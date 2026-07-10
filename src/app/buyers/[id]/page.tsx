import type { Metadata } from "next";

import {
  BuyerDetailPageContent,
} from "@/components/buyer-detail-page";
import { JsonLd } from "@/components/json-ld";
import { getPublicCompanyMetadata } from "@/lib/public-company-metadata";
import { breadcrumbJsonLd } from "@/lib/seo";

export const dynamic = "force-dynamic";

type BuyerDetailPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({
  params,
}: BuyerDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  return getPublicCompanyMetadata({ id, type: "buyer" });
}

export default async function BuyerDetailPage({
  params,
}: BuyerDetailPageProps) {
  const { id } = await params;

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Buyers", path: "/buyers" },
          { name: "Buyer profile", path: `/buyers/${encodeURIComponent(id)}` },
        ])}
      />
      <BuyerDetailPageContent id={id} locale="en" />
    </>
  );
}
