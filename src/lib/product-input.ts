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
  SOUTH_KOREA,
  type SelectOption,
} from "@/lib/company-select-options";
import { cleanPlainText, cleanTags, isMarketplaceCategory } from "@/lib/marketplace";
import {
  parseProductFieldVisibilityInput,
  productFieldRequiresValue,
  type ProductFieldVisibility,
} from "@/lib/product-field-visibility";

export type ProductWriteStatus = "active" | "inactive" | "draft";

export type NormalizedProductInput = {
  name: string;
  nameEn: string;
  category: string;
  tags: string[];
  tagsEn: string[];
  shortDescription: string;
  shortDescriptionEn: string;
  detailedDescription: string;
  detailedDescriptionEn: string;
  priceMin: string | null;
  priceMax: string | null;
  currency: string;
  priceUnit: string;
  moq: string;
  moqQuantity: string;
  moqUnit: string;
  leadTime: string;
  leadTimeCode: string;
  sampleAvailability: string;
  privateLabelAvailability: string;
  monthlyCapacity: string;
  monthlyCapacityUnit: string;
  origin: string;
  countryOfOrigin: string;
  shippingOriginCountry: string;
  shippingOriginRegion: string;
  incoterms: string[];
  hsCode: string;
  shelfLife: string;
  storageRequirements: string;
  documentsAvailable: string[];
  complianceClaims: string[];
  buyerNotes: string;
  buyerNotesEn: string;
  riskNotes: string[];
  certifications: string[];
  ingredientsOrMaterials: string;
  packaging: string;
  packageSize: string;
  unitsPerCarton: string;
  cartonWeight: string;
  cartonDimensions: string;
  palletQuantity: string;
  storageTemperature: string;
  suggestedUsChannels: string[];
  fieldVisibility: ProductFieldVisibility;
  exportReadiness: boolean;
  status: ProductWriteStatus;
};

export class ProductInputValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductInputValidationError";
  }
}

