import type { Metadata } from "next";

import { DocumentRoutePage, documentRouteMetadata } from "@/components/document-route-page";

export const metadata: Metadata = documentRouteMetadata("en", "partner-program");

export default function PartnerProgramPage() {
  return <DocumentRoutePage locale="en" documentSlug="partner-program" />;
}
