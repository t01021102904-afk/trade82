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
  return getPublicCompanyMetadata({ id, localePrefix: "/ko", type: "buyer" });
}

export default async function KoBuyerDetailPage({
  params,
}: BuyerDetailPageProps) {
  const { id } = await params;

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "홈", path: "/ko" },
          { name: "바이어", path: "/ko/buyers" },
          { name: "바이어 프로필", path: `/ko/buyers/${encodeURIComponent(id)}` },
        ])}
      />
      <BuyerDetailPageContent id={id} locale="ko" />
    </>
  );
}
