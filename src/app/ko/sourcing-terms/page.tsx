import type { Metadata } from "next";

import { LegalDocumentPage, getLegalMetadata } from "@/components/legal-document-page";

export const metadata: Metadata = getLegalMetadata("ko", "sourcingTerms");

export default function KoSourcingTermsPage() {
  return <LegalDocumentPage locale="ko" documentKey="sourcingTerms" />;
}
