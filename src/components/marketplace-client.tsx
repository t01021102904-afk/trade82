"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";

import { useI18n } from "@/components/i18n-provider";
import { ProductCard, ProductCardSkeleton } from "@/components/product-card";
import { marketplaceCategories } from "@/lib/marketplace";
import type { Product } from "@/lib/types";

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium text-zinc-700">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-zinc-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function MarketplaceClient({ products }: { products: Product[] }) {
  const { t } = useI18n();
  const [databaseProducts, setDatabaseProducts] = useState<Product[]>([]);
  const [databaseLoading, setDatabaseLoading] = useState(true);
  const visibleProducts = useMemo(
    () => [
      ...databaseProducts,
      ...products.filter(
        (product) =>
          !databaseProducts.some((databaseProduct) => databaseProduct.id === product.id),
      ),
    ],
    [databaseProducts, products],
  );

  useEffect(() => {
    void fetch("/api/public/marketplace")
      .then((response) => (response.ok ? response.json() : { products: [] }))
      .then((result: { products?: Array<Record<string, unknown>> }) => {
        setDatabaseProducts((result.products ?? []).map(databaseProductToCard));
        setDatabaseLoading(false);
      });
  }, []);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [price, setPrice] = useState("all");
  const [moq, setMoq] = useState("all");
  const [certification, setCertification] = useState("all");
  const [shippingTerm, setShippingTerm] = useState("all");

  const certifications = useMemo(
    () => Array.from(new Set(visibleProducts.flatMap((product) => product.certifications))).sort(),
    [visibleProducts],
  );

  const shippingTerms = useMemo(
    () => Array.from(new Set(visibleProducts.flatMap((product) => product.incoterms))).sort(),
    [visibleProducts],
  );

  const filtered = useMemo(() => {
    return visibleProducts.filter((product) => {
      const haystack = [
        product.name,
        product.category,
        product.sellerName,
        product.sellerLocation,
        product.shortDescription,
        product.certifications.join(" "),
      ]
        .join(" ")
        .toLowerCase();
      const matchesSearch = haystack.includes(search.toLowerCase());
      const matchesCategory = category === "all" || product.category === category;
      const matchesPrice =
        price === "all" ||
        (price === "under-3" && product.wholesalePriceValue < 3) ||
        (price === "3-8" &&
          product.wholesalePriceValue >= 3 &&
          product.wholesalePriceValue <= 8) ||
        (price === "8-plus" && product.wholesalePriceValue > 8);
      const matchesMoq = moq === "all" || product.moqUnits <= Number(moq);
      const matchesCertification =
        certification === "all" || product.certifications.includes(certification);
      const matchesShipping =
        shippingTerm === "all" || product.incoterms.includes(shippingTerm);

      return (
        matchesSearch &&
        matchesCategory &&
        matchesPrice &&
        matchesMoq &&
        matchesCertification &&
        matchesShipping
      );
    });
  }, [visibleProducts, search, category, price, moq, certification, shippingTerm]);

  return (
    <div className="grid min-w-0 gap-8">
      <div className="grid min-w-0 gap-5">
        <label className="relative block">
          <span className="sr-only">{t("marketplace.searchProducts")}</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("marketplace.searchPlaceholder")}
            className="h-12 w-full rounded-md border border-zinc-200 bg-white pl-12 pr-4 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </label>

        <div className="-mx-4 min-w-0 max-w-full overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="flex min-w-max gap-2 pb-1" role="group" aria-label={t("marketplace.category")}>
            {[
              { label: t("marketplace.allCategories"), value: "all" },
              ...marketplaceCategories.map((item) => ({ label: item, value: item })),
            ].map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setCategory(item.value)}
                className={`min-h-11 rounded-md border px-4 text-sm font-medium transition ${
                  category === item.value
                    ? "border-zinc-950 bg-zinc-950 text-white"
                    : "border-zinc-200 bg-white text-zinc-700 hover:border-blue-300 hover:text-blue-700"
                }`}
                aria-pressed={category === item.value}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <details className="rounded-md border border-zinc-200 bg-white">
          <summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm font-medium text-zinc-700">
            {t("marketplace.moreFilters")}
          </summary>
          <div className="grid gap-4 border-t border-zinc-100 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <SelectField
              label={t("marketplace.price")}
              value={price}
              onChange={setPrice}
              options={[
                { label: t("marketplace.anyPrice"), value: "all" },
                { label: t("marketplace.under3"), value: "under-3" },
                { label: t("marketplace.threeToEight"), value: "3-8" },
                { label: t("marketplace.eightPlus"), value: "8-plus" },
              ]}
            />
            <SelectField
              label={t("marketplace.moq")}
              value={moq}
              onChange={setMoq}
              options={[
                { label: t("marketplace.anyMoq"), value: "all" },
                { label: t("marketplace.moq1000"), value: "1000" },
                { label: t("marketplace.moq5000"), value: "5000" },
                { label: t("marketplace.moq10000"), value: "10000" },
              ]}
            />
            <SelectField
              label={t("marketplace.certification")}
              value={certification}
              onChange={setCertification}
              options={[
                { label: t("marketplace.anyCertification"), value: "all" },
                ...certifications.map((item) => ({ label: item, value: item })),
              ]}
            />
            <SelectField
              label={t("marketplace.shipping")}
              value={shippingTerm}
              onChange={setShippingTerm}
              options={[
                { label: t("marketplace.anyTerm"), value: "all" },
                ...shippingTerms.map((item) => ({ label: item, value: item })),
              ]}
            />
          </div>
        </details>

        <div className="flex min-h-11 items-center justify-between border-b border-zinc-200 pb-3 text-sm text-zinc-600">
          <span>{filtered.length} {t("marketplace.productsFound")}</span>
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setCategory("all");
              setPrice("all");
              setMoq("all");
              setCertification("all");
              setShippingTerm("all");
            }}
            className="min-h-11 px-2 font-medium text-blue-700 hover:text-blue-800"
          >
            {t("common.clearFilters")}
          </button>
        </div>
      </div>

      {databaseLoading && !visibleProducts.length ? (
        <div className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <ProductCardSkeleton key={index} />
          ))}
        </div>
      ) : filtered.length ? (
        <div className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
          {filtered.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-10 text-center">
          <h2 className="text-lg font-semibold text-zinc-950">{t("marketplace.emptyTitle")}</h2>
          <p className="mt-2 text-sm text-zinc-600">
            {t("marketplace.emptyText")}
          </p>
        </div>
      )}
    </div>
  );
}

