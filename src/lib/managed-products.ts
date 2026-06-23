import type { CompanyProfile, ManagedProduct, Product } from "@/lib/types";

const defaultProductImage =
  "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=900&q=80";

export function managedProductToPublic(
  product: ManagedProduct,
  company?: CompanyProfile,
): Product | null {
  if (
    product.status !== "active" ||
    company?.companyRole !== "seller" ||
    company.verificationStatus !== "verified"
  ) {
    return null;
  }

  const companyName = company.tradeName || company.legalName;

  return {
    id: product.id,
    name: product.name,
    category: product.category,
    sellerId: company.id,
    sellerName: companyName,
    sellerLocation: [company.city, company.country].filter(Boolean).join(", "),
    sellerLogoUrl: company.logoUrl,
    sellerUseDefaultLogo: company.useDefaultLogo,
    shortDescription: product.shortDescription,
    longDescription: product.longDescription,
    wholesalePrice: product.price,
    wholesalePriceValue: product.priceValue,
    moq: product.moq,
    moqUnits: product.moqUnits,
    leadTime: product.leadTime,
    monthlyCapacity: "Contact seller",
    sampleAvailable: false,
    privateLabelAvailable: false,
    countryOfOrigin: product.origin,
    shippingOrigin: company.businessAddress || company.country,
    incoterms: ["Contact seller"],
    hsCode: "Contact seller",
    certifications: product.certifications,
    documentsAvailable: product.exportReady
      ? ["Export documentation available on request"]
      : [],
    packageSize: product.packaging,
    unitsPerCarton: "Contact seller",
    cartonWeight: "Contact seller",
    koreanMarketFit: product.ingredientsOrMaterials,
    suggestedSalesChannels: [],
    riskNotes: [
      "U.S. buyers should independently verify import and product compliance requirements.",
    ],
    imagePlaceholder: product.imageUrl || defaultProductImage,
    verificationStatus: "verified",
  };
}
