import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { readXlsx, writeXlsx } from "hucre/xlsx";

import {
  buildBulkProductTemplate,
  bulkProductColumns,
  bulkProductCreateData,
  bulkProductImportIdentity,
  BulkProductWorkbookError,
  parseBulkProductWorkbook,
  validateBulkProductRows,
} from "@/lib/bulk-product-registration";
import { BULK_PRODUCT_MAX_ROWS } from "@/lib/bulk-product-types";
import { validateBulkProductWorkbookFile } from "@/lib/bulk-product-upload";
import { defaultProductFieldVisibility } from "@/lib/product-field-visibility";

const root = process.cwd();

function source(path: string) {
  return readFileSync(`${root}/${path}`, "utf8");
}

async function loadWorkbook(buffer: Buffer) {
  return readXlsx(buffer, { readStyles: true });
}

async function workbookBuffer(rows: Array<Array<string | number | null>>) {
  return Buffer.from(
    await writeXlsx({
      sheets: [
        {
          name: "Products",
          rows: [
            [
              "Product name",
              "Category",
              "Detailed product description",
              "Retail price",
              "Wholesale price",
              "Currency",
              "MOQ quantity",
              "MOQ unit",
              "Sample availability",
            ],
            ...rows,
          ],
        },
      ],
    }),
  );
}

test("bulk template contains the required sheets and product columns", async () => {
  const buffer = await buildBulkProductTemplate("en");
  const workbook = await loadWorkbook(buffer);
  assert.ok(workbook.sheets.some((sheet) => sheet.name === "Products"));
  assert.ok(workbook.sheets.some((sheet) => sheet.name === "Instructions"));
  assert.ok(workbook.sheets.some((sheet) => sheet.name === "Options"));

  const products = workbook.sheets.find((sheet) => sheet.name === "Products");
  const headers = products?.rows[0];
  assert.ok(Array.isArray(headers));
  for (const expected of [
    "Product name *",
    "Category *",
    "Detailed product description *",
    "Retail price *",
    "Wholesale price *",
    "Currency *",
    "MOQ quantity *",
    "MOQ unit *",
  ]) {
    assert.ok(headers?.includes(expected), `missing ${expected}`);
  }
  assert.equal(products?.rows[1]?.[0], "[EXAMPLE - DELETE THIS ROW]");
  assert.ok((products?.dataValidations?.length ?? 0) > 0);
  assert.ok(bulkProductColumns.length > 40);
});

test("Korean template uses Korean headers and both templates remain parseable", async () => {
  const buffer = await buildBulkProductTemplate("ko");
  const workbook = await loadWorkbook(buffer);
  const products = workbook.sheets.find((sheet) => sheet.name === "Products");
  assert.ok(products?.rows[0]?.includes("상품명 *"));
  assert.ok(products?.rows[0]?.includes("소비자가 *"));
  assert.equal(products?.rows[1]?.[0], "[예시 - 이 행을 삭제하세요]");
  await assert.rejects(
    () => parseBulkProductWorkbook(buffer, "ko"),
    /등록할 상품 행이 없습니다/,
  );
});

test("bulk validation accepts a complete row and ignores blank rows", async () => {
  const buffer = await workbookBuffer([
    [null, null, null, null, null, null, null, null, null],
    [
      "Hydrating mask",
      "Beauty & Personal Care",
      "Hydrating sheet mask for wholesale buyers.",
      2.5,
      1.2,
      "USD",
      100,
      "Units",
      "Samples available",
    ],
    [null, null, null, null, null, null, null, null, null],
  ]);
  const rows = await parseBulkProductWorkbook(buffer, "en");
  assert.equal(rows.length, 1);
  const validation = validateBulkProductRows({ rows, locale: "en" });
  assert.equal(validation.errorRows, 0);
  assert.equal(validation.readyRows, 1);
  assert.equal(validation.rows[0].product.retailPrice, "2.5");
  assert.equal(validation.rows[0].product.wholesalePrice, "1.2");
  assert.equal(validation.rows[0].excelRow, 3);
});

test("bulk validation reports missing, numeric, and category errors by row", async () => {
  const buffer = await workbookBuffer([
    [
      "",
      "Not a category",
      "",
      "abc",
      -1,
      "USD",
      0,
      "Units",
      "Samples available",
    ],
  ]);
  const rows = await parseBulkProductWorkbook(buffer, "en");
  const validation = validateBulkProductRows({ rows, locale: "en" });
  assert.equal(validation.errorRows, 1);
  const fields = new Set(validation.rows[0].errors.map((issue) => issue.field));
  assert.ok(fields.has("name"));
  assert.ok(fields.has("category"));
  assert.ok(fields.has("detailedDescription"));
  assert.ok(fields.has("retailPrice"));
  assert.ok(fields.has("wholesalePrice"));
  assert.ok(fields.has("moqQuantity"));
  assert.equal(validation.rows[0].excelRow, 2);
});

