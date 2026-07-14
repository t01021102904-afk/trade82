import "server-only";

import ExcelJS from "exceljs";

import {
  getComplianceClaimOptions,
  getCountryOptions,
  getIncotermOptions,
  getLeadTimeOptions,
  getMoqUnitOptions,
  getPriceUnitOptions,
  getPrivateLabelOptions,
  getSampleAvailabilityOptions,
  getSalesChannelOptions,
  getSellerDocumentOptions,
  getSellerProductCategoryOptions,
  type SelectOption,
} from "@/lib/company-select-options";
import { cleanPlainText } from "@/lib/marketplace";
import { normalizeProductInput, type NormalizedProductInput } from "@/lib/product-input";
import {
  productFieldVisibilityKeys,
  productFieldVisibilityLevels,
  type ProductFieldVisibility,
  type ProductFieldVisibilityLevel,
} from "@/lib/product-field-visibility";

export const PRODUCT_BULK_IMPORT_MAX_BYTES = 5 * 1024 * 1024;
export const PRODUCT_BULK_IMPORT_MAX_ROWS = 200;

export const productBulkImportRequiredColumns = [
  "seller_sku",
  "product_name",
  "category",
  "detailed_description",
] as const;

export const productBulkImportColumns = [
  ...productBulkImportRequiredColumns,
  "product_name_en",
  "tags",
  "tags_en",
  "short_description",
  "short_description_en",
  "detailed_description_en",
  "price_min",
  "price_max",
  "currency",
  "price_unit",
  "moq_quantity",
  "moq_unit",
  "lead_time",
  "sample_availability",
  "private_label_availability",
  "monthly_capacity",
  "monthly_capacity_unit",
  "country_of_origin",
  "shipping_origin_country",
  "shipping_origin_region",
  "incoterms",
  "hs_code",
  "shelf_life",
  "storage_requirements",
  "documents_available",
  "compliance_claims",
  "buyer_notes",
  "buyer_notes_en",
  "ingredients_or_materials",
  "packaging",
  "package_size",
  "units_per_carton",
  "carton_weight",
  "carton_dimensions",
  "pallet_quantity",
  "storage_temperature",
  "suggested_sales_channels",
  "field_visibility",
  "export_readiness",
] as const;

export type ProductBulkImportRawRow = Record<string, string>;

export type NormalizedBulkImportRow = {
  sellerSku: string;
  product: NormalizedProductInput;
};

export function duplicateSellerSkuRows(skus: string[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const sku of skus) {
    if (seen.has(sku)) duplicates.add(sku);
    seen.add(sku);
  }
  return duplicates;
}

export class ProductBulkImportValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductBulkImportValidationError";
  }
}

function normalizedHeader(value: unknown) {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function cellText(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" && !Number.isFinite(value)) return "";
  return String(value).replace(/\u0000/g, "").trim();
}

function isPotentialFormula(value: string) {
  return /^[=+\-@\t\r]/.test(value.trim());
}

function ensureSafeCell(value: string, rowNumber: number) {
  if (isPotentialFormula(value)) {
    throw new ProductBulkImportValidationError(
      `행 ${rowNumber}: 수식으로 해석될 수 있는 값은 사용할 수 없습니다.`,
    );
  }
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];

    if (quoted) {
      if (character === '"' && next === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        value += character;
      }
      continue;
    }

    if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(value);
      value = "";
    } else if (character === "\n") {
      row.push(value.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }

  if (quoted) {
    throw new ProductBulkImportValidationError("CSV 파일의 따옴표 형식이 올바르지 않습니다.");
  }
  row.push(value.replace(/\r$/, ""));
  if (row.some((cell) => cell.length > 0)) rows.push(row);
  return rows;
}

