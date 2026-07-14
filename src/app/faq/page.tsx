import type { Metadata } from "next";

import { DocumentRoutePage, documentRouteMetadata } from "@/components/document-route-page";

export const metadata: Metadata = documentRouteMetadata("en", "faq");

export default function FaqPage() {
  return <DocumentRoutePage locale="en" documentSlug="faq" />;
}
