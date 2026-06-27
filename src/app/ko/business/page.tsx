import type { Metadata } from "next";

import { LegalDocumentPage, getLegalMetadata } from "@/components/legal-document-page";

export const metadata: Metadata = getLegalMetadata("ko", "business");

export default function KoBusinessPage() {
  return <LegalDocumentPage locale="ko" documentKey="business" />;
}
