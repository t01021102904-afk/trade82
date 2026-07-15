import type { Metadata } from "next";

import { DocumentPage } from "@/components/document-page";
import { getDocumentMetadata, type DocumentSlug } from "@/lib/document-content";
import type { Locale } from "@/lib/i18n";

export function documentRouteMetadata(locale: Locale, documentSlug: DocumentSlug): Metadata {
  return getDocumentMetadata(documentSlug, locale);
}

export function DocumentRoutePage({
  locale,
  documentSlug,
}: {
  locale: Locale;
  documentSlug: DocumentSlug;
}) {
  return <DocumentPage locale={locale} documentSlug={documentSlug} />;
}
