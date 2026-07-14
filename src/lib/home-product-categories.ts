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
  imageSrc: `/categories/${string}.png`;
};

export const homeProductCategories = [
  { id: "beauty", category: "Beauty & Personal Care", imageSrc: "/categories/beauty.png" },
  { id: "food", category: "Food & Snacks", imageSrc: "/categories/food.png" },
  { id: "household", category: "Household Goods", imageSrc: "/categories/household.png" },
  { id: "fashion", category: "Fashion & Apparel", imageSrc: "/categories/fashion.png" },
  { id: "baby", category: "Baby & Kids", imageSrc: "/categories/baby.png" },
  { id: "pet", category: "Pet Products", imageSrc: "/categories/pet.png" },
  { id: "health", category: "Health & Wellness", imageSrc: "/categories/health.png" },
  { id: "electronics", category: "Electronics Accessories", imageSrc: "/categories/electronics.png" },
  { id: "kitchenware", category: "Kitchenware", imageSrc: "/categories/kitchenware.png" },
  { id: "kpop", category: "K-Pop & Character Goods", imageSrc: "/categories/kpop.png" },
  { id: "stationery", category: "Stationery & Lifestyle", imageSrc: "/categories/stationery.png" },
  { id: "packaging", category: "Packaging", imageSrc: "/categories/packaging.png" },
  { id: "industrial", category: "Industrial / B2B Supplies", imageSrc: "/categories/industrial.png" },
  { id: "other", category: "Other", imageSrc: "/categories/other.png" },
] as const satisfies readonly HomeProductCategory[];

export function homeCategoryHref(category: MarketplaceCategory, locale: Locale) {
  const url = new URL(locale === "ko" ? "/ko/marketplace" : "/marketplace", "https://trade82.com");
  url.searchParams.set("category", category);

  // Keep the generated URL readable while still relying on URLSearchParams for escaping.
  return `${url.pathname}${url.search.replace(/\+/g, "%20")}`;
}
