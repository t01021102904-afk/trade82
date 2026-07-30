import { createHash } from "node:crypto";

import { colToLetter, readXlsx, writeXlsx } from "hucre/xlsx";
import type {
  Cell,
  CellStyle,
  CellValue,
  DataValidation,
  Sheet,
  WriteSheet,
} from "hucre";

import {
  getComplianceClaimOptions,
  getCountryOptions,
  getIncotermOptions,
  getKoreanRegionOptions,
  getLeadTimeOptions,
  getMoqUnitOptions,
  getPriceUnitOptions,
  getPrivateLabelOptions,
  getSampleAvailabilityOptions,
  getSalesChannelOptions,
  getSellerDocumentOptions,
  getSellerProductCategoryOptions,
  SOUTH_KOREA,
  type SelectOption,
} from "@/lib/company-select-options";
import {
  BULK_PRODUCT_MAX_ROWS,
  type BulkProductInput,
  type BulkProductPreviewRow,
  type BulkProductValidationIssue,
  type BulkProductValidationResponse,
} from "@/lib/bulk-product-types";
import {
  defaultProductFieldVisibility,
  productFieldRequiresValue,
  type ProductFieldVisibility,
  type ProductFieldVisibilityKey,
  type ProductFieldVisibilityLevel,
} from "@/lib/product-field-visibility";
import {
  hasProductPricingErrors,
  validateProductPricing,
} from "@/lib/product-pricing-validation";
import {
  cleanPlainText,
  cleanTags,
  isMarketplaceCategory,
} from "@/lib/marketplace";
import type { Locale } from "@/lib/i18n";

type BulkColumnDefinition = {
  key: string;
  en: string;
  ko: string;
  descriptionEn: string;
  descriptionKo: string;
  required?: boolean;
  example?: string | number | boolean;
  options?: BulkOptionGroup;
  width?: number;
};

type BulkOptionGroup =
  | "category"
  | "currency"
  | "priceUnit"
  | "moqUnit"
  | "leadTime"
  | "sampleAvailability"
  | "privateLabelAvailability"
  | "country"
  | "koreanRegion"
  | "incoterms"
  | "documents"
  | "compliance"
  | "salesChannels"
  | "visibility"
  | "boolean";

type RawBulkProductRow = {
  excelRow: number;
  values: Record<string, string>;
  formulaColumns: string[];
};

const EXAMPLE_NAME_EN = "[EXAMPLE - DELETE THIS ROW]";
const EXAMPLE_NAME_KO = "[예시 - 이 행을 삭제하세요]";
const visibilityOptions: SelectOption[] = [
  { value: "public", label: "Public" },
  { value: "inquiry_required", label: "Inquiry required" },
  { value: "private", label: "Private" },
];
const visibilityKoreanLabels: Record<ProductFieldVisibilityLevel, string> = {
  public: "공개",
  inquiry_required: "문의 필요",
  private: "비공개",
};

