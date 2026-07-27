import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  HOMEPAGE_PROMOTION_IMAGE_MAX_BYTES,
  HOMEPAGE_PROMOTION_MAX_ITEMS,
  HOMEPAGE_PROMOTION_PDF_MAX_BYTES,
  validatePromotionDestination,
  validatePromotionUpload,
} from "../src/lib/homepage-promotion-validation.ts";

test("promotion destinations allow only internal paths and HTTPS", () => {
  assert.equal(validatePromotionDestination("/events/demo?q=1"), "/events/demo?q=1");
  assert.equal(
    validatePromotionDestination("https://events.example.com/path"),
    "https://events.example.com/path",
  );
  for (const value of [
    "//evil.example.com",
    "http://example.com",
    "javascript:alert(1)",
    "data:text/html,hello",
    "file:///tmp/a",
    "vbscript:msgbox(1)",
    "not a url",
  ]) {
    assert.throws(() => validatePromotionDestination(value), Response);
  }
});

test("promotion uploads validate extension, MIME, magic bytes, and limits", async () => {
  assert.equal(HOMEPAGE_PROMOTION_MAX_ITEMS, 10);
  assert.equal(HOMEPAGE_PROMOTION_IMAGE_MAX_BYTES, 8 * 1024 * 1024);
  assert.equal(HOMEPAGE_PROMOTION_PDF_MAX_BYTES, 25 * 1024 * 1024);

  const png = new File(
    [
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        "base64",
      ),
    ],
    "banner.png",
    { type: "image/png" },
  );
  const pdf = new File([Buffer.from("%PDF-1.7")], "brochure.pdf", {
    type: "application/pdf",
  });
  assert.equal((await validatePromotionUpload(png, "thumbnail")).mimeType, "image/png");
  assert.equal((await validatePromotionUpload(pdf, "pdf")).mimeType, "application/pdf");

  const svg = new File(["<svg/>"], "banner.svg", { type: "image/svg+xml" });
  await assert.rejects(validatePromotionUpload(svg, "thumbnail"), Response);
  const spoofed = new File(["not a PDF"], "brochure.pdf", {
    type: "application/pdf",
  });
  await assert.rejects(validatePromotionUpload(spoofed, "pdf"), Response);
});

test("admin APIs reauthorize writes, use same-origin checks, and serialize capacity/order", async () => {
  const [collection, item, order, data, migration, publicRoute] = await Promise.all([
    readFile(new URL("../src/app/api/admin/homepage-promotions/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/admin/homepage-promotions/[id]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/admin/homepage-promotions/order/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/homepage-promotions.ts", import.meta.url), "utf8"),
    readFile(new URL("../prisma/migrations/20260726120000_add_homepage_promotions/migration.sql", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/public/homepage-promotions/route.ts", import.meta.url), "utf8"),
  ]);
  for (const source of [collection, item, order]) {
    assert.match(source, /requireAdmin\(\)/);
    assert.match(source, /assertSameOrigin\(request\)/);
  }
  assert.match(data, /pg_advisory_xact_lock/);
  assert.match(data, /count\(\{[\s\S]*deletedAt: null/);
  assert.match(data, /take: HOMEPAGE_PROMOTION_MAX_ITEMS/);
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /REVOKE ALL PRIVILEGES/);
  assert.match(publicRoute, /Cache-Control/);
});

test("public DTO excludes admin and storage internals", async () => {
  const source = await readFile(
    new URL("../src/lib/homepage-promotions.ts", import.meta.url),
    "utf8",
  );
  const publicSelect = source.slice(source.indexOf("export async function listPublic"));
  assert.match(publicSelect, /altText:/);
  assert.match(publicSelect, /thumbnailUrl: true/);
  assert.doesNotMatch(publicSelect, /adminTitle: true/);
  assert.doesNotMatch(publicSelect, /createdByUserId: true/);
  assert.doesNotMatch(publicSelect, /StoragePath: true/);
});

test("public company and product details omit repetitive trade warning cards", async () => {
  const [detail, en, ko] = await Promise.all([
    readFile(new URL("../src/components/database-public-detail.tsx", import.meta.url), "utf8"),
    readFile(new URL("../messages/en.json", import.meta.url), "utf8"),
    readFile(new URL("../messages/ko.json", import.meta.url), "utf8"),
  ]);

  for (const key of [
    "company.tradeNote",
    "company.tradeNoteText",
    "productDetail.sellerProvidedNotice",
    "productDetail.importReviewReminder",
    "productDetail.importReminderText",
  ]) {
    assert.doesNotMatch(detail, new RegExp(key.replace(".", "\\.")));
  }

  for (const messageFile of [en, ko]) {
    assert.doesNotMatch(messageFile, /"tradeNote"/);
    assert.doesNotMatch(messageFile, /"tradeNoteText"/);
    assert.doesNotMatch(messageFile, /"sellerProvidedNotice"/);
    assert.doesNotMatch(messageFile, /"importReviewReminder"/);
  }

  assert.match(detail, /productDetail\.complianceDocuments/);
  assert.match(detail, /productDetail\.documents/);
  assert.match(detail, /productDetail\.compliance/);
  assert.match(detail, /productDetail\.sellerInformation/);
  assert.match(detail, /company\.productCategories/);
  assert.match(detail, /company\.certifications/);
  assert.match(detail, /const hasSellerSidebar/);
  assert.match(detail, /hasSellerSidebar \? "grid gap-5 lg:grid-cols-\[1fr_340px\]" : "grid gap-5"/);
});

test("carousel covers timing, pause, visibility, reduced motion, swipe, and safe links", async () => {
  const source = await readFile(
    new URL("../src/components/home-promotion-carousel.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /AUTOPLAY_INTERVAL_MS = 3_000/);
  assert.match(source, /TRANSITION_MS = 650/);
  assert.match(source, /setInterval\(\(\) => move\(1\), AUTOPLAY_INTERVAL_MS\)/);
  assert.match(source, /onMouseEnter/);
  assert.match(source, /focusWithin/);
  assert.match(source, /visibilitychange/);
  assert.match(source, /prefers-reduced-motion/);
  assert.match(source, /onPointerDown/);
  assert.match(source, /suppressLinkClick/);
  assert.match(source, /target="_blank"/);
  assert.match(source, /noopener noreferrer/);
  assert.match(source, /if \(!promotions\.length\) return null/);
  assert.match(source, /const multiple = promotions\.length > 1/);
});
