import type { Metadata } from "next";

import { DocumentRoutePage, documentRouteMetadata } from "@/components/document-route-page";

export const metadata: Metadata = documentRouteMetadata("en", "for-buyers");

export default function ForBuyersPage() {
  return <DocumentRoutePage locale="en" documentSlug="for-buyers" />;
}
