import type { Metadata } from "next";

import { DocumentRoutePage, documentRouteMetadata } from "@/components/document-route-page";

export const metadata: Metadata = documentRouteMetadata("ko", "partner-program");

export default function KoPartnerProgramPage() {
  return <DocumentRoutePage locale="ko" documentSlug="partner-program" />;
}
