import type { Metadata } from "next";

import { LegalDocumentPage, getLegalMetadata } from "@/components/legal-document-page";

export const metadata: Metadata = getLegalMetadata("en", "business");

export default function BusinessPage() {
  return <LegalDocumentPage locale="en" documentKey="business" />;
}