test("bulk parser rejects formulas, invalid workbooks, and more than 200 rows", async () => {
  const formulaWorkbook = await writeXlsx({
    sheets: [
      {
        name: "Products",
        rows: [
          [
            "Product name",
            "Category",
            "Detailed product description",
            "Retail price",
            "Wholesale price",
            "Currency",
            "MOQ quantity",
            "MOQ unit",
            "Sample availability",
          ],
          [
            "Unsafe",
            "Beauty & Personal Care",
            "Description",
            2,
            1,
            "USD",
            10,
            "Units",
            "Samples available",
          ],
        ],
        cells: new Map([
          [
            "1,0",
            {
              value: "Unsafe",
              type: "formula",
              formula: '"Unsafe"',
              formulaResult: "Unsafe",
            },
          ],
        ]),
      },
    ],
  });
  const formulaRows = await parseBulkProductWorkbook(
    Buffer.from(formulaWorkbook),
    "en",
  );
  const formulaValidation = validateBulkProductRows({
    rows: formulaRows,
    locale: "en",
  });
  assert.ok(
    formulaValidation.rows[0].errors.some((issue) =>
      issue.message.includes("Formula"),
    ),
  );

  await assert.rejects(
    () => parseBulkProductWorkbook(Buffer.from("not xlsx"), "en"),
    BulkProductWorkbookError,
  );

  const tooManyRows = Array.from(
    { length: BULK_PRODUCT_MAX_ROWS + 1 },
    (_, index) => [
      `Product ${index}`,
      "Beauty & Personal Care",
      "Description",
      2,
      1,
      "USD",
      10,
      "Units",
      "Samples available",
    ],
  );
  await assert.rejects(
    () => workbookBuffer(tooManyRows).then((buffer) =>
      parseBulkProductWorkbook(buffer, "en"),
    ),
    /at most 200 products/,
  );
});

test("bulk rows warn for file and existing-catalog duplicates", async () => {
  const buffer = await workbookBuffer([
    [
      "Duplicate product",
      "Beauty & Personal Care",
      "Description",
      2,
      1,
      "USD",
      10,
      "Units",
      "Samples available",
    ],
    [
      "Duplicate product",
      "Beauty & Personal Care",
      "Description",
      2,
      1,
      "USD",
      10,
      "Units",
      "Samples available",
    ],
  ]);
  const rows = await parseBulkProductWorkbook(buffer, "en");
  const validation = validateBulkProductRows({
    rows,
    locale: "en",
    existingProductNames: ["duplicate product"],
  });
  assert.equal(validation.errorRows, 0);
  assert.equal(validation.warningRows, 2);
  assert.ok(validation.rows.every((row) => row.warnings.length === 2));
});

