import assert from "node:assert/strict";
import test from "node:test";

import ExcelJS from "exceljs";

import {
  duplicateSellerSkuRows,
  normalizeProductBulkImportRow,
  parseProductBulkImportFile,
  ProductBulkImportValidationError,
  productBulkImportErrorCsv,
} from "@/lib/product-bulk-import";
import { normalizeProductInput, ProductInputValidationError } from "@/lib/product-input";

const headers = ["seller_sku", "product_name", "category", "detailed_description"];
const productRow = ["SKU-001", "Recovery Drink", "Beauty & Personal Care", "Detailed product description"];

function fileFromBuffer(name: string, content: Buffer) {
  return {
    name,
    size: content.byteLength,
    arrayBuffer: async () => content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength),
  } as unknown as File;
}

test("parses valid CSV and creates a draft-only normalized product", async () => {
  const csv = Buffer.from(`${headers.join(",")}\n${productRow.join(",")}\n`, "utf8");
  const parsed = await parseProductBulkImportFile(fileFromBuffer("products.csv", csv));

  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].rowNumber, 2);
  const normalized = normalizeProductBulkImportRow(parsed.rows[0].values);
  assert.equal(normalized.sellerSku, "SKU-001");
  assert.equal(normalized.product.name, "Recovery Drink");
  assert.equal(normalized.product.status, "draft");
});

test("parses valid XLSX", async () => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Products");
  worksheet.addRow(headers);
  worksheet.addRow(productRow);
  const content = Buffer.from(await workbook.xlsx.writeBuffer());
  const parsed = await parseProductBulkImportFile(fileFromBuffer("products.xlsx", content));

  assert.equal(parsed.format, "xlsx");
  assert.equal(parsed.rows[0].values.seller_sku, "SKU-001");
});

test("rejects missing required columns, invalid categories, over-limit rows, xlsm and formula cells", async () => {
  await assert.rejects(
    parseProductBulkImportFile(fileFromBuffer("products.csv", Buffer.from("product_name\nName\n"))),
    ProductBulkImportValidationError,
  );
  assert.throws(
    () => normalizeProductBulkImportRow({
      seller_sku: "SKU-001",
      product_name: "Name",
      category: "Invalid category",
      detailed_description: "Description",
    }),
    ProductInputValidationError,
  );
  const tooManyRows = [headers.join(","), ...Array.from({ length: 201 }, (_, index) =>
    [`SKU-${index}`, "Name", "Beauty & Personal Care", "Description"].join(","),
  )].join("\n");
  await assert.rejects(
    parseProductBulkImportFile(fileFromBuffer("products.csv", Buffer.from(tooManyRows))),
    ProductBulkImportValidationError,
  );
  await assert.rejects(
    parseProductBulkImportFile(fileFromBuffer("products.xlsm", Buffer.from("not allowed"))),
    ProductBulkImportValidationError,
  );
  await assert.rejects(
    parseProductBulkImportFile(
      fileFromBuffer(
        "products.csv",
        Buffer.from(`${headers.join(",")}\n=SKU-001,Name,Beauty & Personal Care,Description\n`),
      ),
    ),
    ProductBulkImportValidationError,
  );
});

test("marks duplicate seller SKUs and neutralizes formula values in error CSV output", () => {
  assert.deepEqual([...duplicateSellerSkuRows(["SKU-1", "SKU-2", "SKU-1"])], ["SKU-1"]);
  const csv = productBulkImportErrorCsv([
    {
      rowNumber: 2,
      sellerSku: "SKU-1",
      productName: "=HYPERLINK(\"https://example.test\")",
      category: "Other",
      errorMessages: ["Invalid category"],
    },
  ]);
  assert.match(csv, /'=HYPERLINK/);
});

test("shared single-product validation still blocks active products without an image", () => {
  assert.throws(
    () =>
      normalizeProductInput(
        {
          name: "Product",
          category: "Beauty & Personal Care",
          detailedDescription: "Description",
        },
        { status: "active", hasImages: false },
      ),
    ProductInputValidationError,
  );
});
