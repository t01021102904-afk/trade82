import { DocumentPageLayout } from "@/components/document-page-layout";
import {
  getDocument,
  getDocumentPath,
  type DocumentSlug,
} from "@/lib/document-content";
import type { Locale } from "@/lib/i18n";

export function DocumentPage({
  locale,
  documentSlug,
}: {
  locale: Locale;
  documentSlug: DocumentSlug;
}) {
  const document = getDocument(documentSlug, locale);
  const alternateLocale = locale === "ko" ? "en" : "ko";

  return (
    <DocumentPageLayout
      document={document}
      locale={locale}
      alternateHref={getDocumentPath(documentSlug, alternateLocale)}
    />
  );
}
