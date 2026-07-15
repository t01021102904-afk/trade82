import type { Metadata } from "next";

import { DocumentRoutePage, documentRouteMetadata } from "@/components/document-route-page";

export const metadata: Metadata = documentRouteMetadata("en", "how-it-works");

export default function HowItWorksPage() {
  return <DocumentRoutePage locale="en" documentSlug="how-it-works" />;
}
