import type { Locale } from "@/lib/i18n";
import type { MarketplaceCategory } from "@/lib/marketplace";

export type HomeProductCategory = {
  id:
    | "beauty"
    | "food"
    | "household"
    | "fashion"
    | "baby"
    | "pet"
    | "health"
    | "electronics"
    | "kitchenware"
    | "kpop"
    | "stationery"
    | "packaging"
    | "industrial"
    | "other";
  category: MarketplaceCategory;
  imageSrc: `/categories/${string}.svg`;
};

export const homeProductCategories = [
  { id: "beauty", category: "Beauty & Personal Care", imageSrc: "/categories/beauty-personal-care.svg" },
  { id: "food", category: "Food & Snacks", imageSrc: "/categories/food-snacks.svg" },
  { id: "household", category: "Household Goods", imageSrc: "/categories/household-goods.svg" },
  { id: "fashion", category: "Fashion & Apparel", imageSrc: "/categories/fashion-apparel.svg" },
  { id: "baby", category: "Baby & Kids", imageSrc: "/categories/baby-kids.svg" },
  { id: "pet", category: "Pet Products", imageSrc: "/categories/pet-products.svg" },
  { id: "health", category: "Health & Wellness", imageSrc: "/categories/health-wellness.svg" },
  { id: "electronics", category: "Electronics Accessories", imageSrc: "/categories/electronics-accessories.svg" },
  { id: "kitchenware", category: "Kitchenware", imageSrc: "/categories/kitchenware.svg" },
  { id: "kpop", category: "K-Pop & Character Goods", imageSrc: "/categories/kpop-character-goods.svg" },
  { id: "stationery", category: "Stationery & Lifestyle", imageSrc: "/categories/stationery-lifestyle.svg" },
  { id: "packaging", category: "Packaging", imageSrc: "/categories/packaging.svg" },
  { id: "industrial", category: "Industrial / B2B Supplies", imageSrc: "/categories/industrial-b2b-supplies.svg" },
  { id: "other", category: "Other", imageSrc: "/categories/other.svg" },
] as const satisfies readonly HomeProductCategory[];

export function homeCategoryHref(category: MarketplaceCategory, locale: Locale) {
  const url = new URL(locale === "ko" ? "/ko/marketplace" : "/marketplace", "https://trade82.com");
  url.searchParams.set("category", category);

  // Keep the generated URL readable while still relying on URLSearchParams for escaping.
  return `${url.pathname}${url.search.replace(/\+/g, "%20")}`;
}
