import type { Metadata } from "next";

import { LegalDocumentPage, getLegalMetadata } from "@/components/legal-document-page";

export const metadata: Metadata = getLegalMetadata("ko", "terms");

export default function KoTermsPage() {
  return <LegalDocumentPage locale="ko" documentKey="terms" />;
}
