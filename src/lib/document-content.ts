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
import { absoluteSiteUrl } from "@/lib/seo";

export {
  documentSlugs,
  getDocumentPath,
  isDocumentSlug,
  parseDocumentSource,
  type DocumentSlug,
  type ParsedDocument,
};
export type { DocumentBlock, DocumentSection } from "@/lib/document-parser";

const parsedDocumentCache = new Map<string, ParsedDocument>();

export function getDocumentMetadata(slug: DocumentSlug, locale: Locale) {
  const document = getDocument(slug, locale);

  return {
    title: `${document.title} | Trade82`,
    description: document.description,
    alternates: {
      canonical: absoluteSiteUrl(getDocumentPath(slug, locale)),
      languages: {
        en: absoluteSiteUrl(getDocumentPath(slug, "en")),
        ko: absoluteSiteUrl(getDocumentPath(slug, "ko")),
        "x-default": absoluteSiteUrl(getDocumentPath(slug, "en")),
      },
    },
  };
}

export function getDocument(slug: DocumentSlug, locale: Locale): ParsedDocument {
  const cacheKey = `${locale}:${slug}`;
  const cached = parsedDocumentCache.get(cacheKey);
  if (cached) return cached;

  const definition = documentDefinitions[slug];
  const fileName = locale === "ko" ? definition.koFileName : definition.enFileName;
  const source = readFileSync(
    path.join(process.cwd(), "src", "content", "documents", fileName),
    "utf8",
  );
  const parsed = parseDocumentSource(source, slug, definition.descriptions[locale]);
  parsedDocumentCache.set(cacheKey, parsed);
  return parsed;
}
