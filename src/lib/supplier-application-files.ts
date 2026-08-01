import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { readXlsx } from "hucre/xlsx";

import {
  SupplierApplicationDocumentType,
  SupplierInventorySampleFormat,
} from "@/generated/prisma/client";
import { validationError } from "@/lib/api-security";
import { assertSafeXlsxArchive } from "@/lib/bulk-product-registration";
import type { Locale } from "@/lib/i18n";
import {
  getPrivateStorageBucket,
  sanitizeStoredFilename,
  uploadPrivateFile,
  validateFileSize,
  validateFileType,
} from "@/lib/supabase-storage";

const inventoryHeaders = [
  "brand",
  "gtin",
  "sku",
  "name",
  "quantity",
  "stock date",
  "currency",
  "price",
] as const;

export type InventorySampleSummary = {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateGtins: number;
  missingRequiredFieldRows: number;
  invalidPriceRows: number;
  invalidStockDateRows: number;
  invalidCurrencyRows: number;
};

function extension(filename: string) {
  return filename.trim().toLowerCase().split(".").at(-1) ?? "";
}

function normalizedHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase()
    .replaceAll(/[_-]+/g, " ")
    .replaceAll(/\s+/g, " ");
}

function stringCell(value: unknown) {
  return String(value ?? "").trim();
}

function parseCsv(buffer: Buffer) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const value = buffer.toString("utf8").replace(/^\uFEFF/, "");
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    const next = value[index + 1];
    if (character === '"') {
      if (quoted && next === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((item) => item.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  if (quoted) throw validationError("The CSV contains an unterminated quoted value.");
  row.push(cell);
  if (row.some((item) => item.trim())) rows.push(row);
  return rows;
}

async function parseXlsx(buffer: Buffer) {
  assertSafeXlsxArchive(buffer, "en");
  const workbook = await readXlsx(buffer, { readStyles: false });
  const sheet = workbook.sheets[0];
  if (!sheet) throw validationError("The workbook does not contain a worksheet.");
  for (const cell of sheet.cells?.values() ?? []) {
    if (cell?.type === "formula" || cell?.formula) {
      throw validationError("Formula cells are not allowed in inventory samples.");
    }
  }
  return sheet.rows.map((row) => row.map(stringCell));
}

export async function validateInventorySample(file: File): Promise<{
  format: SupplierInventorySampleFormat;
  summary: InventorySampleSummary;
}> {
  validateFileType(file, "supplier_inventory_sample");
  validateFileSize(file, "supplier_inventory_sample");
  const fileExtension = extension(file.name);
  const buffer = Buffer.from(await file.arrayBuffer());
  const rows = fileExtension === "csv" ? parseCsv(buffer) : await parseXlsx(buffer);
  if (rows.length < 2) throw validationError("The inventory sample must include a header and at least one row.");
  if (rows.length > 5_001) throw validationError("The inventory sample can contain at most 5,000 rows.");

  const headers = rows[0].map(normalizedHeader);
  const missingHeaders = inventoryHeaders.filter((header) => !headers.includes(header));
  if (missingHeaders.length) {
    throw validationError(`The inventory sample is missing required columns: ${missingHeaders.join(", ")}.`);
  }
  const positions = new Map(headers.map((header, index) => [header, index]));
  const gtins = new Map<string, number>();
  let validRows = 0;
  let invalidRows = 0;
  let duplicateGtins = 0;
  let missingRequiredFieldRows = 0;
  let invalidPriceRows = 0;
  let invalidStockDateRows = 0;
  let invalidCurrencyRows = 0;

  for (const row of rows.slice(1)) {
    const field = (header: (typeof inventoryHeaders)[number]) => stringCell(row[positions.get(header) ?? -1]);
    const required = [field("brand"), field("gtin"), field("sku"), field("name"), field("quantity"), field("stock date"), field("currency"), field("price")];
    let valid = required.every(Boolean);
    if (!valid) missingRequiredFieldRows += 1;
    const gtin = field("gtin");
    if (gtin) {
      const current = gtins.get(gtin) ?? 0;
      gtins.set(gtin, current + 1);
      if (current > 0) {
        duplicateGtins += 1;
        valid = false;
      }
    }
    const quantity = Number(field("quantity"));
    const price = Number(field("price"));
    if (!Number.isFinite(quantity) || quantity < 0 || !Number.isInteger(quantity) || !Number.isFinite(price) || price < 0) {
      invalidPriceRows += 1;
      valid = false;
    }
    const stockDate = new Date(field("stock date"));
    if (Number.isNaN(stockDate.getTime())) {
      invalidStockDateRows += 1;
      valid = false;
    }
    if (!/^[A-Z]{3}$/.test(field("currency").toUpperCase())) {
      invalidCurrencyRows += 1;
      valid = false;
    }
    if (valid) validRows += 1;
    else invalidRows += 1;
  }
  return {
    format: fileExtension === "csv" ? SupplierInventorySampleFormat.CSV : SupplierInventorySampleFormat.XLSX,
    summary: { totalRows: rows.length - 1, validRows, invalidRows, duplicateGtins, missingRequiredFieldRows, invalidPriceRows, invalidStockDateRows, invalidCurrencyRows },
  };
}

export function parseSupplierApplicationDocumentType(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !Object.values(SupplierApplicationDocumentType).includes(value as SupplierApplicationDocumentType)) {
    throw validationError("documentType is invalid.");
  }
  return value as SupplierApplicationDocumentType;
}

export async function uploadSupplierApplicationPrivateFile({
  applicationId,
  kind,
  file,
}: {
  applicationId: string;
  kind: "documents" | "inventory";
  file: File;
}) {
  const filename = sanitizeStoredFilename(file.name);
  const uniqueName = `${randomUUID()}-${filename}`;
  const path = `supplier-applications/${applicationId}/${kind}/${uniqueName}`;
  const body = Buffer.from(await file.arrayBuffer());
  await uploadPrivateFile({ path, body, contentType: file.type.toLowerCase() });
  return {
    bucket: getPrivateStorageBucket(),
    path,
    storedFilename: uniqueName,
    sha256Hash: createHash("sha256").update(body).digest("hex"),
    sizeBytes: body.byteLength,
  };
}

export function supplierApplicationUploadLocale(value: FormDataEntryValue | null): Locale {
  return value === "ko" ? "ko" : "en";
}
