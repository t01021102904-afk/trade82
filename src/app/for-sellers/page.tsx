import type { Metadata } from "next";

import { DocumentRoutePage, documentRouteMetadata } from "@/components/document-route-page";

export const metadata: Metadata = documentRouteMetadata("en", "for-sellers");

export default function ForSellersPage() {
  return <DocumentRoutePage locale="en" documentSlug="for-sellers" />;
}
