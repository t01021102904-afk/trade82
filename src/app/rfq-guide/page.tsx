import type { Metadata } from "next";

import { DocumentRoutePage, documentRouteMetadata } from "@/components/document-route-page";

export const metadata: Metadata = documentRouteMetadata("en", "rfq-guide");

export default function RfqGuidePage() {
  return <DocumentRoutePage locale="en" documentSlug="rfq-guide" />;
}