const columns: BulkColumnDefinition[] = [
  column("name", "Product name", "상품명", "Required. Maximum 120 characters.", "필수. 최대 120자.", { required: true, example: EXAMPLE_NAME_EN, width: 30 }),
  column("nameEn", "English product name", "영문 상품명", "Optional English product name.", "선택. 영문 상품명.", { example: "Hydrating Sheet Mask", width: 28 }),
  column("category", "Category", "카테고리", "Required. Select a value from the Options sheet.", "필수. Options 시트의 값에서 선택하세요.", { required: true, example: "Beauty & Personal Care", options: "category", width: 25 }),
  column("detailedDescription", "Detailed product description", "상세 상품 설명", "Required. Maximum 5,000 characters.", "필수. 최대 5,000자.", { required: true, example: "A hydrating sheet mask for wholesale distribution.", width: 42 }),
  column("detailedDescriptionEn", "English detailed description", "영문 상세 설명", "Optional English description.", "선택. 영문 상세 설명.", { example: "A hydrating sheet mask for wholesale distribution.", width: 42 }),
  column("shortDescription", "Short product summary", "상품 요약", "Optional. Maximum 240 characters.", "선택. 최대 240자.", { example: "Hydrating daily sheet mask.", width: 30 }),
  column("shortDescriptionEn", "English short summary", "영문 상품 요약", "Optional English summary.", "선택. 영문 상품 요약.", { example: "Hydrating daily sheet mask.", width: 30 }),
  column("tags", "Related tags", "관련 태그", "Optional. Separate multiple values with commas.", "선택. 여러 값은 쉼표로 구분하세요.", { example: "sheet mask, hydration, skincare", width: 28 }),
  column("tagsEn", "English tags", "영문 태그", "Optional. Separate multiple values with commas.", "선택. 여러 값은 쉼표로 구분하세요.", { example: "sheet mask, hydration", width: 28 }),
  column("retailPrice", "Retail price", "소비자가", "Required number greater than 0.", "필수. 0보다 큰 숫자.", { required: true, example: 2.5, width: 14 }),
  column("wholesalePrice", "Wholesale price", "도매가", "Required number greater than 0 and not above retail price.", "필수. 0보다 크고 소비자가 이하인 숫자.", { required: true, example: 1.2, width: 16 }),
  column("currency", "Currency", "통화", "Required. Select a supported currency.", "필수. 지원 통화를 선택하세요.", { required: true, example: "USD", options: "currency", width: 12 }),
  column("priceUnit", "Price unit", "가격 단위", "Optional. Defaults to unit.", "선택. 기본값은 unit입니다.", { example: "unit", options: "priceUnit", width: 14 }),
  column("moqQuantity", "MOQ quantity", "MOQ 수량", "Required integer of at least 1.", "필수. 1 이상의 정수.", { required: true, example: 100, width: 14 }),
  column("moqUnit", "MOQ unit", "MOQ 단위", "Required. Not fixed is not allowed.", "필수. 고정 없음은 사용할 수 없습니다.", { required: true, example: "Units", options: "moqUnit", width: 14 }),
  column("leadTime", "Lead time", "리드타임", "Select a supported value when public.", "공개 시 지원 값에서 선택하세요.", { example: "2 - 4 weeks", options: "leadTime", width: 18 }),
  visibilityColumn("leadTimeVisibility", "Lead time visibility", "리드타임 공개 범위", "inquiry_required"),
  column("sampleAvailability", "Sample availability", "샘플 제공 여부", "Select a supported value when public.", "공개 시 지원 값에서 선택하세요.", { example: "samples_available", options: "sampleAvailability", width: 18 }),
  visibilityColumn("sampleAvailabilityVisibility", "Sample availability visibility", "샘플 제공 공개 범위", "public"),
  column("privateLabelAvailability", "Private label availability", "자체 브랜드 제공 여부", "Select a supported value when public.", "공개 시 지원 값에서 선택하세요.", { example: "Available", options: "privateLabelAvailability", width: 22 }),
  visibilityColumn("privateLabelAvailabilityVisibility", "Private label visibility", "자체 브랜드 공개 범위", "inquiry_required"),
  column("monthlyCapacity", "Monthly supply capacity", "월 공급 가능 수량", "Optional positive number when public.", "공개 시 0보다 큰 숫자를 입력하세요.", { example: 50000, width: 20 }),
  column("monthlyCapacityUnit", "Monthly capacity unit", "월 공급 단위", "Optional. Select a supported unit.", "선택. 지원 단위를 선택하세요.", { example: "unit", options: "priceUnit", width: 18 }),
  visibilityColumn("monthlySupplyCapacityVisibility", "Monthly capacity visibility", "월 공급량 공개 범위", "inquiry_required"),
  column("countryOfOrigin", "Country of origin", "원산지 국가", "Optional. Defaults to South Korea.", "선택. 기본값은 South Korea입니다.", { example: SOUTH_KOREA, options: "country", width: 22 }),
  column("shippingOriginCountry", "Shipping origin country", "출고 국가", "Optional. Defaults to South Korea.", "선택. 기본값은 South Korea입니다.", { example: SOUTH_KOREA, options: "country", width: 22 }),
  column("shippingOriginRegion", "Shipping origin region", "출고 지역", "Use a supported Korean region when shipping from South Korea.", "한국 출고 시 지원 지역을 선택하세요.", { example: "Seoul", options: "koreanRegion", width: 20 }),
  column("incoterms", "Incoterms", "인코텀즈", "Separate multiple values with |.", "여러 값은 | 로 구분하세요.", { example: "EXW|FOB", options: "incoterms", width: 20 }),
  visibilityColumn("incotermsVisibility", "Incoterms visibility", "인코텀즈 공개 범위", "inquiry_required"),
  column("hsCode", "HS code", "HS 코드", "Optional text when public.", "공개 시 입력하세요.", { example: "330499", width: 14 }),
  visibilityColumn("hsCodeVisibility", "HS code visibility", "HS 코드 공개 범위", "inquiry_required"),
  column("shelfLife", "Shelf life", "유통기한", "Optional text when public.", "공개 시 입력하세요.", { example: "36 months", width: 16 }),
  visibilityColumn("shelfLifeVisibility", "Shelf life visibility", "유통기한 공개 범위", "inquiry_required"),
  column("storageRequirements", "Storage requirements", "보관 조건", "Optional text when public.", "공개 시 입력하세요.", { example: "Store in a cool, dry place.", width: 28 }),
  visibilityColumn("storageRequirementsVisibility", "Storage visibility", "보관 조건 공개 범위", "inquiry_required"),
  column("documentsAvailable", "Documents available", "제공 가능 문서", "Separate multiple values with |.", "여러 값은 | 로 구분하세요.", { example: "COA", options: "documents", width: 24 }),
  visibilityColumn("documentsVisibility", "Documents visibility", "문서 공개 범위", "inquiry_required"),
  column("complianceClaims", "Compliance information", "인증·규정 정보", "Separate multiple values with |.", "여러 값은 | 로 구분하세요.", { example: "ISO 22716", options: "compliance", width: 24 }),
  visibilityColumn("complianceInfoVisibility", "Compliance visibility", "인증 정보 공개 범위", "inquiry_required"),
  column("buyerNotes", "Buyer notes", "바이어 참고사항", "Optional. Maximum 1,000 characters.", "선택. 최대 1,000자.", { width: 30 }),
  column("buyerNotesEn", "English buyer notes", "영문 바이어 참고사항", "Optional English notes.", "선택. 영문 참고사항.", { width: 30 }),
  column("ingredientsOrMaterials", "Ingredients / materials", "성분 / 소재", "Optional text when public.", "공개 시 입력하세요.", { example: "Water, glycerin", width: 28 }),
  visibilityColumn("ingredientsMaterialsVisibility", "Ingredients visibility", "성분 / 소재 공개 범위", "inquiry_required"),
  column("packaging", "Packaging information", "포장 정보", "Optional text when public.", "공개 시 입력하세요.", { example: "10 masks per retail box.", width: 28 }),
  visibilityColumn("packagingVisibility", "Packaging visibility", "포장 정보 공개 범위", "inquiry_required"),
  column("packageSize", "Package size", "포장 크기", "Optional text when public.", "공개 시 입력하세요.", { example: "25 ml", width: 16 }),
  visibilityColumn("packageSizeVisibility", "Package size visibility", "포장 크기 공개 범위", "inquiry_required"),
  column("unitsPerCarton", "Units per carton", "카톤당 수량", "Optional positive number when public.", "공개 시 0보다 큰 숫자를 입력하세요.", { example: 100, width: 16 }),
  visibilityColumn("unitsPerCartonVisibility", "Units per carton visibility", "카톤 수량 공개 범위", "inquiry_required"),
  column("cartonWeight", "Carton weight", "카톤 중량", "Optional text when public.", "공개 시 입력하세요.", { example: "12 kg", width: 16 }),
  visibilityColumn("cartonWeightVisibility", "Carton weight visibility", "카톤 중량 공개 범위", "inquiry_required"),
  column("cartonDimensions", "Carton dimensions", "카톤 규격", "Optional text when public.", "공개 시 입력하세요.", { example: "40 x 30 x 25 cm", width: 20 }),
  visibilityColumn("cartonDimensionsVisibility", "Carton dimensions visibility", "카톤 규격 공개 범위", "inquiry_required"),
  column("palletQuantity", "Pallet quantity", "팔레트 수량", "Optional positive number when public.", "공개 시 0보다 큰 숫자를 입력하세요.", { example: 24, width: 16 }),
  visibilityColumn("palletQuantityVisibility", "Pallet quantity visibility", "팔레트 수량 공개 범위", "inquiry_required"),
  column("storageTemperature", "Storage temperature", "보관 온도", "Optional text when public.", "공개 시 입력하세요.", { example: "5-25 C", width: 18 }),
  visibilityColumn("storageTemperatureVisibility", "Storage temperature visibility", "보관 온도 공개 범위", "inquiry_required"),
  column("suggestedUsChannels", "Suggested sales channels", "추천 판매 채널", "Separate multiple values with |.", "여러 값은 | 로 구분하세요.", { options: "salesChannels", width: 24 }),
  column("exportReadiness", "Export ready", "수출 준비 완료", "Use Yes or No.", "예 또는 아니요를 입력하세요.", { example: "Yes", options: "boolean", width: 14 }),
];

const visibilityFieldColumns: Array<{
  inputKey: ProductFieldVisibilityKey;
  rawKey: string;
}> = [
  { inputKey: "leadTime", rawKey: "leadTimeVisibility" },
  { inputKey: "sampleAvailability", rawKey: "sampleAvailabilityVisibility" },
  { inputKey: "privateLabelAvailability", rawKey: "privateLabelAvailabilityVisibility" },
  { inputKey: "monthlySupplyCapacity", rawKey: "monthlySupplyCapacityVisibility" },
  { inputKey: "incoterms", rawKey: "incotermsVisibility" },
  { inputKey: "hsCode", rawKey: "hsCodeVisibility" },
  { inputKey: "shelfLife", rawKey: "shelfLifeVisibility" },
  { inputKey: "storageRequirements", rawKey: "storageRequirementsVisibility" },
  { inputKey: "documents", rawKey: "documentsVisibility" },
  { inputKey: "complianceInfo", rawKey: "complianceInfoVisibility" },
  { inputKey: "ingredientsMaterials", rawKey: "ingredientsMaterialsVisibility" },
  { inputKey: "packaging", rawKey: "packagingVisibility" },
  { inputKey: "packageSize", rawKey: "packageSizeVisibility" },
  { inputKey: "unitsPerCarton", rawKey: "unitsPerCartonVisibility" },
  { inputKey: "cartonWeight", rawKey: "cartonWeightVisibility" },
  { inputKey: "cartonDimensions", rawKey: "cartonDimensionsVisibility" },
  { inputKey: "palletQuantity", rawKey: "palletQuantityVisibility" },
  { inputKey: "storageTemperature", rawKey: "storageTemperatureVisibility" },
];

