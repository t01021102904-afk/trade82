import type { Metadata } from "next";

import { LegalDocumentPage, getLegalMetadata } from "@/components/legal-document-page";

export const metadata: Metadata = getLegalMetadata("en", "privacy");

export default function PrivacyPage() {
  return <LegalDocumentPage locale="en" documentKey="privacy" />;
}
