export type ProductCategory =
  | "Beauty & Personal Care"
  | "Food & Snacks"
  | "Household Goods"
  | "Fashion & Apparel"
  | "Baby & Kids"
  | "Electronics Accessories"
  | "Kitchenware"
  | "K-Pop & Character Goods"
  | "Stationery & Lifestyle"
  | "Packaging"
  | "Industrial / B2B Supplies"
  | "Other"
  | "Beauty & Skincare"
  | "Food & Beverage"
  | "Apparel"
  | "Supplements"
  | "Home Goods"
  | "Pet Products"
  | "Health & Wellness";

export type VerificationStatus =
  | "unverified"
  | "email_verified"
  | "pending_review"
  | "verified"
  | "rejected"
  | "needs_reverification";

export type AccountRole = "user" | "seller" | "buyer" | "both" | "admin";

export type UserProfile = {
  clerkUserId: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  avatarOriginalUrl?: string;
  useDefaultAvatar: boolean;
  jobTitle: string;
  phone: string;
  linkedinUrl?: string;
  preferredLanguage: "en" | "ko";
  accountRole: AccountRole;
  createdAt: string;
  updatedAt: string;
};

export type CompanyProfile = {
  id: string;
  ownerClerkUserId: string;
  companyRole: "seller" | "buyer";
  legalName: string;
  tradeName?: string;
  logoOriginalUrl?: string;
  logoThumbnailUrl?: string;
  logoUrl?: string;
  useDefaultLogo: boolean;
  website: string;
  country: string;
  city: string;
  stateOrProvince: string;
  businessAddress: string;
  description: string;
  categories: string[];
  verificationStatus: VerificationStatus;
  needsReverification?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SellerCompanyProfile = {
  companyId: string;
  businessRegistrationNumber: string;
  representativeName: string;
  exportExperience: string;
  exportCountries: string[];
  productCategories: string[];
  minimumOrderQuantity: string;
  leadTime: string;
  certifications: string[];
  shippingTerms: string[];
  paymentTerms: string[];
  supplierType: string;
};

export type BuyerCompanyProfile = {
  companyId: string;
  buyerType: "importer" | "distributor" | "retailer" | "online_seller" | "wholesaler";
  purchasingCategories: string[];
  preferredSupplierType: string;
  targetOrderSize: string;
  monthlyImportVolume: string;
  importExperience: string;
  salesChannels: string[];
  purchaseTimeline: string;
};

export type ManagedProduct = {
  id: string;
  companyId: string;
  ownerClerkUserId: string;
  name: string;
  imageUrl?: string;
  category: ProductCategory;
  shortDescription: string;
  longDescription: string;
  price: string;
  priceValue: number;
  moq: string;
  moqUnits: number;
  leadTime: string;
  origin: "South Korea";
  certifications: string[];
  ingredientsOrMaterials: string;
  packaging: string;
  exportReady: boolean;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
};

export type SellerBusinessType =
  | "Manufacturer"
  | "Distributor"
  | "Brand Owner"
  | "Wholesaler";

export type BuyerType =
  | "Importer"
  | "Distributor"
  | "Retailer"
  | "Online Seller"
  | "Department Store Buyer";

export type Product = {
  id: string;
  name: string;
  category: ProductCategory;
  tags?: string[];
  sellerId: string;
  sellerName: string;
  sellerLocation: string;
  sellerLogoUrl?: string;
  sellerUseDefaultLogo?: boolean;
  sellerIsTrade82Team?: boolean;
  sellerIsVerifiedSeller?: boolean;
  shortDescription: string;
  longDescription: string;
  wholesalePrice: string;
  wholesalePriceValue: number;
  moq: string;
  moqUnits: number;
  leadTime: string;
  monthlyCapacity: string;
  sampleAvailable: boolean;
  privateLabelAvailable: boolean;
  countryOfOrigin: string;
  shippingOrigin: string;
  incoterms: string[];
  hsCode: string;
  certifications: string[];
  documentsAvailable: string[];
  shelfLife?: string;
  packageSize: string;
  unitsPerCarton: string;
  cartonWeight: string;
  koreanMarketFit: string;
  suggestedSalesChannels: string[];
  riskNotes: string[];
  imagePlaceholder: string;
  imageUrls?: string[];
  createdAt?: string;
  verificationStatus?: VerificationStatus;
};

export type Seller = {
  id: string;
  name: string;
  logoUrl?: string;
  useDefaultLogo?: boolean;
  location: string;
  state: string;
  businessType: SellerBusinessType;
  yearFounded: number;
  yearsInBusiness: number;
  categories: ProductCategory[];
  certifications: string[];
  exportCountries: string[];
  exportExperience: string;
  monthlyCapacity: string;
  responseTime: string;
  paymentTerms: string[];
  incoterms: string[];
  documentsAvailable: string[];
  contactPerson: string;
  contactEmail: string;
  website: string;
  languages: string[];
  rating: number;
  reviewCount: number;
  productCount?: number;
  verified: boolean;
  verificationStatus?: VerificationStatus;
  isTrade82Team?: boolean;
  isVerifiedSeller?: boolean;
  description: string;
};

export type Buyer = {
  id: string;
  name: string;
  logoUrl?: string;
  useDefaultLogo?: boolean;
  location: string;
  buyerType: string;
  interestedCategories: string[];
  interestedCategoryCodes?: string[];
  buyerTypeCode?: string;
  targetOrderSize: string;
  targetOrderSizeCode?: string;
  annualImportVolume: string;
  salesChannels: string[];
  salesChannelCodes?: string[];
  importExperience: string;
  importExperienceCode?: string;
  requiredDocuments: string[];
  preferredPaymentTerms: string[];
  timeline: string;
  timelineCode?: string;
  marketStrategy: string;
  contactPerson: string;
  contactEmail: string;
  verified: boolean;
  verificationStatus?: VerificationStatus;
  isTrade82Team?: boolean;
};

export type VerificationSubmission = {
  id: string;
  userId: string;
  accountType: "seller" | "buyer";
  companyName: string;
  userEmail: string;
  website: string;
  businessAddress: string;
  businessRegistrationNumber?: string;
  representativeName?: string;
  exportExperience?: string;
  productCategory?: string;
  buyerRole?: string;
  purchasingCategories?: string;
  estimatedMonthlyOrderVolume?: string;
  profileLink?: string;
  certificateFileName?: string;
  verificationStatus: VerificationStatus;
  submittedAt: string;
};

export type Inquiry = {
  id: string;
  contextType: "product" | "seller" | "buyer";
  productId?: string;
  productName?: string;
  sellerId?: string;
  sellerName?: string;
  buyerId?: string;
  buyerName?: string;
  senderName: string;
  senderCompany: string;
  email: string;
  expectedOrderQuantity: string;
  targetDate: string;
  message: string;
  createdAt: string;
};

export type MessageReply = {
  id: string;
  body: string;
  sender: string;
  createdAt: string;
};

export type MessageThread = {
  id: string;
  participantName: string;
  participantCompany: string;
  contextTitle: string;
  contextType: "product" | "seller" | "buyer";
  inquiry: Inquiry;
  replies: MessageReply[];
  updatedAt: string;
};