async function parseWorksheet(buffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(
      buffer as unknown as Parameters<typeof workbook.xlsx.load>[0],
    );
  } catch {
    throw new ProductBulkImportValidationError("Excel 파일을 읽을 수 없습니다.");
  }

  if (buffer.includes(Buffer.from("vbaProject.bin", "utf8"))) {
    throw new ProductBulkImportValidationError("매크로가 포함된 파일은 업로드할 수 없습니다.");
  }
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new ProductBulkImportValidationError("상품 정보가 포함된 시트를 찾을 수 없습니다.");
  }
  const matrix: unknown[][] = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const values: unknown[] = [];
    row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
      if (
        cell.type === ExcelJS.ValueType.Formula ||
        (cell.value && typeof cell.value === "object" && "formula" in cell.value)
      ) {
        throw new ProductBulkImportValidationError("수식이 포함된 파일은 업로드할 수 없습니다.");
      }
      values[columnNumber - 1] = cell.text || cell.value || "";
    });
    matrix[rowNumber - 1] = values;
  });
  return matrix.filter((row) => row?.some((cell) => cellText(cell)));
}

function rowsFromMatrix(matrix: unknown[][]) {
  const [headerRow, ...dataRows] = matrix;
  if (!headerRow) {
    throw new ProductBulkImportValidationError("열 제목이 포함된 파일을 업로드해 주세요.");
  }
  const headers = headerRow.map(normalizedHeader);
  const duplicateHeaders = headers.filter(
    (header, index) => header && headers.indexOf(header) !== index,
  );
  if (duplicateHeaders.length) {
    throw new ProductBulkImportValidationError("중복된 열 제목이 있습니다.");
  }
  const missing = productBulkImportRequiredColumns.filter((column) => !headers.includes(column));
  if (missing.length) {
    throw new ProductBulkImportValidationError(`필수 열이 없습니다: ${missing.join(", ")}`);
  }
  if (dataRows.length > PRODUCT_BULK_IMPORT_MAX_ROWS) {
    throw new ProductBulkImportValidationError(
      `상품은 한 번에 최대 ${PRODUCT_BULK_IMPORT_MAX_ROWS}행까지 등록할 수 있습니다.`,
    );
  }

  return dataRows
    .map((dataRow, index) => {
      const rowNumber = index + 2;
      const values = headers.reduce<ProductBulkImportRawRow>((next, header, columnIndex) => {
        if (!header) return next;
        const value = cellText(dataRow[columnIndex]);
        ensureSafeCell(value, rowNumber);
        next[header] = value;
        return next;
      }, {});
      return { rowNumber, values };
    })
    .filter(({ values }) => Object.values(values).some(Boolean));
}

