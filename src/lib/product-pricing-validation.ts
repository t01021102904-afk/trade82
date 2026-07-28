export type ProductPricingField =
  | "retailPrice"
  | "wholesalePrice"
  | "currency"
  | "moqQuantity"
  | "moqUnit";

export type ProductPricingErrorCode =
  | "retailPriceRequired"
  | "wholesalePriceRequired"
  | "wholesaleExceedsRetail"
  | "currencyRequired"
  | "moqQuantityInvalid"
  | "moqUnitRequired";

export type ProductPricingValidation = {
  errors: Partial<Record<ProductPricingField, ProductPricingErrorCode>>;
  retailPrice: number | null;
  wholesalePrice: number | null;
  currency: string;
  moqQuantity: string | null;
  moqUnit: string;
};

function positiveNumber(value: unknown) {
  const text = typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function positiveInteger(value: unknown) {
  const text = typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
  if (!/^[1-9]\d*$/.test(text)) return null;
  return text;
}

/** Shared client/server validation for values persisted on Product. */
export function validateProductPricing(input: {
  retailPrice: unknown;
  wholesalePrice: unknown;
  currency: unknown;
  moqQuantity: unknown;
  moqUnit: unknown;
}): ProductPricingValidation {
  const retailPrice = positiveNumber(input.retailPrice);
  const wholesalePrice = positiveNumber(input.wholesalePrice);
  const currency = typeof input.currency === "string" ? input.currency.trim() : "";
  const moqQuantity = positiveInteger(input.moqQuantity);
  const moqUnit = typeof input.moqUnit === "string" ? input.moqUnit.trim() : "";
  const errors: ProductPricingValidation["errors"] = {};

  if (retailPrice === null) errors.retailPrice = "retailPriceRequired";
  if (wholesalePrice === null) errors.wholesalePrice = "wholesalePriceRequired";
  if (retailPrice !== null && wholesalePrice !== null && wholesalePrice > retailPrice) {
    errors.wholesalePrice = "wholesaleExceedsRetail";
  }
  if (!currency) errors.currency = "currencyRequired";
  if (moqQuantity === null) errors.moqQuantity = "moqQuantityInvalid";
  if (!moqUnit || moqUnit === "Not fixed") errors.moqUnit = "moqUnitRequired";

  return { errors, retailPrice, wholesalePrice, currency, moqQuantity, moqUnit };
}

export function hasProductPricingErrors(
  validation: ProductPricingValidation,
) {
  return Object.keys(validation.errors).length > 0;
}
