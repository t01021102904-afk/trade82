import type { Metadata } from "next";

import { DocumentRoutePage, documentRouteMetadata } from "@/components/document-route-page";

export const metadata: Metadata = documentRouteMetadata("en", "product-registration-guide");

export default function ProductRegistrationGuidePage() {
  return <DocumentRoutePage locale="en" documentSlug="product-registration-guide" />;
}
