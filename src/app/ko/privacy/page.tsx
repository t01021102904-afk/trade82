import type { Metadata } from "next";

import { DocumentRoutePage, documentRouteMetadata } from "@/components/document-route-page";

export const metadata: Metadata = documentRouteMetadata("ko", "privacy");

export default function KoPrivacyPage() {
  return <DocumentRoutePage locale="ko" documentSlug="privacy" />;
}
