import type { Product, Seller } from "@/lib/types";

export function databaseProductToCard(value: Record<string, unknown>): Product {
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
    countryOfOrigin: String(value.countryOfOrigin ?? value.origin ?? "South Korea"),
    shippingOrigin: String(value.shippingOriginCountry ?? company.country ?? "South Korea"),
    incoterms: Array.isArray(value.incoterms) ? (value.incoterms as string[]) : [],
    hsCode: String(value.hsCode ?? ""),
    certifications: Array.isArray(value.certifications)
      ? (value.certifications as string[])
      : [],
    documentsAvailable: Array.isArray(value.documentsAvailable)
      ? (value.documentsAvailable as string[])
      : [],
    packageSize: String(value.packaging ?? value.packageSize ?? ""),
    unitsPerCarton: String(value.unitsPerCarton ?? ""),
    cartonWeight: String(value.cartonWeight ?? ""),
    koreanMarketFit: String(value.ingredientsOrMaterials ?? ""),
    suggestedSalesChannels: Array.isArray(value.suggestedUsChannels)
      ? (value.suggestedUsChannels as string[])
      : [],
    riskNotes: Array.isArray(value.riskNotes) ? (value.riskNotes as string[]) : [],
    imagePlaceholder: String(images[0]?.cardUrl ?? value.imageUrl ?? "/window.svg"),
    imageUrls: images.map((image) => String(image.detailUrl ?? image.mainUrl ?? image.cardUrl)),
    tags: Array.isArray(value.tags) ? (value.tags as string[]) : [],
    createdAt: String(value.createdAt ?? ""),
    verificationStatus: "verified",
  };
}

export function databaseCompanyToSeller(company: Record<string, unknown>): Seller {
  const profile = (company.sellerProfile ?? {}) as Record<string, unknown>;
  const count = (company._count ?? {}) as Record<string, unknown>;
  const reviews = Array.isArray(company.reviewsReceived)
    ? (company.reviewsReceived as Array<Record<string, unknown>>)
    : [];
  const ratingTotal = reviews.reduce((sum, review) => sum + Number(review.rating ?? 0), 0);
  const averageRating = reviews.length ? ratingTotal / reviews.length : 0;

  return {
    id: String(company.id),
    name: String(company.tradeName ?? company.legalName ?? ""),
    logoUrl: typeof company.logoUrl === "string" ? company.logoUrl : undefined,
    useDefaultLogo: company.useDefaultLogo !== false,
    location: [company.city, company.country].filter(Boolean).join(", "),
    state: String(company.stateOrProvince ?? company.city ?? "South Korea"),
    businessType: supplierTypeLabel(String(profile.factoryOrDistributorStatus ?? "")),
    yearFounded: 0,
    yearsInBusiness: 0,
    categories: (company.categories as Seller["categories"]) ?? [],
    certifications: (profile.certifications as string[]) ?? [],
    exportCountries: (profile.exportCountries as string[]) ?? [],
    exportExperience: String(profile.exportExperience ?? ""),
    monthlyCapacity: "",
    responseTime: "",
    paymentTerms: (profile.paymentTerms as string[]) ?? [],
    incoterms: (profile.shippingTerms as string[]) ?? [],
    documentsAvailable: [],
    contactPerson: String(profile.representativeName ?? ""),
    contactEmail: "",
    website: String(company.website ?? ""),
    languages: ["Korean", "English"],
    rating: averageRating,
    reviewCount: reviews.length,
    productCount: typeof count.products === "number" ? count.products : 0,
    verified: true,
    verificationStatus: "verified",
    description: String(company.description ?? ""),
  };
}

function supplierTypeLabel(value: string): Seller["businessType"] {
  if (value === "distributor") return "Distributor";
  if (value === "brand_owner") return "Brand Owner";
  if (value === "wholesaler") return "Wholesaler";
  return "Manufacturer";
}
