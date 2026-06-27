import type { Metadata } from "next";

import { LegalDocumentPage, getLegalMetadata } from "@/components/legal-document-page";

export const metadata: Metadata = getLegalMetadata("en", "terms");

export default function TermsPage() {
  return <LegalDocumentPage locale="en" documentKey="terms" />;
}
