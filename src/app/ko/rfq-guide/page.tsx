import type { Metadata } from "next";

import { DocumentRoutePage, documentRouteMetadata } from "@/components/document-route-page";

export const metadata: Metadata = documentRouteMetadata("ko", "rfq-guide");

export default function KoRfqGuidePage() {
  return <DocumentRoutePage locale="ko" documentSlug="rfq-guide" />;
}
