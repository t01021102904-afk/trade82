import type { Metadata } from "next";

import { DocumentRoutePage, documentRouteMetadata } from "@/components/document-route-page";

export const metadata: Metadata = documentRouteMetadata("ko", "compliance-documentation");

export default function KoComplianceDocumentationPage() {
  return <DocumentRoutePage locale="ko" documentSlug="compliance-documentation" />;
}
