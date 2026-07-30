import type { ProductFieldVisibility } from "@/lib/product-field-visibility";
import type { UploadedListingImage } from "@/lib/marketplace";

export const BULK_PRODUCT_MAX_ROWS = 200;
export const BULK_PRODUCT_MAX_FILE_BYTES = 5 * 1024 * 1024;

export type BulkProductInput = {
  name: string;
  nameEn: string;
  category: string;
  tags: string[];
  tagsEn: string[];
  shortDescription: string;
  shortDescriptionEn: string;
  detailedDescription: string;
  detailedDescriptionEn: string;
  retailPrice: string;
  wholesalePrice: string;
  currency: string;
  priceUnit: string;
  moqQuantity: string;
  moqUnit: string;
  leadTime: string;
  sampleAvailability: string;
  privateLabelAvailability: string;
  monthlyCapacity: string;
  monthlyCapacityUnit: string;
  countryOfOrigin: string;
  shippingOriginCountry: string;
  shippingOriginRegion: string;
  incoterms: string[];
  hsCode: string;
  shelfLife: string;
  storageRequirements: string;
  documentsAvailable: string[];
  complianceClaims: string[];
  buyerNotes: string;
  buyerNotesEn: string;
  packageSize: string;
  unitsPerCarton: string;
  cartonWeight: string;
  cartonDimensions: string;
  palletQuantity: string;
  storageTemperature: string;
  suggestedUsChannels: string[];
  ingredientsOrMaterials: string;
  packaging: string;
  exportReadiness: boolean;
  fieldVisibility: ProductFieldVisibility;
};

export type BulkProductValidationIssue = {
  field: string;
  column: string;
  message: string;
};

export type BulkProductPreviewRow = {
  excelRow: number;
  product: BulkProductInput;
  status: "ready" | "warning" | "error";
  errors: BulkProductValidationIssue[];
  warnings: BulkProductValidationIssue[];
};

export type BulkProductValidationResponse = {
  rows: BulkProductPreviewRow[];
  totalRows: number;
  readyRows: number;
  warningRows: number;
  errorRows: number;
};

export type BulkCreatedProduct = {
  id: string;
  name: string;
  category: string;
  status: "inactive";
  images: UploadedListingImage[];
};

export type BulkProductImportResponse = {
  created: number;
  duplicateRequest: boolean;
  products: BulkCreatedProduct[];
};
