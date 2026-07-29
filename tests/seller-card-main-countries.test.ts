import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function source(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test("seller cards replace product count with the first two export countries", () => {
  const card = source("src/components/seller-card.tsx");
  const flag = source(
    "src/components/untitled-rectangle-country-flag.tsx",
  );
  const presenter = source("src/lib/public-marketplace-presenters.ts");
  const packageJson = JSON.parse(source("package.json"));
  const en = JSON.parse(source("messages/en.json"));
  const ko = JSON.parse(source("messages/ko.json"));

  assert.match(card, /seller\.exportCountries\.slice\(0, 2\)/);
  assert.match(card, /sellers\.mainCountries/);
  assert.match(card, /UntitledRectangleCountryFlag/);
  assert.match(card, /localizedCountryLabel\(country, locale\)/);
  assert.doesNotMatch(card, /sellers\.products/);
  assert.doesNotMatch(card, /seller\.productCount/);

  assert.match(flag, /@untitledui\/country-flags/);
  assert.match(flag, /`Flag\$\{code\.charAt\(0\)\}/);
  assert.match(flag, /data-slot="untitled-rectangle-country-flag"/);
  assert.match(flag, /h-3\.5 w-5/);
  assert.match(flag, /overflow-hidden/);
  assert.match(flag, /size=\{24\}/);
  assert.match(flag, /scale-\[0\.833333\]/);

  assert.match(
    presenter,
    /exportCountries: \(profile\.exportCountries as string\[\]\) \?\? \[\]/,
  );
  assert.equal(
    packageJson.dependencies["@untitledui/country-flags"],
    "0.0.17",
  );
  assert.equal(en.sellers.mainCountries, "Main countries");
  assert.equal(ko.sellers.mainCountries, "주요 국가");
});
