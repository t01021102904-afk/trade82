import type { Metadata } from "next";

import { DocumentRoutePage, documentRouteMetadata } from "@/components/document-route-page";

export const metadata: Metadata = documentRouteMetadata("ko", "export-shipping-guide");

export default function KoExportShippingGuidePage() {
  return <DocumentRoutePage locale="ko" documentSlug="export-shipping-guide" />;
}