export class BulkProductWorkbookError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BulkProductWorkbookError";
  }
}

export const bulkProductColumns = columns.map(({ key, en, ko, required }) => ({
  key,
  en,
  ko,
  required: Boolean(required),
}));

export async function buildBulkProductTemplate(locale: Locale) {
  const headers = columns.map((definition) => headerFor(definition, locale));
  const example = columns.map((definition) => localizedExample(definition, locale));
  example[0] = locale === "ko" ? EXAMPLE_NAME_KO : EXAMPLE_NAME_EN;
  const optionSheet = buildOptionsSheet(locale);
  const headerStyle: CellStyle = {
    font: { bold: true, color: { rgb: "FFFFFF" } },
    fill: {
      type: "pattern",
      pattern: "solid",
      fgColor: { rgb: "171717" },
    },
    alignment: { vertical: "center" },
  };
  const exampleStyle: CellStyle = {
    font: { italic: true, color: { rgb: "737373" } },
    fill: {
      type: "pattern",
      pattern: "solid",
      fgColor: { rgb: "F5F5F5" },
    },
    alignment: { vertical: "top" },
  };
  const productCells = new Map<string, Partial<Cell>>();
  headers.forEach((value, index) => {
    productCells.set(`0,${index}`, {
      value,
      type: "string",
      style: headerStyle,
    });
  });
  example.forEach((value, index) => {
    productCells.set(`1,${index}`, {
      value: value as CellValue,
      type: cellType(value),
      style: exampleStyle,
    });
  });
  const dataValidations: DataValidation[] = [];
  columns.forEach((definition, index) => {
    if (!definition.options) return;
    const range = optionSheet.ranges.get(definition.options);
    if (!range) return;
    dataValidations.push({
      type: "list",
      allowBlank: !definition.required,
      formula1: range,
      range: `${colToLetter(index)}3:${colToLetter(index)}${BULK_PRODUCT_MAX_ROWS + 2}`,
      showErrorMessage: true,
      errorStyle: "stop",
      errorTitle: locale === "ko" ? "지원하지 않는 값" : "Unsupported value",
      errorMessage:
        locale === "ko"
          ? "Options 시트에 있는 값을 선택해 주세요."
          : "Select a value from the Options sheet.",
    });
  });
  const productsSheet: WriteSheet = {
    name: "Products",
    rows: [headers, example as CellValue[]],
    columns: columns.map((definition) => ({
      width: definition.width ?? 20,
      style: { alignment: { vertical: "top" } },
      numFmt:
        definition.key === "retailPrice" || definition.key === "wholesalePrice"
          ? "0.00"
          : definition.key === "moqQuantity"
            ? "0"
            : undefined,
    })),
    cells: productCells,
    rowDefs: new Map([
      [0, { height: 30 }],
      [1, { height: 24 }],
    ]),
    freezePane: { rows: 1 },
    autoFilter: { range: `A1:${colToLetter(columns.length - 1)}2` },
    dataValidations,
  };

  return Buffer.from(
    await writeXlsx({
      properties: {
        creator: "Trade82",
        title:
          locale === "ko"
            ? "Trade82 대량 상품 등록 템플릿"
            : "Trade82 bulk product registration template",
        created: new Date(),
      },
      defaultFont: { name: "Arial", size: 10 },
      sheets: [
        productsSheet,
        buildInstructionsSheet(locale),
        optionSheet.sheet,
      ],
    }),
  );
}

export async function parseBulkProductWorkbook(buffer: Buffer, locale: Locale) {
  assertSafeXlsxArchive(buffer, locale);
  let workbook;
  try {
    workbook = await readXlsx(buffer, {
      sheets: ["Products"],
      readStyles: false,
    });
  } catch {
    throw new BulkProductWorkbookError(
      locale === "ko"
        ? "올바른 .xlsx 파일을 업로드해 주세요."
        : "Upload a valid .xlsx workbook.",
    );
  }

  const worksheet = workbook.sheets.find((sheet) => sheet.name === "Products");
  if (!worksheet) {
    throw new BulkProductWorkbookError(
      locale === "ko"
        ? "Products 시트를 찾을 수 없습니다."
        : "The Products sheet is missing.",
    );
  }
  const headerRow = worksheet.rows[0] ?? [];
  if (hasFormulaInRow(worksheet, 0)) {
    throw new BulkProductWorkbookError(
      locale === "ko"
        ? "헤더에 수식을 사용할 수 없습니다."
        : "Formula cells are not allowed in the header.",
    );
  }
  const headerLookup = createHeaderLookup();
  const columnIndexes = new Map<string, number>();
  const unsupportedHeaders: string[] = [];
  const duplicateHeaders: string[] = [];

  for (let index = 0; index < headerRow.length; index += 1) {
    const header = cellText(headerRow[index]);
    if (!header) continue;
    const key = headerLookup.get(normalizeHeader(header));
    if (!key) {
      unsupportedHeaders.push(header);
      continue;
    }
    if (columnIndexes.has(key)) {
      duplicateHeaders.push(header);
      continue;
    }
    columnIndexes.set(key, index);
  }

  if (unsupportedHeaders.length) {
    throw new BulkProductWorkbookError(
      locale === "ko"
        ? `지원하지 않는 열입니다: ${unsupportedHeaders.join(", ")}`
        : `Unsupported columns: ${unsupportedHeaders.join(", ")}`,
    );
  }
  if (duplicateHeaders.length) {
    throw new BulkProductWorkbookError(
      locale === "ko"
        ? `중복된 열입니다: ${duplicateHeaders.join(", ")}`
        : `Duplicate columns: ${duplicateHeaders.join(", ")}`,
    );
  }

  const missingHeaders = columns
    .filter((definition) => definition.required && !columnIndexes.has(definition.key))
    .map((definition) => headerFor(definition, locale));
  if (missingHeaders.length) {
    throw new BulkProductWorkbookError(
      locale === "ko"
        ? `필수 열이 없습니다: ${missingHeaders.join(", ")}`
        : `Required columns are missing: ${missingHeaders.join(", ")}`,
    );
  }

  const rows: RawBulkProductRow[] = [];
  for (let rowIndex = 1; rowIndex < worksheet.rows.length; rowIndex += 1) {
    const worksheetRow = worksheet.rows[rowIndex] ?? [];
    const values: Record<string, string> = {};
    const formulaColumns: string[] = [];
    for (const definition of columns) {
      const columnIndex = columnIndexes.get(definition.key);
      if (columnIndex === undefined) {
        values[definition.key] = "";
        continue;
      }
      const detailedCell = worksheet.cells?.get(`${rowIndex},${columnIndex}`);
      if (detailedCell?.type === "formula" || detailedCell?.formula) {
        formulaColumns.push(definition.key);
      }
      values[definition.key] = cellText(worksheetRow[columnIndex]);
    }

    const hasContent = Object.values(values).some((value) => value.trim());
    if (!hasContent) continue;
    if (values.name === EXAMPLE_NAME_EN || values.name === EXAMPLE_NAME_KO) continue;
    rows.push({
      excelRow: rowIndex + 1,
      values,
      formulaColumns,
    });
    if (rows.length > BULK_PRODUCT_MAX_ROWS) break;
  }

  if (rows.length > BULK_PRODUCT_MAX_ROWS) {
    throw new BulkProductWorkbookError(
      locale === "ko"
        ? `한 번에 최대 ${BULK_PRODUCT_MAX_ROWS}개 상품만 등록할 수 있습니다.`
        : `A workbook can contain at most ${BULK_PRODUCT_MAX_ROWS} products.`,
    );
  }
  if (!rows.length) {
    throw new BulkProductWorkbookError(
      locale === "ko"
        ? "등록할 상품 행이 없습니다."
        : "The workbook does not contain any product rows.",
    );
  }
  return rows;
}

