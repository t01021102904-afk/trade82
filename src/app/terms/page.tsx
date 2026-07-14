import type { Metadata } from "next";

import { DocumentRoutePage, documentRouteMetadata } from "@/components/document-route-page";

export const metadata: Metadata = documentRouteMetadata("en", "terms");

export default function TermsPage() {
  return <DocumentRoutePage locale="en" documentSlug="terms" />;
}
