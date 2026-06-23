export const marketplaceCategories = [
  "Beauty & Skincare",
  "Food & Beverage",
  "Apparel",
  "Supplements",
  "Home Goods",
  "Pet Products",
  "Health & Wellness",
] as const;

export type MarketplaceCategory = (typeof marketplaceCategories)[number];

export type UploadedListingImage = {
  originalUrl: string;
  cardUrl: string;
  mainUrl: string;
  detailUrl: string;
  storagePath: string;
  width: number | null;
  height: number | null;
};

export function cleanPlainText(value: unknown, maxLength: number) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, maxLength);
}

export function cleanTags(value: unknown) {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => cleanPlainText(item.replace(/^#/, ""), 30))
        .filter(Boolean),
    ),
  ).slice(0, 10);
}

export function parseUploadedImages(value: unknown) {
  if (!Array.isArray(value)) return [];
  if (value.length > 12) {
    throw new Error("이미지는 최대 12장까지 등록할 수 있어요.");
  }

  return value.map((item, index) => {
    const image = (item ?? {}) as Record<string, unknown>;
    const parsed = {
      originalUrl: validPublicUrl(image.originalUrl),
      cardUrl: validPublicUrl(image.cardUrl),
      mainUrl: validPublicUrl(image.mainUrl),
      detailUrl: validPublicUrl(image.detailUrl),
      storagePath: cleanPlainText(image.storagePath, 500),
      width: finiteNumber(image.width),
      height: finiteNumber(image.height),
      position: index,
    };

    if (
      !parsed.originalUrl ||
      !parsed.cardUrl ||
      !parsed.mainUrl ||
      !parsed.detailUrl ||
      !parsed.storagePath
    ) {
      throw new Error("업로드된 이미지 정보가 올바르지 않아요.");
    }

    return parsed;
  });
}

function validPublicUrl(value: unknown) {
  try {
    const url = new URL(String(value ?? ""));
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : "";
  } catch {
    return "";
  }
}

function finiteNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : null;
}
