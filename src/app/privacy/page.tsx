import type { Metadata } from "next";

import { DocumentRoutePage, documentRouteMetadata } from "@/components/document-route-page";

export const metadata: Metadata = documentRouteMetadata("en", "privacy");

export default function PrivacyPage() {
  return <DocumentRoutePage locale="en" documentSlug="privacy" />;
}
