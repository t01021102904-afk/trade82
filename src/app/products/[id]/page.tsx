import type { Metadata } from "next";

import { DatabaseProductDetail } from "@/components/database-public-detail";
import { JsonLd } from "@/components/json-ld";
import {
  getProductShareMetadata,
  getProductStructuredData,
} from "@/lib/product-share-metadata";
import { breadcrumbJsonLd } from "@/lib/seo";

export const dynamic = "force-dynamic";

export type ProductDetailPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata(
  { params }: ProductDetailPageProps,
): Promise<Metadata> {
  const { id } = await params;
  return getProductShareMetadata(id);
}

export default async function ProductDetailPage({
  params,
}: ProductDetailPageProps) {
  const { id } = await params;
  const productJsonLd = await getProductStructuredData(id);

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Marketplace", path: "/marketplace" },
          { name: "Product", path: `/products/${encodeURIComponent(id)}` },
        ])}
      />
      {productJsonLd ? <JsonLd data={productJsonLd} /> : null}
      <DatabaseProductDetail id={id} />
    </>
  );
}
