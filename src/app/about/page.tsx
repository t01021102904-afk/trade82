import type { Metadata } from "next";

import { DocumentRoutePage, documentRouteMetadata } from "@/components/document-route-page";

export const metadata: Metadata = documentRouteMetadata("en", "about");

export default function AboutPage() {
  return <DocumentRoutePage locale="en" documentSlug="about" />;
}