const MAX_XLSX_ENTRIES = 512;
const MAX_XLSX_UNCOMPRESSED_BYTES = 25 * 1024 * 1024;
const MAX_XLSX_ENTRY_BYTES = 10 * 1024 * 1024;

function assertSafeXlsxArchive(buffer: Buffer, locale: Locale) {
  const endOfCentralDirectory = findEndOfCentralDirectory(buffer);
  if (endOfCentralDirectory < 0) {
    throw invalidWorkbookError(locale);
  }
  const entries = buffer.readUInt16LE(endOfCentralDirectory + 10);
  const centralDirectorySize = buffer.readUInt32LE(endOfCentralDirectory + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(endOfCentralDirectory + 16);
  if (
    entries <= 0 ||
    entries === 0xffff ||
    entries > MAX_XLSX_ENTRIES ||
    centralDirectorySize === 0xffffffff ||
    centralDirectoryOffset === 0xffffffff ||
    centralDirectoryOffset + centralDirectorySize > endOfCentralDirectory
  ) {
    throw invalidWorkbookError(locale);
  }

  let offset = centralDirectoryOffset;
  let totalUncompressed = 0;
  for (let entry = 0; entry < entries; entry += 1) {
    if (offset > buffer.length - 46) throw invalidWorkbookError(locale);
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw invalidWorkbookError(locale);
    }
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const entryEnd = offset + 46 + fileNameLength + extraLength + commentLength;
    if (entryEnd > buffer.length) throw invalidWorkbookError(locale);
    const fileName = buffer
      .subarray(offset + 46, offset + 46 + fileNameLength)
      .toString("utf8");
    if (
      !fileName ||
      fileName.startsWith("/") ||
      fileName.includes("\\") ||
      fileName.split("/").includes("..")
    ) {
      throw invalidWorkbookError(locale);
    }
    totalUncompressed += uncompressedSize;
    if (
      uncompressedSize > MAX_XLSX_ENTRY_BYTES ||
      totalUncompressed > MAX_XLSX_UNCOMPRESSED_BYTES
    ) {
      throw new BulkProductWorkbookError(
        locale === "ko"
          ? "압축 해제된 Excel 파일이 허용된 크기를 초과합니다."
          : "The expanded Excel workbook exceeds the allowed size.",
      );
    }
    offset = entryEnd;
  }
  if (offset !== centralDirectoryOffset + centralDirectorySize) {
    throw invalidWorkbookError(locale);
  }
}

function findEndOfCentralDirectory(buffer: Buffer) {
  const minimumOffset = Math.max(0, buffer.length - 65_557);
  for (let offset = buffer.length - 22; offset >= minimumOffset; offset -= 1) {
    if (
      buffer.readUInt32LE(offset) === 0x06054b50 &&
      offset + 22 + buffer.readUInt16LE(offset + 20) === buffer.length
    ) {
      return offset;
    }
  }
  return -1;
}

function invalidWorkbookError(locale: Locale) {
  return new BulkProductWorkbookError(
    locale === "ko"
      ? "올바른 .xlsx 파일을 업로드해 주세요."
      : "Upload a valid .xlsx workbook.",
  );
}

function hasFormulaInRow(sheet: Sheet, rowIndex: number) {
  for (const [coordinate, cell] of sheet.cells ?? []) {
    if (!coordinate.startsWith(`${rowIndex},`)) continue;
    if (cell.type === "formula" || cell.formula) return true;
  }
  return false;
}

function cellType(value: unknown): Cell["type"] {
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  return value == null || value === "" ? "empty" : "string";
}

export function validateBulkProductRows({
  rows,
  locale,
  existingProductNames = [],
}: {
  rows: RawBulkProductRow[];
  locale: Locale;
  existingProductNames?: string[];
}): BulkProductValidationResponse {
  const existing = new Set(existingProductNames.map(normalizeName).filter(Boolean));
  const fileNameCounts = new Map<string, number>();

  for (const row of rows) {
    const name = normalizeName(row.values.name);
    if (name) fileNameCounts.set(name, (fileNameCounts.get(name) ?? 0) + 1);
  }

  const previewRows = rows.map((row) =>
    validateBulkProductRow({
      row,
      locale,
      existingNames: existing,
      fileNameCounts,
    }),
  );

  return {
    rows: previewRows,
    totalRows: previewRows.length,
    readyRows: previewRows.filter((row) => row.status === "ready").length,
    warningRows: previewRows.filter((row) => row.status === "warning").length,
    errorRows: previewRows.filter((row) => row.status === "error").length,
  };
}

export function bulkProductImportIdentity({
  companyId,
  idempotencyKey,
  rowIndex,
}: {
  companyId: string;
  idempotencyKey: string;
  rowIndex: number;
}) {
  const digest = createHash("sha256")
    .update(`${companyId}:${idempotencyKey}:${rowIndex}`)
    .digest("hex");
  return {
    id: `bulk_${digest.slice(0, 24)}`,
    slugSuffix: digest.slice(0, 12),
  };
}