export async function parseProductBulkImportFile(file: File) {
  const filename = cleanPlainText(file.name, 180).replace(/[\\/]/g, "_");
  const extension = filename.split(".").pop()?.toLowerCase();
  if (extension !== "xlsx" && extension !== "csv") {
    throw new ProductBulkImportValidationError(".xlsx 또는 .csv 파일만 업로드할 수 있습니다.");
  }
  if (file.size <= 0 || file.size > PRODUCT_BULK_IMPORT_MAX_BYTES) {
    throw new ProductBulkImportValidationError("파일 크기는 최대 5MB입니다.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (extension === "xlsx" && !(buffer[0] === 0x50 && buffer[1] === 0x4b)) {
    throw new ProductBulkImportValidationError("올바른 .xlsx 파일을 업로드해 주세요.");
  }

  const matrix =
    extension === "xlsx"
      ? await parseWorksheet(buffer)
      : parseCsv(new TextDecoder("utf-8", { fatal: false }).decode(buffer));
  const rows = rowsFromMatrix(matrix);
  if (!rows.length) {
    throw new ProductBulkImportValidationError("등록할 상품 행이 없습니다.");
  }
  return { filename, format: extension, rows };
}

function splitPipeList(value: string) {
  return value
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

function canonicalOption(value: string, options: SelectOption[]) {
  const normalized = cleanPlainText(value, 120).toLocaleLowerCase();
  return options.find(
    (option) =>
      option.value.toLocaleLowerCase() === normalized ||
      option.label.toLocaleLowerCase() === normalized,
  )?.value;
}

function localizedOption(value: string, resolver: (locale: "en" | "ko") => SelectOption[]) {
  return (
    canonicalOption(value, resolver("en")) ?? canonicalOption(value, resolver("ko")) ?? ""
  );
}

function localizedList(value: string, resolver: (locale: "en" | "ko") => SelectOption[]) {
  return splitPipeList(value)
    .map((item) => localizedOption(item, resolver))
    .filter(Boolean);
}

function bulkDefaultFieldVisibility() {
  return Object.fromEntries(
    productFieldVisibilityKeys.map((key) => [key, "inquiry_required"]),
  ) as ProductFieldVisibility;
}

function importFieldVisibility(value: string, raw: ProductBulkImportRawRow): ProductFieldVisibility {
  const trimmed = value.trim();
  if (!trimmed) {
    const visibility = bulkDefaultFieldVisibility();
    const provided: Partial<Record<keyof ProductFieldVisibility, boolean>> = {
      minimumUnitPrice: Boolean(raw.price_min || raw.price_max),
      moq: Boolean(raw.moq_quantity || raw.moq_unit),
      leadTime: Boolean(raw.lead_time),
      sampleAvailability: Boolean(raw.sample_availability),
      privateLabelAvailability: Boolean(raw.private_label_availability),
      monthlySupplyCapacity: Boolean(raw.monthly_capacity),
      incoterms: Boolean(raw.incoterms),
      hsCode: Boolean(raw.hs_code),
      shelfLife: Boolean(raw.shelf_life),
      storageRequirements: Boolean(raw.storage_requirements),
      documents: Boolean(raw.documents_available),
      complianceInfo: Boolean(raw.compliance_claims),
      ingredientsMaterials: Boolean(raw.ingredients_or_materials),
      packageSize: Boolean(raw.package_size),
      unitsPerCarton: Boolean(raw.units_per_carton),
      cartonWeight: Boolean(raw.carton_weight),
      cartonDimensions: Boolean(raw.carton_dimensions),
      palletQuantity: Boolean(raw.pallet_quantity),
      storageTemperature: Boolean(raw.storage_temperature),
      packaging: Boolean(raw.packaging),
    };
    for (const key of productFieldVisibilityKeys) {
      if (provided[key]) visibility[key] = "public";
    }
    return visibility;
  }
  if (productFieldVisibilityLevels.includes(trimmed as ProductFieldVisibilityLevel)) {
    return Object.fromEntries(
      productFieldVisibilityKeys.map((key) => [key, trimmed]),
    ) as ProductFieldVisibility;
  }
  if (trimmed.includes(":")) {
    const visibility = bulkDefaultFieldVisibility();
    for (const item of splitPipeList(trimmed)) {
      const [key, level, ...rest] = item.split(":").map((part) => part.trim());
      if (
        rest.length ||
        !productFieldVisibilityKeys.includes(key as keyof ProductFieldVisibility) ||
        !productFieldVisibilityLevels.includes(level as ProductFieldVisibilityLevel)
      ) {
        throw new ProductBulkImportValidationError("공개범위 값이 올바르지 않습니다.");
      }
      visibility[key as keyof ProductFieldVisibility] = level as ProductFieldVisibilityLevel;
    }
    return visibility;
  }
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const visibility = bulkDefaultFieldVisibility();
      for (const key of productFieldVisibilityKeys) {
        const level = (parsed as Record<string, unknown>)[key];
        if (level === undefined) continue;
        if (!productFieldVisibilityLevels.includes(level as ProductFieldVisibilityLevel)) {
          throw new ProductBulkImportValidationError("공개범위 값이 올바르지 않습니다.");
        }
        visibility[key] = level as ProductFieldVisibilityLevel;
      }
      return visibility;
    }
  } catch {
    // The normalized product validation below applies defaults for unknown keys.
  }
  throw new ProductBulkImportValidationError("공개범위 값이 올바르지 않습니다.");
}

function importBoolean(value: string) {
  return ["1", "true", "yes", "y", "예", "네"].includes(value.trim().toLowerCase());
}

function requiredSellerSku(value: string) {
  const sku = cleanPlainText(value, 80);
  if (!sku) throw new ProductBulkImportValidationError("seller_sku를 입력해 주세요.");
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]{0,79}$/.test(sku) || sku.includes("..")) {
    throw new ProductBulkImportValidationError("seller_sku 형식이 올바르지 않습니다.");
  }
  return sku;
}