test("bulk workbook file rules reject invalid formats and oversize files", () => {
  assert.equal(
    validateBulkProductWorkbookFile(
      {
        name: "products.xlsx",
        size: 1024,
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
      "en",
    ),
    null,
  );
  assert.match(
    validateBulkProductWorkbookFile(
      { name: "products.csv", size: 1024, type: "text/csv" },
      "en",
    ) ?? "",
    /Only .xlsx/,
  );
  assert.match(
    validateBulkProductWorkbookFile(
      { name: "products.xlsx", size: 5 * 1024 * 1024 + 1, type: "" },
      "ko",
    ) ?? "",
    /5MB/,
  );
});

test("unsupported boolean options are reported instead of silently becoming false", async () => {
  const buffer = await writeXlsx({
    sheets: [
      {
        name: "Products",
        rows: [
          [
            "Product name",
            "Category",
            "Detailed product description",
            "Retail price",
            "Wholesale price",
            "Currency",
            "MOQ quantity",
            "MOQ unit",
            "Sample availability",
            "Export ready",
          ],
          [
            "Export product",
            "Beauty & Personal Care",
            "Description",
            2,
            1,
            "USD",
            10,
            "Units",
            "Samples available",
            "maybe",
          ],
        ],
      },
    ],
  });
  const rows = await parseBulkProductWorkbook(Buffer.from(buffer), "en");
  const validation = validateBulkProductRows({ rows, locale: "en" });
  assert.ok(
    validation.rows[0].errors.some(
      (issue) => issue.field === "exportReadiness",
    ),
  );
});

test("bulk imports are deterministic, seller scoped, and always inactive", () => {
  const first = bulkProductImportIdentity({
    companyId: "seller-company",
    idempotencyKey: "request_1234567890",
    rowIndex: 0,
  });
  const retry = bulkProductImportIdentity({
    companyId: "seller-company",
    idempotencyKey: "request_1234567890",
    rowIndex: 0,
  });
  const otherCompany = bulkProductImportIdentity({
    companyId: "other-company",
    idempotencyKey: "request_1234567890",
    rowIndex: 0,
  });
  assert.deepEqual(first, retry);
  assert.notEqual(first.id, otherCompany.id);

  const data = bulkProductCreateData({
    sellerCompanyId: "seller-company",
    id: first.id,
    slugSuffix: first.slugSuffix,
    product: {
      name: "Preparing product",
      nameEn: "",
      category: "Beauty & Personal Care",
      tags: [],
      tagsEn: [],
      shortDescription: "",
      shortDescriptionEn: "",
      detailedDescription: "Description",
      detailedDescriptionEn: "",
      retailPrice: "2",
      wholesalePrice: "1",
      currency: "USD",
      priceUnit: "unit",
      moqQuantity: "10",
      moqUnit: "Units",
      leadTime: "",
      sampleAvailability: "samples_available",
      privateLabelAvailability: "",
      monthlyCapacity: "",
      monthlyCapacityUnit: "unit",
      countryOfOrigin: "South Korea",
      shippingOriginCountry: "South Korea",
      shippingOriginRegion: "",
      incoterms: [],
      hsCode: "",
      shelfLife: "",
      storageRequirements: "",
      documentsAvailable: [],
      complianceClaims: [],
      buyerNotes: "",
      buyerNotesEn: "",
      packageSize: "",
      unitsPerCarton: "",
      cartonWeight: "",
      cartonDimensions: "",
      palletQuantity: "",
      storageTemperature: "",
      suggestedUsChannels: [],
      ingredientsOrMaterials: "",
      packaging: "",
      exportReadiness: false,
      fieldVisibility: defaultProductFieldVisibility,
    },
  });
  assert.equal(data.sellerCompanyId, "seller-company");
  assert.equal(data.status, "inactive");
  assert.equal(data.imageUrl, null);
  assert.match(data.slug, /-[a-f0-9]{12}-[a-f0-9]{8}$/);
});

test("bulk APIs reauthorize, revalidate, transact, and never trust a company id", () => {
  const templateRoute = source(
    "src/app/api/account/products/bulk/template/route.ts",
  );
  const validateRoute = source(
    "src/app/api/account/products/bulk/validate/route.ts",
  );
  const importRoute = source(
    "src/app/api/account/products/bulk/import/route.ts",
  );
  assert.match(templateRoute, /requireSeller\(\)/);
  assert.match(templateRoute, /spreadsheetml\.sheet/);
  assert.match(validateRoute, /assertSameOrigin\(request\)/);
  assert.match(validateRoute, /requireSeller\(\)/);
  assert.match(importRoute, /assertSameOrigin\(request\)/);
  assert.match(importRoute, /requireSeller\(\)/);
  assert.match(importRoute, /validateBulkProductRows/);
  assert.match(importRoute, /pg_advisory_xact_lock/);
  assert.match(importRoute, /status: "inactive"/);
  assert.match(importRoute, /where: \{ id: \{ in: ids \}, sellerCompanyId: company\.id \}/);
  assert.doesNotMatch(importRoute, /formData\.get\("companyId"\)/);
});

test("bulk UI exposes template, dropzone, preview, disabled import, and images", () => {
  const component = source("src/components/bulk-product-registration.tsx");
  const listing = source("src/components/listing-page.tsx");
  const table = source("src/components/seller-products-table.tsx");
  const sidebar = source("src/components/app-sidebar.tsx");
  assert.match(listing, /ProductRegistrationModeSwitch/);
  assert.match(component, /bulk\/template/);
  assert.match(component, /onDrop=/);
  assert.match(component, /overflow-x-auto/);
  assert.match(component, /min-w-\[1100px\]/);
  assert.match(component, /<Table/);
  assert.match(component, /disabled=\{hasErrors \|\| importing\}/);
  assert.match(component, /ListingImageUploader/);
  assert.match(component, /setPhase\("images"\)/);
  assert.match(component, /section=products/);
  assert.match(sidebar, /dashboard\/seller\/products\/bulk/);
  assert.doesNotMatch(table, /shortDescription/);
});