function strings(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function optionValues(options: SelectOption[]) {
  return new Set(options.map((option) => option.value));
}

function allowedOption(value: unknown, options: SelectOption[], fallback = "") {
  const text = cleanPlainText(value, 120);
  return optionValues(options).has(text) ? text : fallback;
}

function allowedList(value: unknown, options: SelectOption[]) {
  const allowed = optionValues(options);
  return Array.from(
    new Set(
      strings(value)
        .map((item) => cleanPlainText(item, 120))
        .filter((item) => allowed.has(item)),
    ),
  );
}

function optionalPositiveText(value: unknown, maxLength = 80) {
  const text = cleanPlainText(value, maxLength);
  if (!text) return "";
  const number = Number(text);
  return Number.isFinite(number) && number >= 0 ? text : "";
}

function requiredPublicField() {
  throw new ProductInputValidationError("공개 항목으로 설정한 경우 입력이 필요합니다.");
}

export function createProductSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function normalizeProductInput(
  body: Record<string, unknown>,
  options: { status: ProductWriteStatus; hasImages: boolean },
): NormalizedProductInput {
  const name = cleanPlainText(body.name, 120);
  const nameEn = cleanPlainText(body.nameEn, 120);
  const category = cleanPlainText(body.category, 80);
  const detailedDescription = cleanPlainText(body.detailedDescription, 5000);
  const detailedDescriptionEn = cleanPlainText(body.detailedDescriptionEn, 5000);
  const fieldVisibility = parseProductFieldVisibilityInput(body.fieldVisibility);
  const priceIsPublic = productFieldRequiresValue(fieldVisibility, "minimumUnitPrice");
  const moqIsPublic = productFieldRequiresValue(fieldVisibility, "moq");
  const leadTimeIsPublic = productFieldRequiresValue(fieldVisibility, "leadTime");
  const priceMin = priceIsPublic ? Number(body.priceMin) : null;
  const priceMax =
    !priceIsPublic ||
    body.priceMax === null ||
    body.priceMax === undefined ||
    body.priceMax === ""
      ? null
      : Number(body.priceMax);
  const moqQuantity = moqIsPublic ? optionalPositiveText(body.moqQuantity) : "";
  const moqUnit = allowedOption(body.moqUnit, getMoqUnitOptions("en"), "Units");
  const leadTime = leadTimeIsPublic
    ? allowedOption(body.leadTime, getLeadTimeOptions("en"))
    : "";
  const countryOfOrigin = allowedOption(
    body.countryOfOrigin,
    getCountryOptions("en"),
    SOUTH_KOREA,
  );
  const shippingOriginCountry = allowedOption(
    body.shippingOriginCountry,
    getCountryOptions("en"),
    SOUTH_KOREA,
  );
  const shippingOriginRegion =
    shippingOriginCountry === SOUTH_KOREA
      ? allowedOption(body.shippingOriginRegion, getKoreanRegionOptions("en"))
      : cleanPlainText(body.shippingOriginRegion, 120);

  if (!name) {
    throw new ProductInputValidationError("상품명을 입력해 주시기 바랍니다.");
  }
  if (!isMarketplaceCategory(category)) {
    throw new ProductInputValidationError("카테고리를 선택해 주시기 바랍니다.");
  }
  if (priceIsPublic && (priceMin === null || !Number.isFinite(priceMin) || priceMin <= 0)) {
    throw new ProductInputValidationError("올바른 가격을 입력해 주시기 바랍니다.");
  }
  if (priceIsPublic && priceMax !== null && (!Number.isFinite(priceMax) || priceMax < 0)) {
    throw new ProductInputValidationError("올바른 가격을 입력해 주시기 바랍니다.");
  }
  if (moqIsPublic && moqUnit !== "Not fixed" && (!moqQuantity || Number(moqQuantity) <= 0)) {
    throw new ProductInputValidationError("MOQ를 입력해 주시기 바랍니다.");
  }
  if (leadTimeIsPublic && !leadTime) {
    throw new ProductInputValidationError("리드타임을 선택해 주시기 바랍니다.");
  }
  if (!detailedDescription) {
    throw new ProductInputValidationError("상품 설명을 입력해 주시기 바랍니다.");
  }
  if (options.status === "active" && !options.hasImages) {
    throw new ProductInputValidationError("상품 공개에는 상품 이미지가 필요합니다.");
  }
  if (
    productFieldRequiresValue(fieldVisibility, "sampleAvailability") &&
    !allowedOption(body.sampleAvailability, getSampleAvailabilityOptions("en"))
  ) {
    requiredPublicField();
  }
  if (
    productFieldRequiresValue(fieldVisibility, "privateLabelAvailability") &&
    !allowedOption(body.privateLabelAvailability, getPrivateLabelOptions("en"))
  ) {
    requiredPublicField();
  }
  if (
    productFieldRequiresValue(fieldVisibility, "monthlySupplyCapacity") &&
    !optionalPositiveText(body.monthlyCapacity)
  ) {
    requiredPublicField();
  }
  if (
    productFieldRequiresValue(fieldVisibility, "incoterms") &&
    !allowedList(body.incoterms, getIncotermOptions("en")).length
  ) {
    requiredPublicField();
  }
  if (productFieldRequiresValue(fieldVisibility, "hsCode") && !cleanPlainText(body.hsCode, 40)) {
    requiredPublicField();
  }
  if (productFieldRequiresValue(fieldVisibility, "shelfLife") && !cleanPlainText(body.shelfLife, 120)) {
    requiredPublicField();
  }
  if (
    productFieldRequiresValue(fieldVisibility, "storageRequirements") &&
    !cleanPlainText(body.storageRequirements, 1000)
  ) {
    requiredPublicField();
  }
  if (
    productFieldRequiresValue(fieldVisibility, "documents") &&
    !allowedList(body.documentsAvailable, getSellerDocumentOptions("en")).length
  ) {
    requiredPublicField();
  }
  if (
    productFieldRequiresValue(fieldVisibility, "complianceInfo") &&
    !allowedList(body.complianceClaims, getComplianceClaimOptions("en")).length
  ) {
    requiredPublicField();
  }
  if (
    productFieldRequiresValue(fieldVisibility, "ingredientsMaterials") &&
    !cleanPlainText(body.ingredientsOrMaterials, 1000)
  ) {
    requiredPublicField();
  }
  if (productFieldRequiresValue(fieldVisibility, "packageSize") && !cleanPlainText(body.packageSize, 120)) {
    requiredPublicField();
  }
  if (productFieldRequiresValue(fieldVisibility, "unitsPerCarton") && !optionalPositiveText(body.unitsPerCarton)) {
    requiredPublicField();
  }
  if (productFieldRequiresValue(fieldVisibility, "cartonWeight") && !cleanPlainText(body.cartonWeight, 120)) {
    requiredPublicField();
  }
  if (
    productFieldRequiresValue(fieldVisibility, "cartonDimensions") &&
    !cleanPlainText(body.cartonDimensions, 120)
  ) {
    requiredPublicField();
  }
  if (productFieldRequiresValue(fieldVisibility, "palletQuantity") && !optionalPositiveText(body.palletQuantity)) {
    requiredPublicField();
  }
  if (
    productFieldRequiresValue(fieldVisibility, "storageTemperature") &&
    !cleanPlainText(body.storageTemperature, 120)
  ) {
    requiredPublicField();
  }
  if (productFieldRequiresValue(fieldVisibility, "packaging") && !cleanPlainText(body.packaging, 1000)) {
    requiredPublicField();
  }

  const complianceClaims = productFieldRequiresValue(fieldVisibility, "complianceInfo")
    ? allowedList(body.complianceClaims, getComplianceClaimOptions("en"))
    : [];

  return {
    name,
    nameEn,
    category,
    tags: cleanTags(body.tags),
    tagsEn: cleanTags(body.tagsEn),
    shortDescription: cleanPlainText(body.shortDescription, 240) || detailedDescription.slice(0, 240),
    shortDescriptionEn: cleanPlainText(body.shortDescriptionEn, 240),
    detailedDescription,
    detailedDescriptionEn,
    priceMin: priceMin === null ? null : String(priceMin),
    priceMax: priceMax === null ? null : String(priceMax),
    currency: cleanPlainText(body.currency, 8) || "USD",
    priceUnit: allowedOption(body.priceUnit, getPriceUnitOptions("en"), "unit"),
    moq: moqIsPublic
      ? cleanPlainText(body.moq, 120) ||
        (moqUnit === "Not fixed" ? "Not fixed" : `${moqQuantity} ${moqUnit}`)
      : "",
    moqQuantity,
    moqUnit,
    leadTime,
    leadTimeCode: leadTime,
    sampleAvailability: productFieldRequiresValue(fieldVisibility, "sampleAvailability")
      ? allowedOption(body.sampleAvailability, getSampleAvailabilityOptions("en"))
      : "",
    privateLabelAvailability: productFieldRequiresValue(fieldVisibility, "privateLabelAvailability")
      ? allowedOption(body.privateLabelAvailability, getPrivateLabelOptions("en"))
      : "",
    monthlyCapacity: productFieldRequiresValue(fieldVisibility, "monthlySupplyCapacity")
      ? optionalPositiveText(body.monthlyCapacity)
      : "",
    monthlyCapacityUnit: allowedOption(body.monthlyCapacityUnit, getPriceUnitOptions("en"), "unit"),
    origin: countryOfOrigin,
    countryOfOrigin,
    shippingOriginCountry,
    shippingOriginRegion,
    incoterms: productFieldRequiresValue(fieldVisibility, "incoterms")
      ? allowedList(body.incoterms, getIncotermOptions("en"))
      : [],
    hsCode: productFieldRequiresValue(fieldVisibility, "hsCode")
      ? cleanPlainText(body.hsCode, 40)
      : "",
    shelfLife: productFieldRequiresValue(fieldVisibility, "shelfLife")
      ? cleanPlainText(body.shelfLife, 120)
      : "",
    storageRequirements: productFieldRequiresValue(fieldVisibility, "storageRequirements")
      ? cleanPlainText(body.storageRequirements, 1000)
      : "",
    documentsAvailable: productFieldRequiresValue(fieldVisibility, "documents")
      ? allowedList(body.documentsAvailable, getSellerDocumentOptions("en"))
      : [],
    complianceClaims,
    buyerNotes: cleanPlainText(body.buyerNotes, 1000),
    buyerNotesEn: cleanPlainText(body.buyerNotesEn, 1000),
    riskNotes: strings(body.riskNotes).map((item) => cleanPlainText(item, 300)).filter(Boolean),
    certifications: productFieldRequiresValue(fieldVisibility, "complianceInfo")
      ? allowedList(body.complianceClaims ?? body.certifications, getComplianceClaimOptions("en"))
      : [],
    ingredientsOrMaterials: productFieldRequiresValue(fieldVisibility, "ingredientsMaterials")
      ? cleanPlainText(body.ingredientsOrMaterials, 1000)
      : "",
    packaging: productFieldRequiresValue(fieldVisibility, "packaging")
      ? cleanPlainText(body.packaging, 1000)
      : "",
    packageSize: productFieldRequiresValue(fieldVisibility, "packageSize")
      ? cleanPlainText(body.packageSize, 120)
      : "",
    unitsPerCarton: productFieldRequiresValue(fieldVisibility, "unitsPerCarton")
      ? optionalPositiveText(body.unitsPerCarton)
      : "",
    cartonWeight: productFieldRequiresValue(fieldVisibility, "cartonWeight")
      ? cleanPlainText(body.cartonWeight, 120)
      : "",
    cartonDimensions: productFieldRequiresValue(fieldVisibility, "cartonDimensions")
      ? cleanPlainText(body.cartonDimensions, 120)
      : "",
    palletQuantity: productFieldRequiresValue(fieldVisibility, "palletQuantity")
      ? optionalPositiveText(body.palletQuantity)
      : "",
    storageTemperature: productFieldRequiresValue(fieldVisibility, "storageTemperature")
      ? cleanPlainText(body.storageTemperature, 120)
      : "",
    suggestedUsChannels: allowedList(body.suggestedUsChannels, getSalesChannelOptions("en")),
    fieldVisibility,
    exportReadiness: body.exportReadiness === true,
    status: options.status,
  };
}
