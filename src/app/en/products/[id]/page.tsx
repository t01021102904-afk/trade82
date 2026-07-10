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
  return getProductShareMetadata(id, "/en");
}

export default async function ProductDetailPage({
  params,
}: ProductDetailPageProps) {
  const { id } = await params;
  const productJsonLd = await getProductStructuredData(id, "/en");

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/en" },
          { name: "Marketplace", path: "/en/marketplace" },
          { name: "Product", path: `/en/products/${encodeURIComponent(id)}` },
        ])}
      />
      {productJsonLd ? <JsonLd data={productJsonLd} /> : null}
      <DatabaseProductDetail id={id} />
    </>
  );
}
