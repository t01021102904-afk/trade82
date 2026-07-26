import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  countryLookupKeys,
  normalizeCountry,
} from "../src/lib/country-normalization.ts";
import { getSignedInHeaderAction } from "../src/lib/public-navigation.ts";

test("country aliases normalize to stable ISO codes and canonical labels", () => {
  for (const value of ["USA", "US", "U.S.A.", "United States"]) {
    assert.deepEqual(normalizeCountry(value), {
      code: "US",
      label: "United States",
      original: value,
    });
  }
  for (const value of ["UK", "GB", "United Kingdom"]) {
    assert.equal(normalizeCountry(value).code, "GB");
  }
  for (const value of ["Hong Kong", "Hong Kong(China)"]) {
    assert.equal(normalizeCountry(value).code, "HK");
  }
  for (const value of ["South Korea", "Korea, South", "Republic of Korea"]) {
    assert.equal(normalizeCountry(value).code, "KR");
  }
  assert.equal(normalizeCountry("UAE").code, "AE");
  assert.deepEqual(normalizeCountry("Atlantis"), {
    code: null,
    label: "Atlantis",
    original: "Atlantis",
  });
  assert.ok(countryLookupKeys("USA").includes("unitedstates"));
});

test("signed-in header actions follow seller-first both-role priority", () => {
  assert.deepEqual(
    getSignedInHeaderAction({
      role: "seller",
      isAdmin: false,
      isPartnerOnly: false,
    }),
    { href: "/sell", labelKey: "nav.listProduct" },
  );
  assert.deepEqual(
    getSignedInHeaderAction({
      role: "both",
      isAdmin: false,
      isPartnerOnly: false,
    }),
    { href: "/sell", labelKey: "nav.listProduct" },
  );
  assert.deepEqual(
    getSignedInHeaderAction({
      role: "buyer",
      isAdmin: false,
      isPartnerOnly: false,
    }),
    { href: "/dashboard/rfqs/new", labelKey: "nav.createRfq" },
  );
  for (const input of [
    { role: "user" as const, isAdmin: false, isPartnerOnly: false },
    { role: "admin" as const, isAdmin: true, isPartnerOnly: false },
    { role: "seller" as const, isAdmin: false, isPartnerOnly: true },
  ]) {
    assert.equal(getSignedInHeaderAction(input), null);
  }
});

test("country flags are local SVG graphics and never emoji text", async () => {
  const [flag, countrySelect, sellers, detail, layout, notice] = await Promise.all([
    readFile(new URL("../src/components/country-flag.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/country-filter-select.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/sellers-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/database-public-detail.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../THIRD_PARTY_NOTICES.md", import.meta.url), "utf8"),
  ]);
  const source = [flag, sellers, detail].join("\n");
  assert.match(flag, /fi-\$\{code\.toLowerCase\(\)\}/);
  assert.match(layout, /flag-icons\/css\/flag-icons\.min\.css/);
  assert.match(sellers, /CountryFilterSelect/);
  assert.match(countrySelect, /aria-labelledby=\{labelId\}/);
  assert.match(countrySelect, /aria-controls=\{listboxId\}/);
  assert.match(detail, /company\.mainExportMarkets/);
  assert.doesNotMatch(source, /[\u{1F1E6}-\u{1F1FF}]{2}/u);
  assert.match(notice, /MIT/);
});

test("category cards match their baked near-white image canvas without clipping", async () => {
  const source = await readFile(
    new URL("../src/components/home-category-visual-scroller.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /home-category-visual-item[\s\S]*bg-white/);
  assert.match(source, /focus-visible:ring-2/);
  assert.match(source, /<Link/);
  assert.doesNotMatch(source, /mix-blend-/);
  assert.doesNotMatch(source, /hover:bg-zinc-50/);
});
