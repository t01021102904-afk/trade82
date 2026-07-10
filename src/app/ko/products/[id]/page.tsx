import type { Metadata } from "next";

import { DatabaseProductDetail } from "@/components/database-public-detail";
import { JsonLd } from "@/components/json-ld";
import {
  getProductShareMetadata,
  getProductStructuredData,
} from "@/lib/product-share-metadata";
import { breadcrumbJsonLd } from "@/lib/seo";

export const dynamic = "force-dynamic";

type ProductDetailPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata(
  { params }: ProductDetailPageProps,
): Promise<Metadata> {
  const { id } = await params;
  return getProductShareMetadata(id, "/ko");
}

export default async function ProductDetailPage({
  params,
}: ProductDetailPageProps) {
  const { id } = await params;
  const productJsonLd = await getProductStructuredData(id, "/ko");

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "홈", path: "/ko" },
          { name: "마켓플레이스", path: "/ko/marketplace" },
          { name: "상품", path: `/ko/products/${encodeURIComponent(id)}` },
        ])}
      />
      {productJsonLd ? <JsonLd data={productJsonLd} /> : null}
      <DatabaseProductDetail id={id} />
    </>
  );
}
