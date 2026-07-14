import type { Metadata } from "next";

import { DocumentRoutePage, documentRouteMetadata } from "@/components/document-route-page";

export const metadata: Metadata = documentRouteMetadata("ko", "terms");

export default function KoTermsPage() {
  return <DocumentRoutePage locale="ko" documentSlug="terms" />;
}
