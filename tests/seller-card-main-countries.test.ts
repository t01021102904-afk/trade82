import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function source(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test("seller cards use the first two main export countries", () => {
  const card = source("src/components/seller-card.tsx");

  assert.match(card, /seller\.exportCountries\.slice\(0, 2\)/);
  assert.match(card, /sellers\.mainCountries/);
  assert.match(card, /UntitledRectangleCountryFlag/);
  assert.match(card, /localizedCountryLabel\(country, locale\)/);
  assert.doesNotMatch(card, /sellers\.products/);
  assert.doesNotMatch(card, /seller\.productCount/);
});

test("country flags use Untitled UI original Rectangle SVG assets", () => {
  const flag = source(
    "src/components/untitled-rectangle-country-flag.tsx",
  );
  const packageJson = JSON.parse(source("package.json"));
  const flagDirectory = path.join(
    root,
    "public/flags/rectangle",
  );
  const files = readdirSync(flagDirectory).filter((file) =>
    file.endsWith(".svg"),
  );

  assert.match(
    flag,
    /https:\/\/www\.untitledui\.com\/resources\/flag-icons/,
  );
  assert.match(flag, /`\/flags\/rectangle\/\$\{code\}\.svg`/);
  assert.match(flag, /width=\{21\}/);
  assert.match(flag, /height=\{14\}/);
  assert.match(flag, /unoptimized/);
  assert.match(flag, /untitledRectangleFlagCodes/);
  assert.match(flag, /availableFlagCodes\.has\(code\)/);
  assert.doesNotMatch(flag, /@untitledui\/country-flags/);
  assert.doesNotMatch(flag, /scale-\[0\.833333\]/);

  assert.equal(
    packageJson.dependencies?.["@untitledui/country-flags"],
    undefined,
  );
  assert.ok(files.length >= 200);
  assert.equal(
    existsSync(
      path.join(
        root,
        "src/lib/untitled-rectangle-flag-codes.ts",
      ),
    ),
    true,
  );

  for (const code of ["US", "KR", "JP"]) {
    const relativePath = `public/flags/rectangle/${code}.svg`;
    assert.equal(existsSync(path.join(root, relativePath)), true);
    assert.match(source(relativePath), /<svg/i);
  }

  assert.match(
    source("public/flags/rectangle/SOURCE.txt"),
    /www\.untitledui\.com\/resources\/flag-icons/,
  );
});

test("main-country translations remain available", () => {
  const en = JSON.parse(source("messages/en.json"));
  const ko = JSON.parse(source("messages/ko.json"));

  assert.equal(en.sellers.mainCountries, "Main countries");
  assert.equal(ko.sellers.mainCountries, "주요 국가");
});
