import type { Metadata } from "next";

import { DocumentRoutePage, documentRouteMetadata } from "@/components/document-route-page";

export const metadata: Metadata = documentRouteMetadata("ko", "faq");

export default function KoFaqPage() {
  return <DocumentRoutePage locale="ko" documentSlug="faq" />;
}
