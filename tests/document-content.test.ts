import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { getDocument, getDocumentMetadata } from "../src/lib/document-content.ts";
import {
  documentDefinitions,
  documentSlugs,
  getDocumentPath,
} from "../src/lib/document-registry.ts";
import { parseDocumentSource } from "../src/lib/document-parser.ts";

const documentsDirectory = path.join(process.cwd(), "src", "content", "documents");

const englishSourceHashes = {
  about: "e6b804039df3374404f32755c8ed46443f87fcca9ebd9e527d91cad228cc8b9e",
  "how-it-works": "5324bf71525039ad280c02d80b4abd4cc4f58f7e7b4944c3e4b946e486853cef",
  "for-sellers": "444542af12a9cf997580ec989d328d20e8029c72adbf087cf0206d92066f8fe3",
  "for-buyers": "8c208d582e2b0000d653143917ea1cc4d62c5860fbb75359ce36669fa9d54c50",
  "partner-program": "902959fa051df6dc92cd780d01746334827aff70c6138e124038285eea9aef39",
  "product-registration-guide": "9c0c1c7de2c840d2efec38849ac18a9314de80b662d1256e3a6a563cc992ffac",
  "rfq-guide": "fa36972afc19d34030026297523bb500b3155250427316d101a57b5598d0f13f",
  "export-shipping-guide": "29184a939e5ea08ccfa813c9006a4e6724518bf1eef3dc75e7af5ca2a7263c56",
  "compliance-documentation": "931bc15f49fc0a6e4f4688488b5bf79c97c387ec186a7e8e67bf54b5e841cd32",
  faq: "f55a2fba70786ddce8d1f73b61c0d237a953bfa6bb5bc9e9232eb407391841ff",
  privacy: "8a4fc2f1d7f869a8f535d036c394d41983921991fcbc6b5cdf628206d8f35627",
  terms: "3264d6b1c44e631620634db2d2456d090c845c6a8dfbd99d6689bd841a4dbefe",
  "payment-refund-policy": "13306d2edc25fdb37f7506950a43033f63d73bfbce30524d909605910a5bb7f2",
} as const;

const koreanLegalSourceHashes = {
  privacy: "de34bc320292edf61a972743b0bce08a2327d8f50a95338669e1bf21e19d4b2c",
  terms: "4936c489485504ac704b89341b002992585f62d952c9412c053af7da87b35be7",
  "payment-refund-policy": "9b20d0da3df3fcef57b00b258d4886a7f51ea524f0df71aa2a79c6b90e428045",
} as const;

function readDocumentFile(fileName: string) {
  return readFileSync(path.join(documentsDirectory, fileName), "utf8");
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

test("all supplied documents have locale-specific files and stable matching section anchors", () => {
  assert.equal(documentSlugs.length, 13);

  for (const slug of documentSlugs) {
    const definition = documentDefinitions[slug];
    const englishSource = readDocumentFile(definition.enFileName);
    const koreanSource = readDocumentFile(definition.koFileName);
    const englishDocument = parseDocumentSource(
      englishSource,
      slug,
      definition.descriptions.en,
    );
    const koreanDocument = parseDocumentSource(
      koreanSource,
      slug,
      definition.descriptions.ko,
    );

    assert.ok(englishDocument.title.length > 0, `${slug} English title`);
    assert.match(koreanDocument.title, /[가-힣]/, `${slug} Korean title`);
    assert.ok(englishDocument.sections.length > 0, `${slug} English sections`);
    assert.equal(
      koreanDocument.sections.length,
      englishDocument.sections.length,
      `${slug} preserves its section count across locales`,
    );
    assert.deepEqual(
      englishDocument.sections.map((section) => section.id),
      englishDocument.sections.map((_, index) => `section-${index + 1}`),
      `${slug} English anchors are stable`,
    );
    assert.deepEqual(
      koreanDocument.sections.map((section) => section.id),
      englishDocument.sections.map((section) => section.id),
      `${slug} Korean anchors match English anchors`,
    );
    assert.equal(sha256(englishSource), englishSourceHashes[slug], `${slug} English source is unchanged`);
  }
});

test("the three supplied Korean legal texts remain byte-for-byte unchanged", () => {
  for (const [slug, expectedHash] of Object.entries(koreanLegalSourceHashes)) {
    const definition = documentDefinitions[slug as keyof typeof koreanLegalSourceHashes];
    assert.equal(sha256(readDocumentFile(definition.koFileName)), expectedHash, `${slug} Korean source`);
  }
});

test("getDocument keeps parsed documents separate by locale", () => {
  const english = getDocument("payment-refund-policy", "en");
  const korean = getDocument("payment-refund-policy", "ko");

  assert.notStrictEqual(english, korean);
  assert.equal(english.title, "Trade82 Payment and Refund Policy");
  assert.equal(korean.title, "Trade82 결제 및 환불 정책");
  assert.equal(/Payment and Refund Policy/.test(korean.title), false);
  assert.strictEqual(getDocument("payment-refund-policy", "en"), english);
  assert.strictEqual(getDocument("payment-refund-policy", "ko"), korean);

  const englishMetadata = getDocumentMetadata("payment-refund-policy", "en");
  const koreanMetadata = getDocumentMetadata("payment-refund-policy", "ko");
  assert.equal(englishMetadata.title, "Trade82 Payment and Refund Policy | Trade82");
  assert.equal(koreanMetadata.title, "Trade82 결제 및 환불 정책 | Trade82");
  assert.equal(koreanMetadata.description, "Trade82 결제 및 환불 정책입니다.");
});

test("document locale paths preserve the shared section anchor scheme", () => {
  assert.equal(getDocumentPath("privacy", "en"), "/privacy");
  assert.equal(getDocumentPath("privacy", "ko"), "/ko/privacy");
  assert.equal(getDocumentPath("payment-refund-policy", "ko"), "/ko/payment-refund-policy");
});

test("the parser keeps headings, Korean metadata, paragraphs, and lists as structured source content", () => {
  const document = parseDocumentSource(
    [
      "# 예시 문서",
      "**시행일:** 2026년 7월 14일",
      "**최종 업데이트:** 2026년 7월 14일",
      "",
      "소개 문구입니다.",
      "",
      "## 1. 첫 번째 섹션",
      "첫 번째 문단입니다.",
      "• 첫 번째 항목",
      "• 두 번째 항목",
      "",
      "## 2. 두 번째 섹션",
      "가. 첫 번째 하위 항목",
      "나. 두 번째 하위 항목",
    ].join("\n"),
    "about",
    "예시 설명",
  );

  assert.equal(document.title, "예시 문서");
  assert.equal(document.effectiveDate, "2026년 7월 14일");
  assert.equal(document.lastUpdated, "2026년 7월 14일");
  assert.equal(document.intro[0]?.type, "paragraph");
  assert.equal(document.sections[0]?.id, "section-1");
  assert.equal(document.sections[0]?.title, "1. 첫 번째 섹션");
  assert.equal(document.sections[0]?.blocks[1]?.type, "list");
  assert.equal(document.sections[1]?.blocks[0]?.type, "list");
});
