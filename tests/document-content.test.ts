import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  documentDefinitions,
  documentSlugs,
  getDocumentPath,
} from "../src/lib/document-registry.ts";
import { parseDocumentSource } from "../src/lib/document-parser.ts";

test("all supplied documents load with ordered, stable section anchors", () => {
  assert.equal(documentSlugs.length, 13);

  for (const slug of documentSlugs) {
    const definition = documentDefinitions[slug];
    const source = readFileSync(
      path.join(process.cwd(), "src", "content", "documents", definition.fileName),
      "utf8",
    );
    const document = parseDocumentSource(source, slug, definition.description);
    assert.ok(document.title.length > 0, `${slug} has a title`);
    assert.ok(document.sections.length > 0, `${slug} has sections`);
    assert.deepEqual(
      document.sections.map((section) => section.id),
      document.sections.map((_, index) => `section-${index + 1}`),
      `${slug} uses stable anchors`,
    );
  }
});

test("document locale paths preserve the shared section anchor scheme", () => {
  assert.equal(getDocumentPath("privacy", "en"), "/privacy");
  assert.equal(getDocumentPath("privacy", "ko"), "/ko/privacy");
  assert.equal(getDocumentPath("payment-refund-policy", "ko"), "/ko/payment-refund-policy");
});

test("the parser keeps headings, metadata, paragraphs, and lists as structured source content", () => {
  const document = parseDocumentSource(
    [
      "Example document",
      "Effective Date: July 14, 2026",
      "Last Updated: July 14, 2026",
      "",
      "Introduction copy.",
      "",
      "1. First section",
      "First paragraph.",
      "• First item",
      "• Second item",
      "",
      "2. Second section",
      "a. First subitem",
      "b. Second subitem",
    ].join("\n"),
    "about",
    "Example description",
  );

  assert.equal(document.title, "Example document");
  assert.equal(document.effectiveDate, "July 14, 2026");
  assert.equal(document.lastUpdated, "July 14, 2026");
  assert.equal(document.intro[0]?.type, "paragraph");
  assert.equal(document.sections[0]?.id, "section-1");
  assert.equal(document.sections[0]?.title, "1. First section");
  assert.equal(document.sections[0]?.blocks[1]?.type, "list");
  assert.equal(document.sections[1]?.blocks[0]?.type, "list");
});
