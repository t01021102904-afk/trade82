import type { Metadata } from "next";

import { DocumentRoutePage, documentRouteMetadata } from "@/components/document-route-page";

export const metadata: Metadata = documentRouteMetadata("ko", "how-it-works");

export default function KoHowItWorksPage() {
  return <DocumentRoutePage locale="ko" documentSlug="how-it-works" />;
}
