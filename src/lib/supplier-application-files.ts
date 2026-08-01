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
import { requireSupplierApplicationsEnabled } from "@/lib/supplier-application-feature";
import {
  getPrivateStorageBucket,
  sanitizeStoredFilename,
  uploadPrivateFile,
  validateFileSize,
  validateFileType,
} from "@/lib/supabase-storage";

export const supplierInventorySampleHeaders = [
  "gtin",
  "brand",
  "product_name",
  "size_or_variant",
  "supply_price",
  "currency",
  "available_quantity",
  "moq",
  "mov",
  "lead_time_days",
  "expiration_date",
  "warehouse",
  "allowed_countries",
  "stock_updated_at",
] as const;

export type InventorySampleSummary = {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateGtins: number;
  missingRequiredFieldRows: number;
  invalidGtinRows: number;
  invalidPriceRows: number;
  invalidQuantityRows: number;
  invalidMoqRows: number;
  invalidMovRows: number;
  invalidLeadTimeRows: number;
  invalidExpirationDateRows: number;
  invalidStockUpdatedAtRows: number;
  invalidCurrencyRows: number;
  duplicateGtinRows: number;
};

const supportedCurrencies = new Set([
  "AUD",
  "CAD",
  "CNY",
  "EUR",
  "GBP",
  "HKD",
  "JPY",
  "KRW",
  "SGD",
  "USD",
]);

function extension(filename: string) {
  return filename.trim().toLowerCase().split(".").at(-1) ?? "";
}

function normalizedHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase()
    .replaceAll(/[\s-]+/g, "_");
}

function validGtin(value: string) {
  if (!/^\d{8}$|^\d{12}$|^\d{13}$|^\d{14}$/.test(value)) return false;
  const digits = [...value].map(Number);
  const checkDigit = digits.pop();
  const sum = digits
    .reverse()
    .reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === checkDigit;
}

function finiteNumber(value: string, minimum: number) {
  if (!/^\d+(?:\.\d+)?$/.test(value)) return false;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum;
}

function integer(value: string, minimum: number) {
  if (!/^\d+$/.test(value)) return false;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum;
}

function validDate(value: string, dateTime: boolean) {
  if (!value) return false;
  if (dateTime && !/^\d{4}-\d{2}-\d{2}T/.test(value)) return false;
  if (!dateTime) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return (
      !Number.isNaN(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  }
  return !Number.isNaN(new Date(value).getTime());
}

function validCountries(value: string) {
  if (!value) return false;
  return value.split(/[|;]/).every((item) => {
    const country = item.trim();
    return /^[A-Za-z][A-Za-z .'-]{1,79}$/.test(country);
  });
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
  requireSupplierApplicationsEnabled();
  validateFileType(file, "supplier_inventory_sample");
  validateFileSize(file, "supplier_inventory_sample");
  const fileExtension = extension(file.name);
  const buffer = Buffer.from(await file.arrayBuffer());
  const rows = fileExtension === "csv" ? parseCsv(buffer) : await parseXlsx(buffer);
  if (rows.length < 2) throw validationError("The inventory sample must include a header and at least one row.");
  if (rows.length > 5_001) throw validationError("The inventory sample can contain at most 5,000 rows.");

  const headers = rows[0].map(normalizedHeader);
  const missingHeaders = supplierInventorySampleHeaders.filter(
    (header) => !headers.includes(header),
  );
  if (missingHeaders.length) {
    throw validationError(`The inventory sample is missing required columns: ${missingHeaders.join(", ")}.`);
  }
  const positions = new Map(headers.map((header, index) => [header, index]));
  const gtins = new Map<string, number>();
  let validRows = 0;
  let invalidRows = 0;
  let duplicateGtinRows = 0;
  let missingRequiredFieldRows = 0;
  let invalidGtinRows = 0;
  let invalidPriceRows = 0;
  let invalidQuantityRows = 0;
  let invalidMoqRows = 0;
  let invalidMovRows = 0;
  let invalidLeadTimeRows = 0;
  let invalidExpirationDateRows = 0;
  let invalidStockUpdatedAtRows = 0;
  let invalidCurrencyRows = 0;

  for (const row of rows.slice(1)) {
    const field = (header: (typeof supplierInventorySampleHeaders)[number]) =>
      stringCell(row[positions.get(header) ?? -1]);
    const required = [
      field("gtin"),
      field("brand"),
      field("product_name"),
      field("size_or_variant"),
      field("supply_price"),
      field("currency"),
      field("available_quantity"),
      field("moq"),
      field("mov"),
      field("lead_time_days"),
      field("expiration_date"),
      field("warehouse"),
      field("allowed_countries"),
      field("stock_updated_at"),
    ];
    const missingRequiredField = !required.every(Boolean);
    let valid = !missingRequiredField;
    if (missingRequiredField) missingRequiredFieldRows += 1;
    const gtin = field("gtin");
    if (!validGtin(gtin)) {
      invalidGtinRows += 1;
      valid = false;
    } else {
      const current = gtins.get(gtin) ?? 0;
      gtins.set(gtin, current + 1);
      if (current > 0) {
        duplicateGtinRows += 1;
        valid = false;
      }
    }
    if (!finiteNumber(field("supply_price"), Number.MIN_VALUE)) {
      invalidPriceRows += 1;
      valid = false;
    }
    if (!integer(field("available_quantity"), 0)) {
      invalidQuantityRows += 1;
      valid = false;
    }
    if (!integer(field("moq"), 1)) {
      invalidMoqRows += 1;
      valid = false;
    }
    if (!finiteNumber(field("mov"), 0)) {
      invalidMovRows += 1;
      valid = false;
    }
    if (!integer(field("lead_time_days"), 0)) {
      invalidLeadTimeRows += 1;
      valid = false;
    }
    const expirationDate = field("expiration_date");
    if (!validDate(expirationDate, false)) {
      invalidExpirationDateRows += 1;
      valid = false;
    }
    if (!validDate(field("stock_updated_at"), true)) {
      invalidStockUpdatedAtRows += 1;
      valid = false;
    }
    if (!supportedCurrencies.has(field("currency").toUpperCase())) {
      invalidCurrencyRows += 1;
      valid = false;
    }
    if (
      field("allowed_countries") &&
      !validCountries(field("allowed_countries"))
    ) {
      valid = false;
    }
    if (valid) validRows += 1;
    else invalidRows += 1;
  }
  return {
    format: fileExtension === "csv" ? SupplierInventorySampleFormat.CSV : SupplierInventorySampleFormat.XLSX,
    summary: {
      totalRows: rows.length - 1,
      validRows,
      invalidRows,
      duplicateGtins: duplicateGtinRows,
      missingRequiredFieldRows,
      invalidGtinRows,
      invalidPriceRows,
      invalidQuantityRows,
      invalidMoqRows,
      invalidMovRows,
      invalidLeadTimeRows,
      invalidExpirationDateRows,
      invalidStockUpdatedAtRows,
      invalidCurrencyRows,
      duplicateGtinRows,
    },
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
  requireSupplierApplicationsEnabled();
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
