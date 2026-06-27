import type { Metadata } from "next";

import { LegalDocumentPage, getLegalMetadata } from "@/components/legal-document-page";

export const metadata: Metadata = getLegalMetadata("en", "sourcingTerms");

export default function SourcingTermsPage() {
  return <LegalDocumentPage locale="en" documentKey="sourcingTerms" />;
}
