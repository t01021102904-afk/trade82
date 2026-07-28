import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import en from "../messages/en.json" with { type: "json" };
import ko from "../messages/ko.json" with { type: "json" };
import { validateProductPricing } from "../src/lib/product-pricing-validation.ts";
import { formatProductPrice } from "../src/lib/product-price-display.ts";

const valid = {
  retailPrice: "52.00",
  wholesalePrice: "39.00",
  currency: "USD",
  moqQuantity: "100",
  moqUnit: "Units",
};

test("product creation rejects missing required commercial terms", () => {
  const result = validateProductPricing({ ...valid, retailPrice: "", wholesalePrice: "", currency: "", moqQuantity: "", moqUnit: "" });
  assert.deepEqual(result.errors, {
    retailPrice: "retailPriceRequired",
    wholesalePrice: "wholesalePriceRequired",
    currency: "currencyRequired",
    moqQuantity: "moqQuantityInvalid",
    moqUnit: "moqUnitRequired",
  });
});

test("product pricing rejects inverted prices and invalid MOQ, but accepts a complete listing", () => {
  assert.equal(validateProductPricing({ ...valid, wholesalePrice: "53" }).errors.wholesalePrice, "wholesaleExceedsRetail");
  assert.equal(validateProductPricing({ ...valid, moqQuantity: "0" }).errors.moqQuantity, "moqQuantityInvalid");
  assert.equal(validateProductPricing({ ...valid, moqQuantity: "-1" }).errors.moqQuantity, "moqQuantityInvalid");
  assert.deepEqual(validateProductPricing(valid).errors, {});
  assert.deepEqual(validateProductPricing({ ...valid, retailPrice: "39.99", wholesalePrice: "39.90" }).errors, {});
  assert.deepEqual(validateProductPricing({ ...valid, retailPrice: "0.01", wholesalePrice: "0.01" }).errors, {});
  for (const value of ["NaN", "Infinity", "", "0", "-1", "abc"]) {
    assert.equal(validateProductPricing({ ...valid, retailPrice: value }).errors.retailPrice, "retailPriceRequired");
  }
  for (const value of ["0", "-1", "1.5", "abc", ""]) {
    assert.equal(validateProductPricing({ ...valid, moqQuantity: value }).errors.moqQuantity, "moqQuantityInvalid");
  }
  assert.equal(formatProductPrice("39.9", "USD"), "USD 39.90");
  assert.equal(formatProductPrice("39.99", "USD"), "USD 39.99");
});

test("API routes validate merged values so legacy listings remain readable but cannot be saved incomplete", () => {
  const createRoute = readFileSync("src/app/api/account/products/route.ts", "utf8");
  const updateRoute = readFileSync("src/app/api/account/products/[id]/route.ts", "utf8");
  const migration = readFileSync("prisma/migrations/20260728180000_require_product_pricing_and_moq/migration.sql", "utf8");
  assert.match(createRoute, /validateProductPricing/);
  assert.match(updateRoute, /existing\.priceMax/);
  assert.match(updateRoute, /existing\.moqQuantity/);
  assert.match(migration, /NOT VALID/);
  assert.match(migration, /priceMin/);
  assert.match(migration, /priceMax/);
  assert.match(migration, /btrim\("currency"\) <> ''/);
  assert.match(migration, /btrim\("moqUnit"\) <> ''/);
  assert.match(migration, /\^\[1-9\]\[0-9\]\*\$/);
  assert.doesNotMatch(migration, /UPDATE\s+"Product"/i);
});

test("English and Korean field errors are available", () => {
  assert.equal(en.listing.errors.retailPriceRequired, "Retail price is required.");
  assert.equal(en.listing.errors.wholesaleExceedsRetail, "Wholesale price cannot exceed retail price.");
  assert.equal(ko.listing.errors.retailPriceRequired, "소비자가를 입력해 주세요.");
  assert.equal(ko.listing.errors.moqUnitRequired, "MOQ 단위를 선택해 주세요.");
});
