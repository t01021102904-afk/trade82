import type { Metadata } from "next";

import { DatabaseProductDetail } from "@/components/database-public-detail";
import { getProductShareMetadata } from "@/lib/product-share-metadata";

export const dynamic = "force-dynamic";

export type ProductDetailPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateProductPageMetadata(
  { params }: ProductDetailPageProps,
  localePrefix = "",
): Promise<Metadata> {
  const { id } = await params;
  return getProductShareMetadata(id, localePrefix);
}

export async function generateMetadata(
  props: ProductDetailPageProps,
): Promise<Metadata> {
  return generateProductPageMetadata(props);
}

export default async function ProductDetailPage({
  params,
}: ProductDetailPageProps) {
  const { id } = await params;

  return <DatabaseProductDetail id={id} />;
}
