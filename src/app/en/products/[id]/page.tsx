import type { Metadata } from "next";

import { DatabaseProductDetail } from "@/components/database-public-detail";
import { getProductShareMetadata } from "@/lib/product-share-metadata";

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

  return <DatabaseProductDetail id={id} />;
}
