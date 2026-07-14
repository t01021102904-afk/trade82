import type { Metadata } from "next";

import { DocumentRoutePage, documentRouteMetadata } from "@/components/document-route-page";

export const metadata: Metadata = documentRouteMetadata("en", "export-shipping-guide");

export default function ExportShippingGuidePage() {
  return <DocumentRoutePage locale="en" documentSlug="export-shipping-guide" />;
}
