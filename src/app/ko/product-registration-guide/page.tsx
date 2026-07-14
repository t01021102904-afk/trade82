import type { Metadata } from "next";

import { DocumentRoutePage, documentRouteMetadata } from "@/components/document-route-page";

export const metadata: Metadata = documentRouteMetadata("ko", "product-registration-guide");

export default function KoProductRegistrationGuidePage() {
  return <DocumentRoutePage locale="ko" documentSlug="product-registration-guide" />;
}