export function bulkProductCreateData({
  product,
  sellerCompanyId,
  id,
  slugSuffix,
}: {
  product: BulkProductInput;
  sellerCompanyId: string;
  id: string;
  slugSuffix: string;
}) {
  const visible = product.fieldVisibility;
  const detailedDescription = cleanPlainText(product.detailedDescription, 5000);
  const shortDescription =
    cleanPlainText(product.shortDescription, 240) || detailedDescription.slice(0, 240);
  const publicValue = (field: ProductFieldVisibilityKey, value: string) =>
    productFieldRequiresValue(visible, field) ? value : "";
  const publicList = (field: ProductFieldVisibilityKey, value: string[]) =>
    productFieldRequiresValue(visible, field) ? value : [];

  return {
    id,
    sellerCompanyId,
    name: cleanPlainText(product.name, 120),
    nameEn: cleanPlainText(product.nameEn, 120),
    slug: `${slugify(product.name) || "product"}-${slugSuffix}-${bulkProductInputFingerprint(product)}`,
    imageUrl: null,
    category: product.category,
    tags: product.tags,
    tagsEn: product.tagsEn,
    shortDescription,
    shortDescriptionEn: cleanPlainText(product.shortDescriptionEn, 240),
    detailedDescription,
    detailedDescriptionEn: cleanPlainText(product.detailedDescriptionEn, 5000),
    priceMin: product.wholesalePrice,
    priceMax: product.retailPrice,
    currency: product.currency,
    priceUnit: product.priceUnit || "unit",
    moq: `${product.moqQuantity} ${product.moqUnit}`,
    moqQuantity: product.moqQuantity,
    moqUnit: product.moqUnit,
    leadTime: publicValue("leadTime", product.leadTime),
    leadTimeCode: publicValue("leadTime", product.leadTime),
    sampleAvailability: publicValue("sampleAvailability", product.sampleAvailability),
    privateLabelAvailability: publicValue(
      "privateLabelAvailability",
      product.privateLabelAvailability,
    ),
    monthlyCapacity: publicValue("monthlySupplyCapacity", product.monthlyCapacity),
    monthlyCapacityUnit: product.monthlyCapacityUnit || "unit",
    origin: product.countryOfOrigin || SOUTH_KOREA,
    countryOfOrigin: product.countryOfOrigin || SOUTH_KOREA,
    shippingOriginCountry: product.shippingOriginCountry || SOUTH_KOREA,
    shippingOriginRegion: product.shippingOriginRegion,
    incoterms: publicList("incoterms", product.incoterms),
    hsCode: publicValue("hsCode", product.hsCode),
    shelfLife: publicValue("shelfLife", product.shelfLife),
    storageRequirements: publicValue("storageRequirements", product.storageRequirements),
    documentsAvailable: publicList("documents", product.documentsAvailable),
    complianceClaims: publicList("complianceInfo", product.complianceClaims),
    certifications: publicList("complianceInfo", product.complianceClaims),
    buyerNotes: cleanPlainText(product.buyerNotes, 1000),
    buyerNotesEn: cleanPlainText(product.buyerNotesEn, 1000),
    ingredientsOrMaterials: publicValue(
      "ingredientsMaterials",
      product.ingredientsOrMaterials,
    ),
    packaging: publicValue("packaging", product.packaging),
    packageSize: publicValue("packageSize", product.packageSize),
    unitsPerCarton: publicValue("unitsPerCarton", product.unitsPerCarton),
    cartonWeight: publicValue("cartonWeight", product.cartonWeight),
    cartonDimensions: publicValue("cartonDimensions", product.cartonDimensions),
    palletQuantity: publicValue("palletQuantity", product.palletQuantity),
    storageTemperature: publicValue("storageTemperature", product.storageTemperature),
    suggestedUsChannels: product.suggestedUsChannels,
    fieldVisibility: visible,
    exportReadiness: product.exportReadiness,
    status: "inactive" as const,
  };
}

function bulkProductInputFingerprint(product: BulkProductInput) {
  return createHash("sha256")
    .update(JSON.stringify(product))
    .digest("hex")
    .slice(0, 8);
}

