import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";

import {
  documentDefinitions,
  documentSlugs,
  getDocumentPath,
  isDocumentSlug,
  type DocumentSlug,
} from "@/lib/document-registry";
import { parseDocumentSource, type ParsedDocument } from "@/lib/document-parser";
import type { Locale } from "@/lib/i18n";

export {
  documentSlugs,
  getDocumentPath,
  isDocumentSlug,
  parseDocumentSource,
  type DocumentSlug,
  type ParsedDocument,
};
export type { DocumentBlock, DocumentSection } from "@/lib/document-parser";

const parsedDocumentCache = new Map<DocumentSlug, ParsedDocument>();

export function getDocumentMetadata(slug: DocumentSlug, locale: Locale) {
  const document = getDocument(slug);

  return {
    title: `${document.title} | Trade82`,
    description: document.description,
    alternates: {
      canonical: getDocumentPath(slug, locale),
      languages: {
        en: getDocumentPath(slug, "en"),
        ko: getDocumentPath(slug, "ko"),
      },
    },
  };
}

export function getDocument(slug: DocumentSlug): ParsedDocument {
  const cached = parsedDocumentCache.get(slug);
  if (cached) return cached;

  const definition = documentDefinitions[slug];
  const source = readFileSync(
    path.join(process.cwd(), "src", "content", "documents", definition.fileName),
    "utf8",
  );
  const parsed = parseDocumentSource(source, slug, definition.description);
  parsedDocumentCache.set(slug, parsed);
  return parsed;
}
