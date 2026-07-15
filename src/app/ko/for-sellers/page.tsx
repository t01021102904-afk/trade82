import type { Metadata } from "next";

import { DocumentRoutePage, documentRouteMetadata } from "@/components/document-route-page";

export const metadata: Metadata = documentRouteMetadata("ko", "for-sellers");

export default function KoForSellersPage() {
  return <DocumentRoutePage locale="ko" documentSlug="for-sellers" />;
}