function validateBulkProductRow({
  row,
  locale,
  existingNames,
  fileNameCounts,
}: {
  row: RawBulkProductRow;
  locale: Locale;
  existingNames: Set<string>;
  fileNameCounts: Map<string, number>;
}): BulkProductPreviewRow {
  const errors: BulkProductValidationIssue[] = [];
  const warnings: BulkProductValidationIssue[] = [];
  const raw = row.values;
  const issue = (
    list: BulkProductValidationIssue[],
    field: string,
    messageEn: string,
    messageKo: string,
  ) => {
    list.push({
      field,
      column: headerForKey(field, locale),
      message: locale === "ko" ? messageKo : messageEn,
    });
  };

  for (const field of row.formulaColumns) {
    issue(
      errors,
      field,
      "Formula cells are not allowed.",
      "수식 셀은 사용할 수 없습니다.",
    );
  }

  const visibility = parseVisibility(raw, locale, errors);
  const name = cleanPlainText(raw.name, 120);
  const category = resolveOption(raw.category, optionGroupValues("category", locale));
  const currency = resolveOption(raw.currency, optionGroupValues("currency", locale));
  const priceUnit =
    resolveOption(raw.priceUnit, optionGroupValues("priceUnit", locale)) || "unit";
  const moqUnit = resolveOption(raw.moqUnit, optionGroupValues("moqUnit", locale));
  const leadTime = resolveOption(raw.leadTime, optionGroupValues("leadTime", locale));
  const sampleAvailability = resolveOption(
    raw.sampleAvailability,
    optionGroupValues("sampleAvailability", locale),
  );
  const privateLabelAvailability = resolveOption(
    raw.privateLabelAvailability,
    optionGroupValues("privateLabelAvailability", locale),
  );
  const monthlyCapacityUnit =
    resolveOption(raw.monthlyCapacityUnit, optionGroupValues("priceUnit", locale)) ||
    "unit";
  const countryOfOrigin =
    resolveOption(raw.countryOfOrigin, optionGroupValues("country", locale)) ||
    SOUTH_KOREA;
  const shippingOriginCountry =
    resolveOption(raw.shippingOriginCountry, optionGroupValues("country", locale)) ||
    SOUTH_KOREA;
  const shippingOriginRegion = resolveOption(
    raw.shippingOriginRegion,
    optionGroupValues("koreanRegion", locale),
  );
  const incoterms = resolveList(raw.incoterms, optionGroupValues("incoterms", locale));
  const documentsAvailable = resolveList(
    raw.documentsAvailable,
    optionGroupValues("documents", locale),
  );
  const complianceClaims = resolveList(
    raw.complianceClaims,
    optionGroupValues("compliance", locale),
  );
  const suggestedUsChannels = resolveList(
    raw.suggestedUsChannels,
    optionGroupValues("salesChannels", locale),
  );
  const exportReadiness = resolveOption(
    raw.exportReadiness,
    optionGroupValues("boolean", locale),
  );

  if (!name) issue(errors, "name", "Product name is required.", "상품명을 입력해 주세요.");
  if (!category || !isMarketplaceCategory(category)) {
    issue(errors, "category", "Category is not supported.", "지원하지 않는 카테고리입니다.");
  }
  const detailedDescription = cleanPlainText(raw.detailedDescription, 5000);
  if (!detailedDescription) {
    issue(
      errors,
      "detailedDescription",
      "Detailed product description is required.",
      "상세 상품 설명을 입력해 주세요.",
    );
  }

  validateOptionIfProvided(raw.currency, currency, "currency", errors, locale);
  validateOptionIfProvided(raw.priceUnit, priceUnit, "priceUnit", errors, locale);
  validateOptionIfProvided(raw.moqUnit, moqUnit, "moqUnit", errors, locale);
  validateOptionIfProvided(raw.leadTime, leadTime, "leadTime", errors, locale);
  validateOptionIfProvided(
    raw.sampleAvailability,
    sampleAvailability,
    "sampleAvailability",
    errors,
    locale,
  );
  validateOptionIfProvided(
    raw.privateLabelAvailability,
    privateLabelAvailability,
    "privateLabelAvailability",
    errors,
    locale,
  );
  validateOptionIfProvided(
    raw.monthlyCapacityUnit,
    monthlyCapacityUnit,
    "monthlyCapacityUnit",
    errors,
    locale,
  );
  validateOptionIfProvided(raw.countryOfOrigin, countryOfOrigin, "countryOfOrigin", errors, locale);
  validateOptionIfProvided(
    raw.shippingOriginCountry,
    shippingOriginCountry,
    "shippingOriginCountry",
    errors,
    locale,
  );
  if (shippingOriginCountry === SOUTH_KOREA) {
    validateOptionIfProvided(
      raw.shippingOriginRegion,
      shippingOriginRegion,
      "shippingOriginRegion",
      errors,
      locale,
    );
  }
  validateListIfProvided(raw.incoterms, incoterms, "incoterms", errors, locale);
  validateListIfProvided(
    raw.documentsAvailable,
    documentsAvailable,
    "documentsAvailable",
    errors,
    locale,
  );
  validateListIfProvided(
    raw.complianceClaims,
    complianceClaims,
    "complianceClaims",
    errors,
    locale,
  );
  validateListIfProvided(
    raw.suggestedUsChannels,
    suggestedUsChannels,
    "suggestedUsChannels",
    errors,
    locale,
  );
  validateOptionIfProvided(
    raw.exportReadiness,
    exportReadiness,
    "exportReadiness",
    errors,
    locale,
  );

  const pricing = validateProductPricing({
    retailPrice: raw.retailPrice,
    wholesalePrice: raw.wholesalePrice,
    currency,
    moqQuantity: raw.moqQuantity,
    moqUnit,
  });
  if (hasProductPricingErrors(pricing)) {
    for (const [field, code] of Object.entries(pricing.errors)) {
      const messages = pricingErrorMessage(code, locale);
      issue(errors, field, messages.en, messages.ko);
    }
  }

  validatePublicValue(visibility, "leadTime", leadTime, "leadTime", errors, locale);
  validatePublicValue(
    visibility,
    "sampleAvailability",
    sampleAvailability,
    "sampleAvailability",
    errors,
    locale,
  );
  validatePublicValue(
    visibility,
    "privateLabelAvailability",
    privateLabelAvailability,
    "privateLabelAvailability",
    errors,
    locale,
  );
  validatePublicPositive(
    visibility,
    "monthlySupplyCapacity",
    raw.monthlyCapacity,
    "monthlyCapacity",
    errors,
    locale,
  );
  validatePublicList(visibility, "incoterms", incoterms, "incoterms", errors, locale);
  validatePublicValue(visibility, "hsCode", raw.hsCode, "hsCode", errors, locale);
  validatePublicValue(visibility, "shelfLife", raw.shelfLife, "shelfLife", errors, locale);
  validatePublicValue(
    visibility,
    "storageRequirements",
    raw.storageRequirements,
    "storageRequirements",
    errors,
    locale,
  );
  validatePublicList(
    visibility,
    "documents",
    documentsAvailable,
    "documentsAvailable",
    errors,
    locale,
  );
  validatePublicList(
    visibility,
    "complianceInfo",
    complianceClaims,
    "complianceClaims",
    errors,
    locale,
  );
  validatePublicValue(
    visibility,
    "ingredientsMaterials",
    raw.ingredientsOrMaterials,
    "ingredientsOrMaterials",
    errors,
    locale,
  );
  validatePublicValue(visibility, "packaging", raw.packaging, "packaging", errors, locale);
  validatePublicValue(visibility, "packageSize", raw.packageSize, "packageSize", errors, locale);
  validatePublicPositive(
    visibility,
    "unitsPerCarton",
    raw.unitsPerCarton,
    "unitsPerCarton",
    errors,
    locale,
  );
  validatePublicValue(
    visibility,
    "cartonWeight",
    raw.cartonWeight,
    "cartonWeight",
    errors,
    locale,
  );
  validatePublicValue(
    visibility,
    "cartonDimensions",
    raw.cartonDimensions,
    "cartonDimensions",
    errors,
    locale,
  );
  validatePublicPositive(
    visibility,
    "palletQuantity",
    raw.palletQuantity,
    "palletQuantity",
    errors,
    locale,
  );
  validatePublicValue(
    visibility,
    "storageTemperature",
    raw.storageTemperature,
    "storageTemperature",
    errors,
    locale,
  );

  const normalizedName = normalizeName(name);
  if (normalizedName && (fileNameCounts.get(normalizedName) ?? 0) > 1) {
    issue(
      warnings,
      "name",
      "This product name is duplicated in the workbook.",
      "파일 안에 같은 상품명이 여러 번 있습니다.",
    );
  }
  if (normalizedName && existingNames.has(normalizedName)) {
    issue(
      warnings,
      "name",
      "A product with this name already exists in your catalog.",
      "현재 상품 목록에 같은 이름의 상품이 있습니다.",
    );
  }

  const product: BulkProductInput = {
    name,
    nameEn: cleanPlainText(raw.nameEn, 120),
    category,
    tags: commaList(raw.tags),
    tagsEn: commaList(raw.tagsEn),
    shortDescription: cleanPlainText(raw.shortDescription, 240),
    shortDescriptionEn: cleanPlainText(raw.shortDescriptionEn, 240),
    detailedDescription,
    detailedDescriptionEn: cleanPlainText(raw.detailedDescriptionEn, 5000),
    retailPrice:
      pricing.retailPrice === null ? cleanPlainText(raw.retailPrice, 40) : String(pricing.retailPrice),
    wholesalePrice:
      pricing.wholesalePrice === null
        ? cleanPlainText(raw.wholesalePrice, 40)
        : String(pricing.wholesalePrice),
    currency,
    priceUnit,
    moqQuantity: pricing.moqQuantity ?? cleanPlainText(raw.moqQuantity, 40),
    moqUnit,
    leadTime,
    sampleAvailability,
    privateLabelAvailability,
    monthlyCapacity: cleanPlainText(raw.monthlyCapacity, 80),
    monthlyCapacityUnit,
    countryOfOrigin,
    shippingOriginCountry,
    shippingOriginRegion:
      shippingOriginCountry === SOUTH_KOREA
        ? shippingOriginRegion
        : cleanPlainText(raw.shippingOriginRegion, 120),
    incoterms,
    hsCode: cleanPlainText(raw.hsCode, 40),
    shelfLife: cleanPlainText(raw.shelfLife, 120),
    storageRequirements: cleanPlainText(raw.storageRequirements, 1000),
    documentsAvailable,
    complianceClaims,
    buyerNotes: cleanPlainText(raw.buyerNotes, 1000),
    buyerNotesEn: cleanPlainText(raw.buyerNotesEn, 1000),
    packageSize: cleanPlainText(raw.packageSize, 120),
    unitsPerCarton: cleanPlainText(raw.unitsPerCarton, 80),
    cartonWeight: cleanPlainText(raw.cartonWeight, 120),
    cartonDimensions: cleanPlainText(raw.cartonDimensions, 120),
    palletQuantity: cleanPlainText(raw.palletQuantity, 80),
    storageTemperature: cleanPlainText(raw.storageTemperature, 120),
    suggestedUsChannels,
    ingredientsOrMaterials: cleanPlainText(raw.ingredientsOrMaterials, 1000),
    packaging: cleanPlainText(raw.packaging, 1000),
    exportReadiness: exportReadiness === "true",
    fieldVisibility: visibility,
  };

  return {
    excelRow: row.excelRow,
    product,
    status: errors.length ? "error" : warnings.length ? "warning" : "ready",
    errors: dedupeIssues(errors),
    warnings: dedupeIssues(warnings),
  };
}

function column(
  key: string,
  en: string,
  ko: string,
  descriptionEn: string,
  descriptionKo: string,
  options: Pick<BulkColumnDefinition, "required" | "example" | "options" | "width"> = {},
): BulkColumnDefinition {
  return { key, en, ko, descriptionEn, descriptionKo, ...options };
}

function visibilityColumn(
  key: string,
  en: string,
  ko: string,
  defaultValue: ProductFieldVisibilityLevel,
) {
  return column(
    key,
    en,
    ko,
    `Optional. public, inquiry_required, or private. Default: ${defaultValue}.`,
    `선택. 공개, 문의 필요, 비공개 중 선택. 기본값: ${visibilityKoreanLabels[defaultValue]}.`,
    { example: defaultValue, options: "visibility", width: 24 },
  );
}

function headerFor(definition: BulkColumnDefinition, locale: Locale) {
  return `${locale === "ko" ? definition.ko : definition.en}${definition.required ? " *" : ""}`;
}

