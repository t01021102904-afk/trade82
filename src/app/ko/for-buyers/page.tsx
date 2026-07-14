import type { Metadata } from "next";

import { DocumentRoutePage, documentRouteMetadata } from "@/components/document-route-page";

export const metadata: Metadata = documentRouteMetadata("ko", "for-buyers");

export default function KoForBuyersPage() {
  return <DocumentRoutePage locale="ko" documentSlug="for-buyers" />;
}
