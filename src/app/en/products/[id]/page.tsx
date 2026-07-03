import type { Metadata } from "next";

import ProductDetailPage, {
  generateProductPageMetadata,
  type ProductDetailPageProps,
} from "../../../products/[id]/page";

export const dynamic = "force-dynamic";

export async function generateMetadata(
  props: ProductDetailPageProps,
): Promise<Metadata> {
  return generateProductPageMetadata(props, "/en");
}

export default ProductDetailPage;