export function normalizeProductBulkImportRow(raw: ProductBulkImportRawRow): NormalizedBulkImportRow {
  const sellerSku = requiredSellerSku(raw.seller_sku ?? "");
  const category = localizedOption(raw.category ?? "", getSellerProductCategoryOptions);
  const product = normalizeProductInput(
    {
      name: raw.product_name,
      nameEn: raw.product_name_en,
      category,
      tags: splitPipeList(raw.tags ?? ""),
      tagsEn: splitPipeList(raw.tags_en ?? ""),
      shortDescription: raw.short_description,
      shortDescriptionEn: raw.short_description_en,
      detailedDescription: raw.detailed_description,
      detailedDescriptionEn: raw.detailed_description_en,
      priceMin: raw.price_min,
      priceMax: raw.price_max,
      currency: raw.currency,
      priceUnit: localizedOption(raw.price_unit ?? "", getPriceUnitOptions),
      moqQuantity: raw.moq_quantity,
      moqUnit: localizedOption(raw.moq_unit ?? "", getMoqUnitOptions),
      leadTime: localizedOption(raw.lead_time ?? "", getLeadTimeOptions),
      sampleAvailability: localizedOption(
        raw.sample_availability ?? "",
        getSampleAvailabilityOptions,
      ),
      privateLabelAvailability: localizedOption(
        raw.private_label_availability ?? "",
        getPrivateLabelOptions,
      ),
      monthlyCapacity: raw.monthly_capacity,
      monthlyCapacityUnit: localizedOption(raw.monthly_capacity_unit ?? "", getPriceUnitOptions),
      countryOfOrigin: localizedOption(raw.country_of_origin ?? "", getCountryOptions),
      shippingOriginCountry: localizedOption(raw.shipping_origin_country ?? "", getCountryOptions),
      shippingOriginRegion: raw.shipping_origin_region,
      incoterms: localizedList(raw.incoterms ?? "", getIncotermOptions),
      hsCode: raw.hs_code,
      shelfLife: raw.shelf_life,
      storageRequirements: raw.storage_requirements,
      documentsAvailable: localizedList(raw.documents_available ?? "", getSellerDocumentOptions),
      complianceClaims: localizedList(raw.compliance_claims ?? "", getComplianceClaimOptions),
      buyerNotes: raw.buyer_notes,
      buyerNotesEn: raw.buyer_notes_en,
      ingredientsOrMaterials: raw.ingredients_or_materials,
      packaging: raw.packaging,
      packageSize: raw.package_size,
      unitsPerCarton: raw.units_per_carton,
      cartonWeight: raw.carton_weight,
      cartonDimensions: raw.carton_dimensions,
      palletQuantity: raw.pallet_quantity,
      storageTemperature: raw.storage_temperature,
      suggestedUsChannels: localizedList(raw.suggested_sales_channels ?? "", getSalesChannelOptions),
      fieldVisibility: importFieldVisibility(raw.field_visibility ?? "", raw),
      exportReadiness: importBoolean(raw.export_readiness ?? ""),
    },
    { status: "draft", hasImages: false },
  );

  return { sellerSku, product };
}

export function safeCsvCell(value: string) {
  const text = String(value ?? "");
  const protectedValue = isPotentialFormula(text) ? `'${text}` : text;
  return /[",\n\r]/.test(protectedValue)
    ? `"${protectedValue.replace(/"/g, '""')}"`
    : protectedValue;
}

export function productBulkImportErrorCsv(
  rows: Array<{
    rowNumber: number;
    sellerSku: string;
    productName: string;
    category: string;
    errorMessages: string[];
  }>,
) {
  const header = ["row_number", "seller_sku", "product_name", "category", "errors"];
  const values = rows.map((row) => [
    String(row.rowNumber),
    row.sellerSku,
    row.productName,
    row.category,
    row.errorMessages.join(" | "),
  ]);
  return [header, ...values].map((row) => row.map(safeCsvCell).join(",")).join("\r\n");
}