function headerForKey(key: string, locale: Locale) {
  const definition = columns.find((item) => item.key === key);
  return definition ? headerFor(definition, locale) : key;
}

function normalizeHeader(value: string) {
  return value.trim().replace(/\s*\*$/, "").toLocaleLowerCase();
}

function createHeaderLookup() {
  const lookup = new Map<string, string>();
  for (const definition of columns) {
    lookup.set(normalizeHeader(definition.en), definition.key);
    lookup.set(normalizeHeader(definition.ko), definition.key);
  }
  return lookup;
}

function localizedExample(definition: BulkColumnDefinition, locale: Locale) {
  if (locale !== "ko" || !definition.options || definition.example == null) {
    return definition.example ?? "";
  }
  const options = optionGroupValues(definition.options, locale);
  return options.find((item) => item.value === String(definition.example))?.label ??
    definition.example;
}

function buildInstructionsSheet(locale: Locale): WriteSheet {
  const title =
    locale === "ko" ? "Trade82 대량 상품 등록 안내" : "Trade82 bulk product registration";
  const instructions =
    locale === "ko"
      ? [
          "Products 시트의 예시 행을 삭제한 뒤 상품 정보를 입력하세요.",
          `한 파일에 최대 ${BULK_PRODUCT_MAX_ROWS}개 상품을 입력할 수 있습니다.`,
          "* 표시 열은 필수입니다. 샘플 제공 여부 등 공개 범위가 '공개'인 필드도 값을 입력해야 합니다.",
          "여러 값을 입력하는 열은 | 기호로 구분하세요. 태그는 쉼표로 구분합니다.",
          "수식 셀은 보안상 허용되지 않습니다. 값만 입력하세요.",
          "이미지는 일괄 생성 후 Trade82 화면에서 상품별로 등록합니다.",
          "모든 상품은 Preparing / Inactive 상태로 생성되며 자동 공개되지 않습니다.",
        ]
      : [
          "Delete the example row in Products, then enter your product information.",
          `A workbook can contain up to ${BULK_PRODUCT_MAX_ROWS} products.`,
          "Columns marked * are required. Fields with Public visibility, including sample availability, also require values.",
          "Use | between multiple option values. Use commas between tags.",
          "Formula cells are rejected for security. Enter values only.",
          "Add images to each product in Trade82 after the import is complete.",
          "Every imported product is created as Preparing / Inactive and is never published automatically.",
        ];
  const rows: CellValue[][] = [
    [title, null],
    [null, null],
    ...instructions.map((instruction, index) => [index + 1, instruction]),
    [null, null],
    [
      locale === "ko" ? "열" : "Column",
      locale === "ko" ? "입력 방법" : "Instructions",
    ],
    ...columns.map((definition) => [
      headerFor(definition, locale),
      locale === "ko" ? definition.descriptionKo : definition.descriptionEn,
    ]),
  ];
  const columnHeaderRow = instructions.length + 3;
  const cells = new Map<string, Partial<Cell>>();
  cells.set("0,0", {
    value: title,
    type: "string",
    style: {
      font: { bold: true, size: 16 },
      alignment: { vertical: "center" },
    },
  });
  for (const columnIndex of [0, 1]) {
    const value = rows[columnHeaderRow][columnIndex];
    cells.set(`${columnHeaderRow},${columnIndex}`, {
      value,
      type: "string",
      style: {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { rgb: "171717" },
        },
        alignment: { vertical: "center" },
      },
    });
  }
  return {
    name: "Instructions",
    rows,
    columns: [
      {
        width: 42,
        style: { alignment: { vertical: "top", wrapText: true } },
      },
      {
        width: 105,
        style: { alignment: { vertical: "top", wrapText: true } },
      },
    ],
    cells,
    freezePane: { rows: columnHeaderRow + 1 },
  };
}

function buildOptionsSheet(locale: Locale) {
  const groups: BulkOptionGroup[] = [
    "category",
    "currency",
    "priceUnit",
    "moqUnit",
    "leadTime",
    "sampleAvailability",
    "privateLabelAvailability",
    "country",
    "koreanRegion",
    "incoterms",
    "documents",
    "compliance",
    "salesChannels",
    "visibility",
    "boolean",
  ];
  const groupedOptions = groups.map((group) => optionGroupValues(group, locale));
  const maxOptionCount = Math.max(...groupedOptions.map((options) => options.length));
  const rows: CellValue[][] = [
    groups.map((group) => optionGroupLabel(group, locale)),
    ...Array.from({ length: maxOptionCount }, (_, rowIndex) =>
      groupedOptions.map((options) => options[rowIndex]?.label ?? null),
    ),
  ];
  const ranges = new Map<BulkOptionGroup, string>();
  groups.forEach((group, index) => {
    const letter = colToLetter(index);
    const optionCount = groupedOptions[index].length;
    ranges.set(group, `'Options'!$${letter}$2:$${letter}$${optionCount + 1}`);
  });
  const cells = new Map<string, Partial<Cell>>();
  groups.forEach((group, index) => {
    cells.set(`0,${index}`, {
      value: optionGroupLabel(group, locale),
      type: "string",
      style: {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { rgb: "171717" },
        },
        alignment: { vertical: "center" },
      },
    });
  });
  return {
    ranges,
    sheet: {
      name: "Options",
      rows,
      columns: groupedOptions.map((options) => ({
        width: Math.min(
          36,
          Math.max(16, ...options.map((option) => option.label.length + 3)),
        ),
      })),
      cells,
      freezePane: { rows: 1 },
      autoFilter: { range: `A1:${colToLetter(groups.length - 1)}${maxOptionCount + 1}` },
    } satisfies WriteSheet,
  };
}

function optionGroupValues(group: BulkOptionGroup, locale: Locale): SelectOption[] {
  const localized = (getOptions: (locale: Locale) => SelectOption[]) => {
    const en = getOptions("en");
    const ko = getOptions("ko");
    return en.map((option) => ({
      value: option.value,
      label:
        locale === "ko"
          ? ko.find((candidate) => candidate.value === option.value)?.label ?? option.label
          : option.label,
    }));
  };

  switch (group) {
    case "category":
      return localized(getSellerProductCategoryOptions);
    case "currency":
      return ["USD", "KRW", "EUR", "JPY"].map((value) => ({ value, label: value }));
    case "priceUnit":
      return localized(getPriceUnitOptions);
    case "moqUnit":
      return localized(getMoqUnitOptions).filter((option) => option.value !== "Not fixed");
    case "leadTime":
      return localized(getLeadTimeOptions);
    case "sampleAvailability":
      return localized(getSampleAvailabilityOptions);
    case "privateLabelAvailability":
      return localized(getPrivateLabelOptions);
    case "country":
      return localized(getCountryOptions);
    case "koreanRegion":
      return localized(getKoreanRegionOptions);
    case "incoterms":
      return localized(getIncotermOptions);
    case "documents":
      return localized(getSellerDocumentOptions);
    case "compliance":
      return localized(getComplianceClaimOptions);
    case "salesChannels":
      return localized(getSalesChannelOptions);
    case "visibility":
      return visibilityOptions.map((option) => ({
        value: option.value,
        label:
          locale === "ko"
            ? visibilityKoreanLabels[option.value as ProductFieldVisibilityLevel]
            : option.label,
      }));
    case "boolean":
      return locale === "ko"
        ? [{ value: "true", label: "예" }, { value: "false", label: "아니요" }]
        : [{ value: "true", label: "Yes" }, { value: "false", label: "No" }];
  }
}

