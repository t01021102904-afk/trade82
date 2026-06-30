export type ProductFieldVisibilityLevel =
  | "public"
  | "inquiry_required"
  | "private";

export type ProductFieldVisibilityKey =
  | "minimumUnitPrice"
  | "moq"
  | "leadTime"
  | "sampleAvailability"
  | "privateLabelAvailability"
  | "monthlySupplyCapacity"
  | "incoterms"
  | "hsCode"
  | "shelfLife"
  | "storageRequirements"
  | "documents"
  | "complianceInfo"
  | "ingredientsMaterials"
  | "packageSize"
  | "unitsPerCarton"
  | "cartonWeight"
  | "cartonDimensions"
  | "palletQuantity"
  | "storageTemperature"
  | "packaging";

export type ProductFieldVisibility = Record<
  ProductFieldVisibilityKey,
  ProductFieldVisibilityLevel
>;

export const productFieldVisibilityKeys: ProductFieldVisibilityKey[] = [
  "minimumUnitPrice",
  "moq",
  "leadTime",
  "sampleAvailability",
  "privateLabelAvailability",
  "monthlySupplyCapacity",
  "incoterms",
  "hsCode",
  "shelfLife",
  "storageRequirements",
  "documents",
  "complianceInfo",
  "ingredientsMaterials",
  "packageSize",
  "unitsPerCarton",
  "cartonWeight",
  "cartonDimensions",
  "palletQuantity",
  "storageTemperature",
  "packaging",
];

export const productFieldVisibilityLevels: ProductFieldVisibilityLevel[] = [
  "public",
  "inquiry_required",
  "private",
];

export const defaultProductFieldVisibility: ProductFieldVisibility = {
  minimumUnitPrice: "inquiry_required",
  moq: "inquiry_required",
  leadTime: "inquiry_required",
  sampleAvailability: "public",
  privateLabelAvailability: "inquiry_required",
  monthlySupplyCapacity: "inquiry_required",
  incoterms: "inquiry_required",
  hsCode: "inquiry_required",
  shelfLife: "inquiry_required",
  storageRequirements: "inquiry_required",
  documents: "inquiry_required",
  complianceInfo: "inquiry_required",
  ingredientsMaterials: "inquiry_required",
  packageSize: "inquiry_required",
  unitsPerCarton: "inquiry_required",
  cartonWeight: "inquiry_required",
  cartonDimensions: "inquiry_required",
  palletQuantity: "inquiry_required",
  storageTemperature: "inquiry_required",
  packaging: "inquiry_required",
};

const fieldValueMap: Record<ProductFieldVisibilityKey, string[]> = {
  minimumUnitPrice: ["priceMin", "priceMax"],
  moq: ["moq", "moqQuantity"],
  leadTime: ["leadTime", "leadTimeCode"],
  sampleAvailability: ["sampleAvailability"],
  privateLabelAvailability: ["privateLabelAvailability"],
  monthlySupplyCapacity: ["monthlyCapacity"],
  incoterms: ["incoterms"],
  hsCode: ["hsCode"],
  shelfLife: ["shelfLife"],
  storageRequirements: ["storageRequirements"],
  documents: ["documentsAvailable"],
  complianceInfo: ["complianceClaims", "certifications"],
  ingredientsMaterials: ["ingredientsOrMaterials"],
  packageSize: ["packageSize"],
  unitsPerCarton: ["unitsPerCarton"],
  cartonWeight: ["cartonWeight"],
  cartonDimensions: ["cartonDimensions"],
  palletQuantity: ["palletQuantity"],
  storageTemperature: ["storageTemperature"],
  packaging: ["packaging"],
};

const arrayFields = new Set(["incoterms", "documentsAvailable", "complianceClaims", "certifications"]);
const nullableFields = new Set(["priceMin", "priceMax"]);

export function normalizeProductFieldVisibility(
  value: unknown,
): ProductFieldVisibility {
  const source =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  return productFieldVisibilityKeys.reduce<ProductFieldVisibility>(
    (next, key) => {
      const level = source[key];
      next[key] = productFieldVisibilityLevels.includes(
        level as ProductFieldVisibilityLevel,
      )
        ? (level as ProductFieldVisibilityLevel)
        : defaultProductFieldVisibility[key];
      return next;
    },
    { ...defaultProductFieldVisibility },
  );
}

export function parseProductFieldVisibilityInput(value: unknown) {
  return normalizeProductFieldVisibility(value);
}

export function productFieldIsHidden(
  visibility: ProductFieldVisibility,
  key: ProductFieldVisibilityKey,
) {
  return visibility[key] === "inquiry_required" || visibility[key] === "private";
}

export function productFieldRequiresValue(
  visibility: ProductFieldVisibility,
  key: ProductFieldVisibilityKey,
) {
  return visibility[key] === "public";
}

export function maskProductFieldsForViewer<T extends Record<string, unknown>>(
  product: T,
  canViewSensitiveFields: boolean,
) {
  const fieldVisibility = normalizeProductFieldVisibility(product.fieldVisibility);
  if (canViewSensitiveFields) return { ...product, fieldVisibility };

  const masked: Record<string, unknown> = { ...product, fieldVisibility };

  for (const key of productFieldVisibilityKeys) {
    if (!productFieldIsHidden(fieldVisibility, key)) continue;

    for (const fieldName of fieldValueMap[key]) {
      if (arrayFields.has(fieldName)) {
        masked[fieldName] = [];
      } else if (nullableFields.has(fieldName)) {
        masked[fieldName] = null;
      } else {
        masked[fieldName] = "";
      }
    }
  }

  return masked as T & { fieldVisibility: ProductFieldVisibility };
}
