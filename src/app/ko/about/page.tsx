import type { Metadata } from "next";

import { DocumentRoutePage, documentRouteMetadata } from "@/components/document-route-page";

export const metadata: Metadata = documentRouteMetadata("ko", "about");

export default function KoAboutPage() {
  return <DocumentRoutePage locale="ko" documentSlug="about" />;
}
