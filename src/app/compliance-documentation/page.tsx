import type { Metadata } from "next";

import { DocumentRoutePage, documentRouteMetadata } from "@/components/document-route-page";

export const metadata: Metadata = documentRouteMetadata("en", "compliance-documentation");

export default function ComplianceDocumentationPage() {
  return <DocumentRoutePage locale="en" documentSlug="compliance-documentation" />;
}
