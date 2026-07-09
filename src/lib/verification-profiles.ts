import type {
  Buyer,
  BuyerType,
  CompanyProfile,
  ProductCategory,
  Seller,
  VerificationSubmission,
} from "@/lib/types";

const productCategories: ProductCategory[] = [
  "Beauty & Skincare",
  "Food & Beverage",
  "Apparel",
  "Supplements",
  "Home Goods",
  "Pet Products",
  "Health & Wellness",
];

function categoriesFromText(value = ""): ProductCategory[] {
  const matches = productCategories.filter((category) =>
    value.toLowerCase().includes(category.toLowerCase()),
  );
  return matches.length ? matches : ["Health & Wellness"];
}

function publicId(submission: VerificationSubmission) {
  return `member-${submission.id}`;
}

export function submissionToSeller(
  submission: VerificationSubmission,
  company?: CompanyProfile,
): Seller | null {
  if (
    submission.accountType !== "seller" ||
    submission.verificationStatus !== "verified"
  ) {
    return null;
  }

  return {
    id: publicId(submission),
    name: submission.companyName,
    logoUrl: company?.logoUrl,
    useDefaultLogo: company?.useDefaultLogo ?? true,
    location: submission.businessAddress || "South Korea",
    state: "South Korea",
    businessType: "Manufacturer",
    yearFounded: new Date().getFullYear(),
    yearsInBusiness: 1,
    categories: categoriesFromText(submission.productCategory),
    certifications: ["Trade82 Reviewed"],
    exportCountries: ["Global markets"],
    exportExperience:
      submission.exportExperience || "Export experience provided during company onboarding.",
    monthlyCapacity: "Contact seller",
    responseTime: "Contact seller",
    paymentTerms: ["Discuss with seller"],
    incoterms: ["EXW", "FOB"],
    documentsAvailable: ["Company document kept private"],
    contactPerson: submission.representativeName || "Company representative",
    contactEmail: submission.userEmail,
    website: submission.website,
    languages: ["Korean", "English"],
    rating: 0,
    reviewCount: 0,
    verified: true,
    verificationStatus: "verified",
    description:
      submission.exportExperience ||
      "Reviewed Korean seller company exporting products to global buyers.",
  };
}

export function submissionToBuyer(
  submission: VerificationSubmission,
  company?: CompanyProfile,
): Buyer | null {
  if (
    submission.accountType !== "buyer" ||
    submission.verificationStatus !== "verified"
  ) {
    return null;
  }

  const buyerTypes: BuyerType[] = [
    "Importer",
    "Distributor",
    "Retailer",
    "Online Seller",
    "Department Store Buyer",
  ];
  const buyerType = buyerTypes.includes(submission.buyerRole as BuyerType)
    ? (submission.buyerRole as BuyerType)
    : "Importer";

  return {
    id: publicId(submission),
    name: submission.companyName,
    logoUrl: company?.logoUrl,
    useDefaultLogo: company?.useDefaultLogo ?? true,
    location: submission.businessAddress || "International",
    buyerType,
    interestedCategories: categoriesFromText(submission.purchasingCategories),
    targetOrderSize:
      submission.estimatedMonthlyOrderVolume || "Contact buyer",
    annualImportVolume:
      submission.estimatedMonthlyOrderVolume || "Not disclosed",
    salesChannels: ["International retail and distribution"],
    importExperience: "Company information reviewed by Trade82 admin.",
    requiredDocuments: ["Commercial invoice", "Packing list", "Certificate of origin"],
    preferredPaymentTerms: ["Discuss with buyer"],
    timeline: "Contact buyer",
    marketStrategy:
      "Reviewed global buyer sourcing export-ready Korean products.",
    contactPerson: "Purchasing team",
    contactEmail: submission.userEmail,
    verified: true,
    verificationStatus: "verified",
  };
}