function databaseProductToCard(value: Record<string, unknown>): Product {
  const company = (value.sellerCompany ?? {}) as Record<string, unknown>;
  const images = Array.isArray(value.images)
    ? (value.images as Array<Record<string, unknown>>)
    : [];
  const priceMin = value.priceMin ? Number(value.priceMin) : 0;
  const priceMax = value.priceMax ? Number(value.priceMax) : priceMin;
  const currency = String(value.currency ?? "USD");
  const price =
    priceMin && priceMax !== priceMin
      ? `${currency} ${priceMin}-${priceMax}`
      : priceMin
        ? `${currency} ${priceMin}`
        : "Price on request";

  return {
    id: String(value.id),
    name: String(value.name),
    category: value.category as Product["category"],
    sellerId: String(company.id),
    sellerName: String(company.tradeName ?? company.legalName ?? ""),
    sellerLocation: [company.city, company.country].filter(Boolean).join(", "),
    sellerLogoUrl:
      typeof company.logoThumbnailUrl === "string"
        ? company.logoThumbnailUrl
        : typeof company.logoUrl === "string"
          ? company.logoUrl
          : undefined,
    sellerUseDefaultLogo: company.useDefaultLogo !== false,
    shortDescription: String(value.shortDescription ?? ""),
    longDescription: String(value.detailedDescription ?? ""),
    wholesalePrice: price,
    wholesalePriceValue: priceMin,
    moq: String(value.moq ?? ""),
    moqUnits: Number(String(value.moq ?? "").replace(/\D/g, "")) || 0,
    leadTime: String(value.leadTime ?? ""),
    monthlyCapacity: "Contact seller",
    sampleAvailable: false,
    privateLabelAvailable: false,
    countryOfOrigin: "South Korea",
    shippingOrigin: String(company.country ?? "South Korea"),
    incoterms: ["Contact seller"],
    hsCode: "Contact seller",
    certifications: Array.isArray(value.certifications)
      ? (value.certifications as string[])
      : [],
    documentsAvailable: [],
    packageSize: String(value.packaging ?? ""),
    unitsPerCarton: "Contact seller",
    cartonWeight: "Contact seller",
    koreanMarketFit: String(value.ingredientsOrMaterials ?? ""),
    suggestedSalesChannels: [],
    riskNotes: [],
    imagePlaceholder: String(images[0]?.cardUrl ?? value.imageUrl ?? "/window.svg"),
    imageUrls: images.map((image) => String(image.detailUrl ?? image.mainUrl ?? image.cardUrl)),
    tags: Array.isArray(value.tags) ? (value.tags as string[]) : [],
    createdAt: String(value.createdAt ?? new Date().toISOString()),
    verificationStatus: "verified",
  };
}