function optionGroupLabel(group: BulkOptionGroup, locale: Locale) {
  const labels: Record<BulkOptionGroup, [string, string]> = {
    category: ["Category", "카테고리"],
    currency: ["Currency", "통화"],
    priceUnit: ["Price unit", "가격 단위"],
    moqUnit: ["MOQ unit", "MOQ 단위"],
    leadTime: ["Lead time", "리드타임"],
    sampleAvailability: ["Sample availability", "샘플 제공"],
    privateLabelAvailability: ["Private label", "자체 브랜드"],
    country: ["Country", "국가"],
    koreanRegion: ["Korean region", "한국 지역"],
    incoterms: ["Incoterms", "인코텀즈"],
    documents: ["Documents", "문서"],
    compliance: ["Compliance", "인증·규정"],
    salesChannels: ["Sales channels", "판매 채널"],
    visibility: ["Visibility", "공개 범위"],
    boolean: ["Yes / No", "예 / 아니요"],
  };
  return labels[group][locale === "ko" ? 1 : 0];
}

function parseVisibility(
  raw: Record<string, string>,
  locale: Locale,
  errors: BulkProductValidationIssue[],
): ProductFieldVisibility {
  const result = { ...defaultProductFieldVisibility };
  for (const { inputKey, rawKey } of visibilityFieldColumns) {
    const rawValue = raw[rawKey];
    if (!rawValue) continue;
    const resolved = resolveOption(rawValue, optionGroupValues("visibility", locale));
    if (!resolved) {
      errors.push({
        field: rawKey,
        column: headerForKey(rawKey, locale),
        message:
          locale === "ko"
            ? "공개, 문의 필요 또는 비공개 중 하나를 선택해 주세요."
            : "Select Public, Inquiry required, or Private.",
      });
      continue;
    }
    result[inputKey] = resolved as ProductFieldVisibilityLevel;
  }
  result.minimumUnitPrice = "public";
  result.moq = "public";
  return result;
}

function resolveOption(raw: string, options: SelectOption[]) {
  const normalized = raw.trim().toLocaleLowerCase();
  if (!normalized) return "";
  const allOptions = [...options];
  for (const locale of ["en", "ko"] as const) {
    const group = inferOptionGroup(options);
    if (group) allOptions.push(...optionGroupValues(group, locale));
  }
  return allOptions.find(
    (option) =>
      option.value.toLocaleLowerCase() === normalized ||
      option.label.toLocaleLowerCase() === normalized,
  )?.value ?? "";
}

function inferOptionGroup(options: SelectOption[]): BulkOptionGroup | null {
  const groups: BulkOptionGroup[] = [
    "category",
    "currency",
    "priceUnit",
    "moqUnit",
    "leadTime",
    "sampleAvailability",
    "privateLabelAvailability",
    "country",
    "koreanRegion",
    "incoterms",
    "documents",
    "compliance",
    "salesChannels",
    "visibility",
    "boolean",
  ];
  const values = new Set(options.map((option) => option.value));
  return groups.find((group) => {
    const groupValues = optionGroupValues(group, "en");
    return groupValues.length === options.length &&
      groupValues.every((option) => values.has(option.value));
  }) ?? null;
}

function resolveList(raw: string, options: SelectOption[]) {
  return splitMultiValue(raw)
    .map((value) => resolveOption(value, options))
    .filter((value, index, values) => Boolean(value) && values.indexOf(value) === index);
}

function splitMultiValue(value: string) {
  return value
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

function commaList(value: string) {
  return cleanTags(value.split(","));
}

function validateOptionIfProvided(
  raw: string,
  resolved: string,
  field: string,
  errors: BulkProductValidationIssue[],
  locale: Locale,
) {
  if (!raw.trim() || resolved) return;
  errors.push({
    field,
    column: headerForKey(field, locale),
    message:
      locale === "ko"
        ? "지원하지 않는 값입니다."
        : "This value is not supported.",
  });
}

function validateListIfProvided(
  raw: string,
  resolved: string[],
  field: string,
  errors: BulkProductValidationIssue[],
  locale: Locale,
) {
  if (!raw.trim()) return;
  if (resolved.length === splitMultiValue(raw).length) return;
  errors.push({
    field,
    column: headerForKey(field, locale),
    message:
      locale === "ko"
        ? "지원하지 않는 값이 포함되어 있습니다."
        : "One or more values are not supported.",
  });
}

function validatePublicValue(
  visibility: ProductFieldVisibility,
  visibilityKey: ProductFieldVisibilityKey,
  value: string,
  field: string,
  errors: BulkProductValidationIssue[],
  locale: Locale,
) {
  if (!productFieldRequiresValue(visibility, visibilityKey) || value.trim()) return;
  errors.push(publicRequiredIssue(field, locale));
}

function validatePublicList(
  visibility: ProductFieldVisibility,
  visibilityKey: ProductFieldVisibilityKey,
  value: string[],
  field: string,
  errors: BulkProductValidationIssue[],
  locale: Locale,
) {
  if (!productFieldRequiresValue(visibility, visibilityKey) || value.length) return;
  errors.push(publicRequiredIssue(field, locale));
}

function validatePublicPositive(
  visibility: ProductFieldVisibility,
  visibilityKey: ProductFieldVisibilityKey,
  value: string,
  field: string,
  errors: BulkProductValidationIssue[],
  locale: Locale,
) {
  if (!productFieldRequiresValue(visibility, visibilityKey)) return;
  const number = Number(value);
  if (value.trim() && Number.isFinite(number) && number > 0) return;
  errors.push(publicRequiredIssue(field, locale));
}

function publicRequiredIssue(field: string, locale: Locale) {
  return {
    field,
    column: headerForKey(field, locale),
    message:
      locale === "ko"
        ? "공개 범위가 공개인 경우 값을 입력해야 합니다."
        : "A value is required when visibility is Public.",
  };
}

function pricingErrorMessage(code: string, locale: Locale) {
  void locale;
  const messages: Record<string, { en: string; ko: string }> = {
    retailPriceRequired: {
      en: "Retail price must be a number greater than 0.",
      ko: "소비자가는 0보다 큰 숫자여야 합니다.",
    },
    wholesalePriceRequired: {
      en: "Wholesale price must be a number greater than 0.",
      ko: "도매가는 0보다 큰 숫자여야 합니다.",
    },
    wholesaleExceedsRetail: {
      en: "Wholesale price cannot exceed retail price.",
      ko: "도매가는 소비자가보다 높을 수 없습니다.",
    },
    currencyRequired: {
      en: "Currency is required.",
      ko: "통화를 선택해 주세요.",
    },
    moqQuantityInvalid: {
      en: "MOQ quantity must be an integer of at least 1.",
      ko: "MOQ 수량은 1 이상의 정수여야 합니다.",
    },
    moqUnitRequired: {
      en: "MOQ unit is required.",
      ko: "MOQ 단위를 선택해 주세요.",
    },
  };
  return messages[code] ?? {
    en: "This value is invalid.",
    ko: "올바르지 않은 값입니다.",
  };
}

function cellText(value: CellValue | undefined) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return "";
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function slugify(value: string) {
  return value
    .toLocaleLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function dedupeIssues(issues: BulkProductValidationIssue[]) {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.field}:${issue.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
