import type { Locale } from "@/lib/i18n";
import type { MarketplaceCategory } from "@/lib/marketplace";

export type HomeProductCategory = {
  id:
    | "beautyPersonalCare"
    | "foodSnacks"
    | "householdGoods"
    | "fashionApparel"
    | "babyKids"
    | "petProducts"
    | "healthWellness"
    | "electronicsAccessories"
    | "kitchenware"
    | "kpopCharacterGoods"
    | "stationeryLifestyle"
    | "packaging"
    | "industrialB2bSupplies"
    | "other";
  category: MarketplaceCategory;
  imageSrc: `/categories/${string}.svg`;
};

export const homeProductCategories = [
  {
    id: "beautyPersonalCare",
    category: "Beauty & Personal Care",
    imageSrc: "/categories/beauty-personal-care.svg",
  },
  { id: "foodSnacks", category: "Food & Snacks", imageSrc: "/categories/food-snacks.svg" },
  { id: "householdGoods", category: "Household Goods", imageSrc: "/categories/household-goods.svg" },
  { id: "fashionApparel", category: "Fashion & Apparel", imageSrc: "/categories/fashion-apparel.svg" },
  { id: "babyKids", category: "Baby & Kids", imageSrc: "/categories/baby-kids.svg" },
  { id: "petProducts", category: "Pet Products", imageSrc: "/categories/pet-products.svg" },
  { id: "healthWellness", category: "Health & Wellness", imageSrc: "/categories/health-wellness.svg" },
  {
    id: "electronicsAccessories",
    category: "Electronics Accessories",
    imageSrc: "/categories/electronics-accessories.svg",
  },
  { id: "kitchenware", category: "Kitchenware", imageSrc: "/categories/kitchenware.svg" },
  {
    id: "kpopCharacterGoods",
    category: "K-Pop & Character Goods",
    imageSrc: "/categories/kpop-character-goods.svg",
  },
  {
    id: "stationeryLifestyle",
    category: "Stationery & Lifestyle",
    imageSrc: "/categories/stationery-lifestyle.svg",
  },
  { id: "packaging", category: "Packaging", imageSrc: "/categories/packaging.svg" },
  {
    id: "industrialB2bSupplies",
    category: "Industrial / B2B Supplies",
    imageSrc: "/categories/industrial-b2b-supplies.svg",
  },
  { id: "other", category: "Other", imageSrc: "/categories/other.svg" },
] as const satisfies readonly HomeProductCategory[];

export function homeProductCategoryHref(category: MarketplaceCategory, locale: Locale) {
  const localePrefix = locale === "ko" ? "/ko" : "";
  return `${localePrefix}/marketplace?category=${encodeURIComponent(category)}`;
}
