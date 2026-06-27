import type { Metadata } from "next";

import { LegalDocumentPage, getLegalMetadata } from "@/components/legal-document-page";

export const metadata: Metadata = getLegalMetadata("ko", "privacy");

export default function KoPrivacyPage() {
  return <LegalDocumentPage locale="ko" documentKey="privacy" />;
}
