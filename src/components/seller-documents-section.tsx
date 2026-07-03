"use client";

import {
  Download,
  ExternalLink,
  Eye,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  Grid2X2,
  List,
  MoreHorizontal,
  Pencil,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import {
  type DragEvent,
  type MouseEvent,
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const formsLibraryFilters = [
  "All",
  "Trade Templates",
  "CBP",
  "FDA",
  "USDA",
  "Logistics",
  "Compliance",
] as const;

type FormsLibraryFilter = (typeof formsLibraryFilters)[number];
type DocumentsTab = "forms" | "my-documents";
type DocumentViewMode = "grid" | "list";
type SourceType = "template" | "official" | "reference";

type FormLibraryItem = {
  id: string;
  section: string;
  filter: Exclude<FormsLibraryFilter, "All">;
  sourceType: SourceType;
  name: string;
  category: string;
  usedFor: string;
  filledBy: string;
  format: string;
  source: string;
  statuses: string[];
  templateSlug?: string;
  officialUrl?: string;
};

type MyDocumentItem = {
  id: string;
  fileName: string;
  category: DocumentCategoryValue;
  fileType: string;
  fileSize: number;
  mimeType: string;
  folderId: string | null;
  folderName: string | null;
  visibilityStatus: DocumentVisibilityValue;
  lastModified: string;
};

type FolderItem = {
  id: string;
  name: string;
  category: DocumentCategoryValue;
  files: number;
  updated: string;
};

type DocumentCategoryValue =
  | "company"
  | "product"
  | "compliance"
  | "shipping"
  | "contracts"
  | "shared_with_buyer";

type DocumentVisibilityValue =
  | "private"
  | "internal_review"
  | "shared_with_buyer";

type DocumentUploadTarget = {
  category: DocumentCategoryValue;
  folderId?: string | null;
};

type DocumentsApiPayload = {
  folders: Array<{
    id: string;
    name: string;
    category: DocumentCategoryValue;
    files: number;
    updatedAt: string;
  }>;
  documents: Array<{
    id: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    mimeType: string;
    category: DocumentCategoryValue;
    folderId: string | null;
    folderName: string | null;
    visibilityStatus: DocumentVisibilityValue;
    createdAt: string;
    updatedAt: string;
  }>;
  companyRequired?: boolean;
};

type FolderApiItem = DocumentsApiPayload["folders"][number];
type DocumentApiItem = DocumentsApiPayload["documents"][number];

type FileManagerContextMenuState =
  | {
      kind: "document";
      item: MyDocumentItem;
      x: number;
      y: number;
    };

type RenameTarget =
  | { kind: "document"; item: MyDocumentItem }
  | { kind: "folder"; item: FolderItem };

type NoticeTone = "success" | "error";

type NoticeState = {
  message: string;
  tone: NoticeTone;
};

type NoticeHandler = (message: string, tone?: NoticeTone) => void;

const formLibraryItems: FormLibraryItem[] = [
  {
    id: "proforma-invoice",
    section: "Core Trade Templates",
    filter: "Trade Templates",
    sourceType: "template",
    name: "Proforma Invoice",
    category: "Trade Templates",
    usedFor: "Initial quote and buyer import planning",
    filledBy: "Seller",
    format: "Printable HTML",
    source: "Trade82 template",
    statuses: ["Template", "Workflow support"],
    templateSlug: "proforma-invoice",
  },
  {
    id: "commercial-invoice",
    section: "Core Trade Templates",
    filter: "Trade Templates",
    sourceType: "template",
    name: "Commercial Invoice",
    category: "Trade Templates",
    usedFor: "Shipment value, parties, and product line details",
    filledBy: "Seller / exporter",
    format: "Printable HTML",
    source: "Trade82 template",
    statuses: ["Template", "Shipment document"],
    templateSlug: "commercial-invoice",
  },
  {
    id: "packing-list",
    section: "Core Trade Templates",
    filter: "Trade Templates",
    sourceType: "template",
    name: "Packing List",
    category: "Trade Templates",
    usedFor: "Carton, pallet, weight, and package details",
    filledBy: "Seller / warehouse",
    format: "Printable HTML",
    source: "Trade82 template",
    statuses: ["Template", "Logistics"],
    templateSlug: "packing-list",
  },
  {
    id: "purchase-order",
    section: "Core Trade Templates",
    filter: "Trade Templates",
    sourceType: "template",
    name: "Purchase Order",
    category: "Trade Templates",
    usedFor: "Buyer order confirmation and requested terms",
    filledBy: "Buyer",
    format: "Printable HTML",
    source: "Trade82 template",
    statuses: ["Template", "Workflow support"],
    templateSlug: "purchase-order",
  },
  {
    id: "export-sales-contract",
    section: "Core Trade Templates",
    filter: "Trade Templates",
    sourceType: "template",
    name: "Export Sales Contract",
    category: "Trade Templates",
    usedFor: "Commercial terms, delivery terms, and order scope",
    filledBy: "Buyer and seller",
    format: "Printable HTML",
    source: "Trade82 template",
    statuses: ["Template", "Contract support"],
    templateSlug: "export-sales-contract",
  },
  {
    id: "certificate-origin-template",
    section: "Core Trade Templates",
    filter: "Trade Templates",
    sourceType: "template",
    name: "Certificate of Origin Template",
    category: "Trade Templates",
    usedFor: "Origin statement support for trade review",
    filledBy: "Seller / chamber where applicable",
    format: "Printable HTML",
    source: "Trade82 template",
    statuses: ["Template", "Origin"],
    templateSlug: "certificate-of-origin-template",
  },
  {
    id: "shipper-letter-instruction",
    section: "Core Trade Templates",
    filter: "Trade Templates",
    sourceType: "template",
    name: "Shipper’s Letter of Instruction",
    category: "Trade Templates",
    usedFor: "Instructions to freight forwarder or logistics partner",
    filledBy: "Seller / shipper",
    format: "Printable HTML",
    source: "Trade82 template",
    statuses: ["Template", "Logistics"],
    templateSlug: "shippers-letter-of-instruction",
  },
  {
    id: "document-checklist",
    section: "Core Trade Templates",
    filter: "Trade Templates",
    sourceType: "template",
    name: "Document Checklist",
    category: "Trade Templates",
    usedFor: "Shipment and compliance document planning",
    filledBy: "Buyer and seller",
    format: "Printable HTML",
    source: "Trade82 template",
    statuses: ["Template", "Workflow support"],
    templateSlug: "document-checklist",
  },
  {
    id: "cbp-3461",
    section: "U.S. Customs / CBP Forms",
    filter: "CBP",
    sourceType: "official",
    name: "CBP Form 3461 - Entry / Immediate Delivery",
    category: "CBP",
    usedFor: "Entry or immediate delivery process",
    filledBy: "Customs broker",
    format: "Official form",
    source: "U.S. Customs and Border Protection",
    statuses: ["Official U.S. Form", "Broker usually files"],
    officialUrl: "https://www.cbp.gov/document/forms/form-3461-entryimmediate-delivery-ace",
  },
  {
    id: "cbp-7501",
    section: "U.S. Customs / CBP Forms",
    filter: "CBP",
    sourceType: "official",
    name: "CBP Form 7501 - Entry Summary",
    category: "CBP",
    usedFor: "Entry summary and duty/tax reporting",
    filledBy: "Customs broker",
    format: "Official form",
    source: "U.S. Customs and Border Protection",
    statuses: ["Official U.S. Form", "Broker usually files"],
    officialUrl: "https://www.cbp.gov/trade/programs-administration/entry-summary/cbp-form-7501",
  },
  {
    id: "cbp-5106",
    section: "U.S. Customs / CBP Forms",
    filter: "CBP",
    sourceType: "official",
    name: "CBP Form 5106 - Importer Identity Form",
    category: "CBP",
    usedFor: "Importer identity setup with CBP",
    filledBy: "Importer / broker",
    format: "Official form",
    source: "U.S. Customs and Border Protection",
    statuses: ["Official U.S. Form", "Importer required"],
    officialUrl: "https://www.cbp.gov/document/forms/cbp-form-5106-createupdate-importer-identity-form",
  },
  {
    id: "cbp-301",
    section: "U.S. Customs / CBP Forms",
    filter: "CBP",
    sourceType: "official",
    name: "CBP Form 301 - Customs Bond",
    category: "CBP",
    usedFor: "Customs bond documentation",
    filledBy: "Importer / surety / broker",
    format: "Official form",
    source: "U.S. Customs and Border Protection",
    statuses: ["Official U.S. Form", "Importer required"],
    officialUrl: "https://www.cbp.gov/document/forms/cbp-form-301-customs-bond",
  },
  {
    id: "cbp-3311",
    section: "U.S. Customs / CBP Forms",
    filter: "CBP",
    sourceType: "official",
    name: "CBP Form 3311 - Declaration for Free Entry of Returned American Products",
    category: "CBP",
    usedFor: "Returned American products entry support",
    filledBy: "Importer / broker",
    format: "Official form",
    source: "U.S. Customs and Border Protection",
    statuses: ["Official U.S. Form", "Category-specific"],
    officialUrl: "https://www.cbp.gov/document/forms/form-3311-declaration-free-entry-returned-american-products",
  },
  {
    id: "cbp-3299",
    section: "U.S. Customs / CBP Forms",
    filter: "CBP",
    sourceType: "official",
    name: "CBP Form 3299 - Declaration for Free Entry of Unaccompanied Articles",
    category: "CBP",
    usedFor: "Unaccompanied articles entry support",
    filledBy: "Importer / broker",
    format: "Official form",
    source: "U.S. Customs and Border Protection",
    statuses: ["Official U.S. Form", "Category-specific"],
    officialUrl: "https://www.cbp.gov/document/forms/form-3299-declaration-free-entry-unaccompanied-articles",
  },
  {
    id: "fda-prior-notice-guide",
    section: "FDA / Food & Cosmetics",
    filter: "FDA",
    sourceType: "official",
    name: "FDA Prior Notice Guide",
    category: "FDA",
    usedFor: "Food shipment prior notice planning",
    filledBy: "Importer / broker / filer",
    format: "Official guide",
    source: "U.S. Food and Drug Administration",
    statuses: ["Official source", "Food / cosmetics"],
    officialUrl: "https://www.fda.gov/industry/prior-notice-imported-foods/filing-prior-notice-imported-foods",
  },
  {
    id: "fda-facility-registration",
    section: "FDA / Food & Cosmetics",
    filter: "FDA",
    sourceType: "official",
    name: "FDA Facility Registration Reference",
    category: "FDA",
    usedFor: "Facility registration planning",
    filledBy: "Facility owner / importer",
    format: "Official reference",
    source: "U.S. Food and Drug Administration",
    statuses: ["Official source", "Category-specific"],
    officialUrl: "https://www.fda.gov/food/guidance-regulation-food-and-dietary-supplements/registration-food-facilities-and-other-submissions",
  },
  {
    id: "ingredient-declaration-template",
    section: "FDA / Food & Cosmetics",
    filter: "FDA",
    sourceType: "template",
    name: "Ingredient Declaration Template",
    category: "FDA",
    usedFor: "Ingredient statement collection and review",
    filledBy: "Seller / manufacturer",
    format: "Checklist",
    source: "Trade82 template",
    statuses: ["Category-specific", "Food / cosmetics"],
  },
  {
    id: "nutrition-allergen-checklist",
    section: "FDA / Food & Cosmetics",
    filter: "FDA",
    sourceType: "template",
    name: "Nutrition / Allergen Checklist",
    category: "FDA",
    usedFor: "Nutrition and allergen disclosure planning",
    filledBy: "Seller / importer",
    format: "Checklist",
    source: "Trade82 template",
    statuses: ["Category-specific", "Food / cosmetics"],
  },
  {
    id: "cosmetic-labeling-checklist",
    section: "FDA / Food & Cosmetics",
    filter: "FDA",
    sourceType: "template",
    name: "Cosmetic Labeling Checklist",
    category: "FDA",
    usedFor: "Cosmetic label review preparation",
    filledBy: "Seller / brand owner",
    format: "Checklist",
    source: "Trade82 template",
    statuses: ["Category-specific", "Food / cosmetics"],
  },
  {
    id: "mocra-reference",
    section: "FDA / Food & Cosmetics",
    filter: "FDA",
    sourceType: "official",
    name: "MoCRA Reference",
    category: "FDA",
    usedFor: "Cosmetics regulatory reference planning",
    filledBy: "Brand owner / responsible person",
    format: "Official reference",
    source: "U.S. Food and Drug Administration",
    statuses: ["Official source", "Category-specific"],
    officialUrl: "https://www.fda.gov/cosmetics/cosmetics-laws-regulations/modernization-cosmetics-regulation-act-2022-mocra",
  },
  {
    id: "aphis-import-permit",
    section: "USDA / Agriculture",
    filter: "USDA",
    sourceType: "official",
    name: "APHIS Import Permit Reference",
    category: "USDA",
    usedFor: "Agricultural product import permit review",
    filledBy: "Importer / broker",
    format: "Official reference",
    source: "USDA APHIS",
    statuses: ["Category-specific", "Permit may be required"],
    officialUrl: "https://www.aphis.usda.gov/efile",
  },
  {
    id: "plant-product-import-guide",
    section: "USDA / Agriculture",
    filter: "USDA",
    sourceType: "official",
    name: "Plant Product Import Guide",
    category: "USDA",
    usedFor: "Plant product import requirement planning",
    filledBy: "Importer / broker",
    format: "Official guide",
    source: "USDA APHIS",
    statuses: ["Category-specific", "Permit may be required"],
    officialUrl: "https://www.aphis.usda.gov/plant-imports",
  },
  {
    id: "animal-product-import-guide",
    section: "USDA / Agriculture",
    filter: "USDA",
    sourceType: "official",
    name: "Animal Product Import Guide",
    category: "USDA",
    usedFor: "Animal product import requirement planning",
    filledBy: "Importer / broker",
    format: "Official guide",
    source: "USDA APHIS",
    statuses: ["Category-specific", "Permit may be required"],
    officialUrl: "https://www.aphis.usda.gov/animal-product-import",
  },
  {
    id: "vs-16-3-reference",
    section: "USDA / Agriculture",
    filter: "USDA",
    sourceType: "official",
    name: "VS Form 16-3 Reference",
    category: "USDA",
    usedFor: "Animal product import permit reference",
    filledBy: "Importer / broker",
    format: "Official reference",
    source: "USDA APHIS",
    statuses: ["Category-specific", "Permit may be required"],
    officialUrl: "https://www.aphis.usda.gov/animal-product-import/animal-health-permits",
  },
  {
    id: "ppq-permit-reference",
    section: "USDA / Agriculture",
    filter: "USDA",
    sourceType: "official",
    name: "PPQ Permit Reference",
    category: "USDA",
    usedFor: "Plant protection and quarantine permit reference",
    filledBy: "Importer / broker",
    format: "Official reference",
    source: "USDA APHIS",
    statuses: ["Category-specific", "Permit may be required"],
    officialUrl: "https://www.aphis.usda.gov/efile/training",
  },
  {
    id: "bill-of-lading",
    section: "Logistics & Shipping",
    filter: "Logistics",
    sourceType: "reference",
    name: "Bill of Lading Reference",
    category: "Logistics",
    usedFor: "Ocean shipment carrier document reference",
    filledBy: "Forwarder / carrier",
    format: "Reference",
    source: "Forwarder / carrier issued",
    statuses: ["Logistics", "Forwarder / carrier issued", "Reference only"],
  },
  {
    id: "air-waybill",
    section: "Logistics & Shipping",
    filter: "Logistics",
    sourceType: "reference",
    name: "Air Waybill Reference",
    category: "Logistics",
    usedFor: "Air shipment carrier document reference",
    filledBy: "Forwarder / carrier",
    format: "Reference",
    source: "Forwarder / carrier issued",
    statuses: ["Logistics", "Forwarder / carrier issued", "Reference only"],
  },
  {
    id: "delivery-order",
    section: "Logistics & Shipping",
    filter: "Logistics",
    sourceType: "template",
    name: "Delivery Order",
    category: "Logistics",
    usedFor: "Cargo release or delivery coordination",
    filledBy: "Forwarder / carrier",
    format: "Template",
    source: "Trade82 template",
    statuses: ["Logistics", "Reference only"],
  },
  {
    id: "arrival-notice",
    section: "Logistics & Shipping",
    filter: "Logistics",
    sourceType: "reference",
    name: "Arrival Notice",
    category: "Logistics",
    usedFor: "Shipment arrival and charges notification",
    filledBy: "Forwarder / carrier",
    format: "Reference",
    source: "Forwarder / carrier issued",
    statuses: ["Logistics", "Forwarder / carrier issued", "Reference only"],
  },
  {
    id: "insurance-certificate",
    section: "Logistics & Shipping",
    filter: "Logistics",
    sourceType: "reference",
    name: "Insurance Certificate",
    category: "Logistics",
    usedFor: "Cargo insurance documentation",
    filledBy: "Insurer / forwarder",
    format: "Reference",
    source: "Insurer / forwarder issued",
    statuses: ["Logistics", "Reference only"],
  },
  {
    id: "dangerous-goods-declaration",
    section: "Logistics & Shipping",
    filter: "Logistics",
    sourceType: "reference",
    name: "Dangerous Goods Declaration",
    category: "Logistics",
    usedFor: "Hazardous shipment declaration planning",
    filledBy: "Shipper / specialist",
    format: "Reference",
    source: "Carrier / regulator specific",
    statuses: ["Logistics", "Category-specific", "Reference only"],
  },
  {
    id: "carton-marking-template",
    section: "Logistics & Shipping",
    filter: "Logistics",
    sourceType: "template",
    name: "Carton Marking Template",
    category: "Logistics",
    usedFor: "Carton label and warehouse marking planning",
    filledBy: "Seller / warehouse",
    format: "Template",
    source: "Trade82 template",
    statuses: ["Logistics", "Template"],
  },
  {
    id: "coa",
    section: "Product Compliance",
    filter: "Compliance",
    sourceType: "reference",
    name: "COA",
    category: "Compliance",
    usedFor: "Certificate of analysis request and review",
    filledBy: "Manufacturer / lab",
    format: "Reference",
    source: "Manufacturer / lab issued",
    statuses: ["Product-specific", "Compliance", "Buyer may request"],
  },
  {
    id: "msds-sds",
    section: "Product Compliance",
    filter: "Compliance",
    sourceType: "reference",
    name: "MSDS / SDS",
    category: "Compliance",
    usedFor: "Safety data sheet review",
    filledBy: "Manufacturer",
    format: "Reference",
    source: "Manufacturer issued",
    statuses: ["Product-specific", "Compliance", "Buyer may request"],
  },
  {
    id: "test-report",
    section: "Product Compliance",
    filter: "Compliance",
    sourceType: "reference",
    name: "Test Report",
    category: "Compliance",
    usedFor: "Product testing evidence review",
    filledBy: "Lab / manufacturer",
    format: "Reference",
    source: "Lab / manufacturer issued",
    statuses: ["Product-specific", "Compliance", "Buyer may request"],
  },
  {
    id: "fcc-declaration",
    section: "Product Compliance",
    filter: "Compliance",
    sourceType: "template",
    name: "FCC Declaration",
    category: "Compliance",
    usedFor: "Electronics compliance declaration planning",
    filledBy: "Manufacturer / importer",
    format: "Template",
    source: "Trade82 template",
    statuses: ["Product-specific", "Compliance"],
  },
  {
    id: "cpsc-cpsia-certificate",
    section: "Product Compliance",
    filter: "Compliance",
    sourceType: "template",
    name: "CPSC / CPSIA Certificate",
    category: "Compliance",
    usedFor: "Consumer product certificate planning",
    filledBy: "Importer / manufacturer",
    format: "Template",
    source: "Trade82 template",
    statuses: ["Product-specific", "Compliance"],
  },
  {
    id: "label-compliance-file",
    section: "Product Compliance",
    filter: "Compliance",
    sourceType: "template",
    name: "Label Compliance File",
    category: "Compliance",
    usedFor: "Label review packet organization",
    filledBy: "Seller / importer",
    format: "Template",
    source: "Trade82 template",
    statuses: ["Product-specific", "Compliance"],
  },
  {
    id: "certificate-free-sale",
    section: "Product Compliance",
    filter: "Compliance",
    sourceType: "reference",
    name: "Certificate of Free Sale",
    category: "Compliance",
    usedFor: "Marketability or regulatory support where requested",
    filledBy: "Manufacturer / authority",
    format: "Reference",
    source: "Issuer specific",
    statuses: ["Product-specific", "Buyer may request"],
  },
  {
    id: "brand-authorization-letter",
    section: "Product Compliance",
    filter: "Compliance",
    sourceType: "template",
    name: "Brand Authorization Letter",
    category: "Compliance",
    usedFor: "Brand authorization support",
    filledBy: "Brand owner",
    format: "Template",
    source: "Trade82 template",
    statuses: ["Product-specific", "Buyer may request"],
  },
  {
    id: "product-spec-sheet",
    section: "Product Compliance",
    filter: "Compliance",
    sourceType: "template",
    name: "Product Specification Sheet",
    category: "Compliance",
    usedFor: "Product attribute and technical detail summary",
    filledBy: "Seller / manufacturer",
    format: "Template",
    source: "Trade82 template",
    statuses: ["Product-specific", "Buyer may request"],
  },
];

const myDocumentFilters = [
  "All",
  "Company",
  "Product",
  "Compliance",
  "Shipping",
  "Contracts",
  "Shared with buyer",
] as const;

type MyDocumentFilter = (typeof myDocumentFilters)[number];

const documentCategoryOptions: Array<{
  label: Exclude<MyDocumentFilter, "All">;
  value: DocumentCategoryValue;
}> = [
  { label: "Company", value: "company" },
  { label: "Product", value: "product" },
  { label: "Compliance", value: "compliance" },
  { label: "Shipping", value: "shipping" },
  { label: "Contracts", value: "contracts" },
  { label: "Shared with buyer", value: "shared_with_buyer" },
];

const documentCategoryLabels = Object.fromEntries(
  documentCategoryOptions.map((item) => [item.value, item.label]),
) as Record<DocumentCategoryValue, Exclude<MyDocumentFilter, "All">>;

const documentVisibilityLabels: Record<DocumentVisibilityValue, string> = {
  internal_review: "Internal review",
  private: "Private",
  shared_with_buyer: "Shared with buyer",
};

const DOCUMENT_CLIENT_UPLOAD_MAX_BYTES = 20 * 1024 * 1024;
const DOCUMENT_CLIENT_ALLOWED_EXTENSIONS = new Set([
  "jpeg",
  "jpg",
  "pdf",
  "png",
  "webp",
]);
const DOCUMENT_CLIENT_ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const FILE_MANAGER_MENU_WIDTH = 224;
const DOCUMENT_MENU_HEIGHT = 188;
const MENU_GAP = 8;
const MENU_VIEWPORT_MARGIN = 12;

function formatDocumentDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function mapApiFolder(folder: FolderApiItem): FolderItem {
  return {
    id: folder.id,
    name: folder.name,
    category: folder.category,
    files: folder.files,
    updated: formatDocumentDate(folder.updatedAt),
  };
}

function mapApiDocument(document: DocumentApiItem): MyDocumentItem {
  return {
    id: document.id,
    fileName: document.fileName,
    fileType: document.fileType,
    fileSize: document.fileSize,
    mimeType: document.mimeType,
    category: document.category,
    folderId: document.folderId,
    folderName: document.folderName,
    visibilityStatus: document.visibilityStatus,
    lastModified: formatDocumentDate(document.updatedAt),
  };
}

function fileExtension(filename: string) {
  return filename
    .toLowerCase()
    .split(".")
    .map((part) => part.trim())
    .filter(Boolean)
    .at(-1) ?? "";
}

function validateClientDocumentFiles(files: File[]) {
  for (const file of files) {
    const extension = fileExtension(file.name);
    const mimeType = file.type.toLowerCase();

    if (
      !DOCUMENT_CLIENT_ALLOWED_EXTENSIONS.has(extension) ||
      !DOCUMENT_CLIENT_ALLOWED_MIME_TYPES.has(mimeType)
    ) {
      return "Only PDF, JPG, PNG, and WebP files are supported.";
    }

    if (file.size <= 0) {
      return "Empty files cannot be uploaded.";
    }

    if (file.size > DOCUMENT_CLIENT_UPLOAD_MAX_BYTES) {
      return "This file is too large. Maximum size is 20MB.";
    }
  }

  return "";
}

function dragEventHasFiles(event: DragEvent<HTMLElement>) {
  return Array.from(event.dataTransfer.types).includes("Files");
}

function filesFromDragEvent(event: DragEvent<HTMLElement>) {
  return Array.from(event.dataTransfer.files ?? []);
}

export function SellerDocumentsSection() {
  const [activeTab, setActiveTab] = useState<DocumentsTab>("forms");
  const [notice, setNotice] = useState<NoticeState | null>(null);

  const showNotice = useCallback<NoticeHandler>((message, tone = "success") => {
    setNotice({ message, tone });
  }, []);

  return (
    <section className="grid gap-4">
      <div className="rounded-2xl border p-4 theme-surface-elevated">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] theme-success-text">
              U.S. Import & Trade Forms Library
            </p>
            <h2 className="mt-3 text-xl font-semibold theme-foreground">
              Documents
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 theme-muted">
              Access common U.S. import, export, logistics, and compliance forms used in B2B trade.
            </p>
          </div>
          <div
            className="inline-flex w-full max-w-xs rounded-xl border p-1 theme-surface-muted sm:w-auto"
            role="tablist"
            aria-label="Documents tabs"
          >
            <TabButton
              active={activeTab === "forms"}
              label="Forms Library"
              onClick={() => setActiveTab("forms")}
            />
            <TabButton
              active={activeTab === "my-documents"}
              label="My Documents"
              onClick={() => setActiveTab("my-documents")}
            />
          </div>
        </div>

        {activeTab === "forms" ? (
          <div className="mt-4 rounded-xl border p-4 theme-surface-elevated">
            <h3 className="text-sm font-semibold theme-foreground">
              How this library works
            </h3>
            <p className="mt-2 text-xs leading-5 theme-muted">
              Trade82 templates can be previewed, printed, and later auto-filled from deal data. Official U.S. forms and agency references are linked to their official sources and are usually prepared by the importer, customs broker, freight forwarder, carrier, manufacturer, or compliance specialist.
            </p>
            <p className="mt-2 text-xs leading-5 theme-muted">
              Not every form is required for every shipment. Requirements vary by product, importer, shipment method, and government agency.
            </p>
          </div>
        ) : null}
      </div>

      {notice ? (
        <p
          role="status"
          className={`rounded-xl border p-3 text-sm font-medium ${
            notice.tone === "error"
              ? "border-red-300/30 bg-red-500/10 text-red-500"
              : "border-emerald-300/20 bg-emerald-300/10 theme-success-text"
          }`}
        >
          {notice.message}
        </p>
      ) : null}

      {activeTab === "forms" ? (
        <FormsLibraryView onAction={showNotice} />
      ) : (
        <MyDocumentsView onAction={showNotice} />
      )}
    </section>
  );
}

function TabButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`h-8 flex-1 whitespace-nowrap rounded-lg px-3 text-xs font-semibold transition ${
        active
          ? "theme-primary-button"
          : "theme-ghost-button"
      }`}
    >
      {label}
    </button>
  );
}

function FormsLibraryView({ onAction }: { onAction: NoticeHandler }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FormsLibraryFilter>("All");
  const [selectedItem, setSelectedItem] = useState<FormLibraryItem | null>(null);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    return formLibraryItems.filter((item) => {
      const matchesFilter = filter === "All" || item.filter === filter;
      const searchableText = [
        item.name,
        item.section,
        item.category,
        item.usedFor,
        item.filledBy,
        item.format,
        item.source,
        ...formLibraryLabels(item),
        ...item.statuses,
      ]
        .join(" ")
        .toLowerCase();

      return matchesFilter && (!query || searchableText.includes(query));
    });
  }, [filter, search]);

  function handleAction(item: FormLibraryItem, action: string) {
    setSelectedItem(item);

    if (action === "View details") return;
    onAction("Details are shown below.");
  }

  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border p-4 theme-surface">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search forms, templates, or agencies</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 theme-muted" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search forms, templates, or agencies"
              className="h-9 w-full rounded-xl border pl-9 pr-3 text-sm outline-none theme-input focus:border-emerald-300 focus:ring-2 focus:ring-emerald-400/20"
            />
          </label>
          <FilterChips
            filters={formsLibraryFilters}
            active={filter}
            onChange={setFilter}
          />
        </div>
      </div>

      {selectedItem ? (
        <div className="rounded-xl border p-3 theme-surface-elevated">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] theme-muted">
                Details
              </p>
              <h3 className="mt-1 text-sm font-semibold theme-foreground">
                {selectedItem.name}
              </h3>
              <p className="mt-1 text-sm leading-6 theme-muted">
                {selectedItem.usedFor}
              </p>
            </div>
            <StatusChips statuses={formLibraryLabels(selectedItem)} />
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border theme-surface">
        <div className="hidden border-b px-4 py-3 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] theme-border theme-surface-muted theme-muted xl:grid xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.6fr)_minmax(0,1fr)_minmax(0,0.75fr)_minmax(0,0.45fr)_minmax(0,0.65fr)_minmax(0,0.8fr)_minmax(200px,1.25fr)] xl:gap-4">
          <span>Form / Template</span>
          <span>Category</span>
          <span>Used for</span>
          <span>Usually prepared by</span>
          <span>Format</span>
          <span>Source</span>
          <span>Type / source</span>
          <span>Actions</span>
        </div>
        <div className="divide-y theme-border">
          {filteredItems.map((item) => (
            <FormLibraryRow
              key={item.id}
              item={item}
              onAction={handleAction}
            />
          ))}
          {!filteredItems.length ? (
            <div className="p-8 text-center">
              <p className="text-sm font-semibold theme-foreground">
                No forms found.
              </p>
              <p className="mt-2 text-sm theme-muted">
                Try a different keyword or category filter.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function FormLibraryRow({
  item,
  onAction,
}: {
  item: FormLibraryItem;
  onAction: (item: FormLibraryItem, action: string) => void;
}) {
  const actions = formActions(item);

  return (
    <article className="p-4 transition hover:bg-[var(--muted)] xl:grid xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.6fr)_minmax(0,1fr)_minmax(0,0.75fr)_minmax(0,0.45fr)_minmax(0,0.65fr)_minmax(0,0.8fr)_minmax(200px,1.25fr)] xl:items-center xl:gap-4">
      <div className="min-w-0">
        <div className="flex min-w-0 items-start gap-2">
          <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-lg border theme-border theme-surface-muted">
            <FileText className="size-3.5 text-[var(--accent-foreground)]" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h4 className="text-sm font-semibold leading-5 theme-foreground">
              {item.name}
            </h4>
            <p className="mt-1 text-xs theme-muted xl:hidden">
              {item.category} · {item.format} · {item.source}
            </p>
          </div>
        </div>
      </div>
      <LibraryCell label="Category" value={item.category} />
      <LibraryCell label="Used for" value={item.usedFor} />
      <LibraryCell label="Usually prepared by" value={item.filledBy} />
      <LibraryCell label="Format" value={item.format} />
      <LibraryCell label="Source" value={item.source} />
      <div className="mt-2 xl:mt-0">
        <StatusChips statuses={formLibraryLabels(item)} />
      </div>
      <div className="mt-4 grid gap-2 sm:flex sm:flex-wrap xl:mt-0 xl:flex xl:flex-col xl:flex-nowrap xl:items-stretch">
        {actions.map((action) => (
          <FormLibraryAction
            key={action}
            action={action}
            item={item}
            onAction={onAction}
          />
        ))}
      </div>
    </article>
  );
}

function FormLibraryAction({
  action,
  item,
  onAction,
}: {
  action: string;
  item: FormLibraryItem;
  onAction: (item: FormLibraryItem, action: string) => void;
}) {
  const templateHref = item.templateSlug ? `/templates/trade82/${item.templateSlug}` : null;
  const templatePdfHref = item.templateSlug ? `/templates/trade82/${item.templateSlug}.pdf` : null;
  const isTemplatePrintAction =
    templateHref && (action === "Preview" || action === "Print / Save as PDF");
  const isTemplatePdfDownload = templatePdfHref && action === "Download PDF";
  const isOfficialSourceAction = item.officialUrl && action === "Open official source";
  const icon = action.startsWith("Open") || action === "Print / Save as PDF" ? (
    <ExternalLink className="size-3.5" aria-hidden="true" />
  ) : action.startsWith("Download") ? (
    <Download className="size-3.5" aria-hidden="true" />
  ) : (
    <Eye className="size-3.5" aria-hidden="true" />
  );
  const className =
    "inline-flex h-8 w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 text-xs font-medium transition theme-secondary-button hover:-translate-y-0.5 sm:w-auto xl:w-full";

  if (isTemplatePrintAction) {
    return (
      <Link
        href={templateHref}
        target={action === "Print / Save as PDF" ? "_blank" : undefined}
        rel={action === "Print / Save as PDF" ? "noopener noreferrer" : undefined}
        className={className}
      >
        {icon}
        {action}
      </Link>
    );
  }

  if (isTemplatePdfDownload) {
    return (
      <a
        href={templatePdfHref}
        download
        className={className}
      >
        {icon}
        {action}
      </a>
    );
  }

  if (isOfficialSourceAction) {
    return (
      <a
        href={item.officialUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        {icon}
        {action}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onAction(item, action)}
      className={className}
    >
      {icon}
      {action}
    </button>
  );
}

function MyDocumentsView({ onAction }: { onAction: NoticeHandler }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<MyDocumentFilter>("All");
  const [viewMode, setViewMode] = useState<DocumentViewMode>("grid");
  const [documents, setDocuments] = useState<MyDocumentItem[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [selectedCategory, setSelectedCategory] =
    useState<DocumentCategoryValue>("company");
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [deletingFolderId, setDeletingFolderId] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [renameTarget, setRenameTarget] = useState<RenameTarget | null>(null);
  const [openedFolder, setOpenedFolder] = useState<FolderItem | null>(null);
  const [folderWindowSearch, setFolderWindowSearch] = useState("");
  const [folderWindowViewMode, setFolderWindowViewMode] =
    useState<DocumentViewMode>("grid");
  const [draggingFolderWindow, setDraggingFolderWindow] = useState(false);
  const [contextMenu, setContextMenu] =
    useState<FileManagerContextMenuState | null>(null);
  const [activeFolderMenuId, setActiveFolderMenuId] = useState("");
  const [draggingDocuments, setDraggingDocuments] = useState(false);
  const [draggingFolderId, setDraggingFolderId] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const folderMenuRef = useRef<HTMLDivElement>(null);

  const applyPayload = useCallback((payload: DocumentsApiPayload) => {
    const mappedFolders = payload.folders.map(mapApiFolder);
    setFolders(mappedFolders);
    setOpenedFolder((current) =>
      current
        ? mappedFolders.find((folder) => folder.id === current.id) ?? null
        : current,
    );
    setDocuments(payload.documents.map(mapApiDocument));
  }, []);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/account/documents", {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as
        | (DocumentsApiPayload & { error?: string })
        | null;
      if (!response.ok || !payload) {
        throw new Error(payload?.error || "Could not load documents.");
      }
      applyPayload(payload);
      if (payload.companyRequired) {
        onAction("Create a company profile before using document storage.", "error");
      }
    } catch (error) {
      onAction(error instanceof Error ? error.message : "Could not load documents.", "error");
    } finally {
      setLoading(false);
    }
  }, [applyPayload, onAction]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDocuments();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadDocuments]);

  useEffect(() => {
    if (!contextMenu) return undefined;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Node && menuRef.current?.contains(target)) return;
      setContextMenu(null);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setContextMenu(null);
    }

    function handleScroll() {
      setContextMenu(null);
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [contextMenu]);

  useEffect(() => {
    if (!activeFolderMenuId) return undefined;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Node && folderMenuRef.current?.contains(target)) return;
      setActiveFolderMenuId("");
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setActiveFolderMenuId("");
    }

    function handleScroll() {
      setActiveFolderMenuId("");
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [activeFolderMenuId]);

  useEffect(() => {
    if (!openedFolder) return undefined;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenedFolder(null);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openedFolder]);

  const foldersForCategory = useMemo(
    () => folders.filter((folder) => folder.category === selectedCategory),
    [folders, selectedCategory],
  );

  const filteredDocuments = useMemo(() => {
    const query = search.trim().toLowerCase();

    return documents.filter((document) => {
      const matchesFilter =
        filter === "All" ||
        documentCategoryLabels[document.category] === filter ||
        documentVisibilityLabels[document.visibilityStatus] === filter;
      const searchableText = [
        document.fileName,
        documentCategoryLabels[document.category],
        document.fileType,
        document.folderName ?? "",
        documentVisibilityLabels[document.visibilityStatus],
      ]
        .join(" ")
        .toLowerCase();

      return matchesFilter && (!query || searchableText.includes(query));
    });
  }, [documents, filter, search]);

  const openedFolderDocuments = useMemo(() => {
    if (!openedFolder) return [];
    const query = folderWindowSearch.trim().toLowerCase();

    return documents.filter((document) => {
      if (document.folderId !== openedFolder.id) return false;
      if (!query) return true;
      return [
        document.fileName,
        document.fileType,
        documentVisibilityLabels[document.visibilityStatus],
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [documents, folderWindowSearch, openedFolder]);

  function clampMenuCoordinates(
    x: number,
    y: number,
    menuHeight = DOCUMENT_MENU_HEIGHT,
  ) {
    return {
      x: Math.max(
        MENU_VIEWPORT_MARGIN,
        Math.min(x, window.innerWidth - FILE_MANAGER_MENU_WIDTH - MENU_VIEWPORT_MARGIN),
      ),
      y: Math.max(
        MENU_VIEWPORT_MARGIN,
        Math.min(y, window.innerHeight - menuHeight - MENU_VIEWPORT_MARGIN),
      ),
    };
  }

  function menuCoordinates(event: MouseEvent<HTMLElement>) {
    if (event.type === "contextmenu") {
      return clampMenuCoordinates(event.clientX, event.clientY);
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const x = rect.left;
    const y = rect.bottom + MENU_GAP;
    return clampMenuCoordinates(x, y);
  }

  function openDocumentMenu(
    documentItem: MyDocumentItem,
    event: MouseEvent<HTMLElement>,
  ) {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({ kind: "document", item: documentItem, ...menuCoordinates(event) });
  }

  function openFolderMenu(folder: FolderItem, event: MouseEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu(null);
    setActiveFolderMenuId((current) => (current === folder.id ? "" : folder.id));
  }

  function selectFolder(folder: FolderItem) {
    setSelectedCategory(folder.category);
    setSelectedFolderId(folder.id);
    setFilter(documentCategoryLabels[folder.category]);
    setContextMenu(null);
    setActiveFolderMenuId("");
  }

  function openFolderWindow(folder: FolderItem) {
    setOpenedFolder(folder);
    setFolderWindowSearch("");
    setContextMenu(null);
    setActiveFolderMenuId("");
    selectFolder(folder);
  }

  async function uploadDocuments(
    files: File[],
    target: DocumentUploadTarget = {
      category: selectedCategory,
      folderId: selectedFolderId || null,
    },
  ) {
    if (!files.length) return;
    if (uploading) {
      onAction("Upload is already in progress.", "error");
      return;
    }

    const validationError = validateClientDocumentFiles(files);
    if (validationError) {
      onAction(validationError, "error");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setUploading(true);
    try {
      for (const [index, file] of files.entries()) {
        setUploadStatus(
          files.length > 1
            ? `Uploading ${index + 1} of ${files.length}...`
            : "Uploading...",
        );

        const formData = new FormData();
        formData.append("file", file);
        formData.append("category", target.category);
        formData.append("visibilityStatus", "private");
        if (target.folderId) formData.append("folderId", target.folderId);

        const response = await fetch("/api/account/documents", {
          method: "POST",
          body: formData,
        });
        const payload = (await response.json().catch(() => null)) as
          | (DocumentsApiPayload & { error?: string })
          | null;
        if (!response.ok || !payload) {
          throw new Error(payload?.error || "Document upload failed.");
        }
        applyPayload(payload);
      }

      setSelectedCategory(target.category);
      setSelectedFolderId(target.folderId ?? "");
      setFilter(documentCategoryLabels[target.category]);
      onAction(files.length === 1 ? "Document uploaded." : `${files.length} documents uploaded.`);
    } catch (error) {
      onAction(error instanceof Error ? error.message : "Document upload failed.", "error");
    } finally {
      setUploading(false);
      setUploadStatus("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function resetDragState() {
    dragDepthRef.current = 0;
    setDraggingDocuments(false);
    setDraggingFolderId("");
  }

  function handleDocumentDragEnter(event: DragEvent<HTMLElement>) {
    if (!dragEventHasFiles(event)) return;
    event.preventDefault();
    dragDepthRef.current += 1;
    setDraggingDocuments(true);
  }

  function handleDocumentDragOver(event: DragEvent<HTMLElement>) {
    if (!dragEventHasFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = uploading ? "none" : "copy";
    setDraggingDocuments(true);
  }

  function handleDocumentDragLeave(event: DragEvent<HTMLElement>) {
    if (!dragEventHasFiles(event)) return;
    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setDraggingDocuments(false);
      setDraggingFolderId("");
    }
  }

  function handleDocumentDrop(event: DragEvent<HTMLElement>) {
    if (!dragEventHasFiles(event)) return;
    event.preventDefault();
    const files = filesFromDragEvent(event);
    resetDragState();
    void uploadDocuments(files);
  }

  function handleFolderDragEnter(event: DragEvent<HTMLElement>, folderId: string) {
    if (!dragEventHasFiles(event)) return;
    event.preventDefault();
    setDraggingFolderId(folderId);
  }

  function handleFolderDragOver(event: DragEvent<HTMLElement>) {
    if (!dragEventHasFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = uploading ? "none" : "copy";
  }

  function handleFolderDragLeave(event: DragEvent<HTMLElement>, folderId: string) {
    if (!dragEventHasFiles(event)) return;
    const relatedTarget = event.relatedTarget;
    if (relatedTarget instanceof Node && event.currentTarget.contains(relatedTarget)) {
      return;
    }
    if (draggingFolderId === folderId) setDraggingFolderId("");
  }

  function handleFolderDrop(event: DragEvent<HTMLElement>, folder: FolderItem) {
    if (!dragEventHasFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    const files = filesFromDragEvent(event);
    resetDragState();
    void uploadDocuments(files, {
      category: folder.category,
      folderId: folder.id,
    });
  }

  function handleFolderWindowDragEnter(event: DragEvent<HTMLElement>) {
    if (!dragEventHasFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    setDraggingFolderWindow(true);
  }

  function handleFolderWindowDragOver(event: DragEvent<HTMLElement>) {
    if (!dragEventHasFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = uploading ? "none" : "copy";
    setDraggingFolderWindow(true);
  }

  function handleFolderWindowDragLeave(event: DragEvent<HTMLElement>) {
    if (!dragEventHasFiles(event)) return;
    const relatedTarget = event.relatedTarget;
    if (relatedTarget instanceof Node && event.currentTarget.contains(relatedTarget)) {
      return;
    }
    setDraggingFolderWindow(false);
  }

  function handleFolderWindowDrop(event: DragEvent<HTMLElement>, folder: FolderItem) {
    if (!dragEventHasFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    const files = filesFromDragEvent(event);
    setDraggingFolderWindow(false);
    void uploadDocuments(files, {
      category: folder.category,
      folderId: folder.id,
    });
  }

  async function createFolder() {
    const name = window.prompt("Folder name");
    if (!name?.trim()) return;

    setCreatingFolder(true);
    try {
      const response = await fetch("/api/account/document-folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          category: selectedCategory,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { folder?: { id: string }; error?: string }
        | null;
      if (!response.ok || !payload?.folder) {
        throw new Error(payload?.error || "Folder could not be created.");
      }
      await loadDocuments();
      setSelectedFolderId(payload.folder.id);
      onAction("Folder created.");
    } catch (error) {
      onAction(error instanceof Error ? error.message : "Folder could not be created.", "error");
    } finally {
      setCreatingFolder(false);
    }
  }

  async function openDocument(document: MyDocumentItem) {
    try {
      setContextMenu(null);
      const response = await fetch(`/api/account/documents/${document.id}/signed-url`, {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as
        | { url?: string; error?: string }
        | null;
      if (!response.ok || !payload?.url) {
        throw new Error(payload?.error || "Document could not be opened.");
      }
      window.open(payload.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      onAction(error instanceof Error ? error.message : "Document could not be opened.", "error");
    }
  }

  async function downloadDocument(documentItem: MyDocumentItem) {
    try {
      setContextMenu(null);
      const response = await fetch(`/api/account/documents/${documentItem.id}/signed-url`, {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as
        | { url?: string; error?: string }
        | null;
      if (!response.ok || !payload?.url) {
        throw new Error(payload?.error || "Document could not be downloaded.");
      }

      const fileResponse = await fetch(payload.url);
      if (!fileResponse.ok) {
        throw new Error("Document could not be downloaded.");
      }
      const blob = await fileResponse.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = globalThis.document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = documentItem.fileName;
      globalThis.document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      onAction("Download started.");
    } catch (error) {
      onAction(error instanceof Error ? error.message : "Document could not be downloaded.", "error");
    }
  }

  async function renameDocument(documentItem: MyDocumentItem, fileName: string) {
    setRenaming(true);
    try {
      const response = await fetch(`/api/account/documents/${documentItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { document?: DocumentApiItem; error?: string }
        | null;
      if (!response.ok || !payload?.document) {
        throw new Error(payload?.error || "Document could not be renamed.");
      }
      const renamed = mapApiDocument(payload.document);
      setDocuments((current) =>
        current.map((item) => (item.id === renamed.id ? renamed : item)),
      );
      setRenameTarget(null);
      onAction("Document renamed.");
    } catch (error) {
      onAction(error instanceof Error ? error.message : "Document could not be renamed.", "error");
    } finally {
      setRenaming(false);
    }
  }

  async function renameFolder(folder: FolderItem, name: string) {
    setRenaming(true);
    try {
      const response = await fetch("/api/account/document-folders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId: folder.id, name }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { folder?: FolderApiItem; error?: string }
        | null;
      if (!response.ok || !payload?.folder) {
        throw new Error(payload?.error || `Folder rename request failed (${response.status}).`);
      }
      const renamed = mapApiFolder(payload.folder);
      setFolders((current) =>
        current.map((item) => (item.id === renamed.id ? renamed : item)),
      );
      setOpenedFolder((current) =>
        current?.id === renamed.id ? renamed : current,
      );
      setDocuments((current) =>
        current.map((item) =>
          item.folderId === renamed.id ? { ...item, folderName: renamed.name } : item,
        ),
      );
      setRenameTarget(null);
      onAction("Folder renamed.");
    } catch (error) {
      onAction(error instanceof Error ? error.message : "Folder rename request failed.", "error");
    } finally {
      setRenaming(false);
    }
  }

  async function deleteDocument(document: MyDocumentItem) {
    if (!window.confirm(`Delete ${document.fileName}? This cannot be undone.`)) {
      return;
    }

    setDeletingId(document.id);
    try {
      setContextMenu(null);
      const response = await fetch(`/api/account/documents/${document.id}`, {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Document could not be deleted.");
      }
      setDocuments((current) => current.filter((item) => item.id !== document.id));
      setFolders((current) =>
        current.map((folder) =>
          folder.id === document.folderId
            ? { ...folder, files: Math.max(0, folder.files - 1) }
            : folder,
        ),
      );
      setOpenedFolder((current) =>
        current && current.id === document.folderId
          ? { ...current, files: Math.max(0, current.files - 1) }
          : current,
      );
      onAction("Document deleted.");
    } catch (error) {
      onAction(error instanceof Error ? error.message : "Document could not be deleted.", "error");
    } finally {
      setDeletingId("");
    }
  }

  async function deleteFolder(folder: FolderItem) {
    setActiveFolderMenuId("");
    if (folder.files > 0) {
      onAction("Move or delete documents before deleting this folder.", "error");
      return;
    }
    if (!window.confirm(`Delete folder ${folder.name}? This cannot be undone.`)) {
      return;
    }

    setDeletingFolderId(folder.id);
    try {
      const response = await fetch("/api/account/document-folders", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId: folder.id }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) {
        throw new Error(payload?.error || `Folder delete request failed (${response.status}).`);
      }
      setFolders((current) => current.filter((item) => item.id !== folder.id));
      setOpenedFolder((current) => (current?.id === folder.id ? null : current));
      if (selectedFolderId === folder.id) setSelectedFolderId("");
      onAction("Folder deleted.");
    } catch (error) {
      onAction(error instanceof Error ? error.message : "Folder delete request failed.", "error");
    } finally {
      setDeletingFolderId("");
    }
  }

  function submitRename(target: RenameTarget, value: string) {
    if (target.kind === "document") {
      void renameDocument(target.item, value);
      return;
    }
    void renameFolder(target.item, value);
  }

  return (
    <div
      className="relative grid gap-4"
      onDragEnter={handleDocumentDragEnter}
      onDragOver={handleDocumentDragOver}
      onDragLeave={handleDocumentDragLeave}
      onDrop={handleDocumentDrop}
    >
      {draggingDocuments ? (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-2xl border border-emerald-300/40 bg-[var(--background)]/75 p-4 shadow-2xl shadow-emerald-950/20 backdrop-blur-md">
          <div className="rounded-2xl border border-emerald-300/30 bg-emerald-300/10 px-6 py-5 text-center">
            <Upload className="mx-auto size-6 text-[var(--accent-foreground)]" aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold theme-foreground">
              Drop files to upload
            </p>
            <p className="mt-1 text-xs theme-muted">
              PDF, JPG, PNG, or WebP · Max 20MB
            </p>
          </div>
        </div>
      ) : null}

      <section className="rounded-2xl border p-4 theme-surface-elevated">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold theme-foreground">
                My Documents
              </h3>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 theme-muted">
              Store and organize company, product, compliance, shipping, and contract documents for Trade82 workflows.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="grid gap-1">
              <span className="sr-only">Document category</span>
              <select
                value={selectedCategory}
                onChange={(event) => {
                  setSelectedCategory(event.target.value as DocumentCategoryValue);
                  setSelectedFolderId("");
                }}
                className="h-8 rounded-md border px-2 text-xs font-medium theme-input"
              >
                {documentCategoryOptions.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1">
              <span className="sr-only">Document folder</span>
              <select
                value={selectedFolderId}
                onChange={(event) => setSelectedFolderId(event.target.value)}
                className="h-8 max-w-44 rounded-md border px-2 text-xs font-medium theme-input"
              >
                <option value="">No folder</option>
                {foldersForCategory.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
            </label>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                if (files.length) void uploadDocuments(files);
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-xs font-semibold transition theme-primary-button hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
            >
              <Upload className="size-3.5" aria-hidden="true" />
              {uploading ? "Uploading..." : "Upload document"}
            </button>
            <button
              type="button"
              onClick={() => void createFolder()}
              disabled={creatingFolder}
              className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 text-xs font-semibold transition theme-secondary-button hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
            >
              <FolderPlus className="size-3.5" aria-hidden="true" />
              {creatingFolder ? "Creating..." : "New folder"}
            </button>
            <div className="inline-flex h-8 rounded-md border p-0.5 theme-surface-muted">
              <ViewToggleButton
                active={viewMode === "grid"}
                label="Grid view"
                icon={Grid2X2}
                onClick={() => setViewMode("grid")}
              />
              <ViewToggleButton
                active={viewMode === "list"}
                label="List view"
                icon={List}
                onClick={() => setViewMode("list")}
              />
            </div>
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-dashed px-4 py-3 theme-surface-muted">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-medium theme-muted">
              Drag files anywhere in My Documents, or drop files directly onto a folder.
            </p>
            <p className="text-xs font-semibold theme-muted">
              {uploading ? uploadStatus || "Uploading..." : "PDF, JPG, PNG, WebP · Max 20MB"}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border p-4 theme-surface">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search your documents</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 theme-muted" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search your documents"
              className="h-9 w-full rounded-xl border pl-9 pr-3 text-sm outline-none theme-input focus:border-emerald-300 focus:ring-2 focus:ring-emerald-400/20"
            />
          </label>
          <FilterChips
            filters={myDocumentFilters}
            active={filter}
            onChange={setFilter}
          />
        </div>
      </section>

      <section className="grid overflow-visible gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {folders.map((folder) => (
          <article
            key={folder.id}
            onDragEnter={(event) => handleFolderDragEnter(event, folder.id)}
            onDragOver={handleFolderDragOver}
            onDragLeave={(event) => handleFolderDragLeave(event, folder.id)}
            onDrop={(event) => handleFolderDrop(event, folder)}
            onClick={() => selectFolder(folder)}
            onDoubleClick={() => openFolderWindow(folder)}
            onContextMenu={(event) => openFolderMenu(folder, event)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openFolderWindow(folder);
              }
            }}
            role="button"
            tabIndex={0}
            className={`relative overflow-visible rounded-2xl border p-3 text-left transition theme-surface-elevated theme-card-hover ${
              draggingFolderId === folder.id
                ? "border-emerald-300/70 bg-emerald-300/10 ring-2 ring-emerald-400/20"
                : ""
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="inline-flex size-9 items-center justify-center rounded-xl border theme-border theme-surface-muted">
                <Folder className="size-4 text-[var(--accent-foreground)]" aria-hidden="true" />
              </span>
              <div className="flex items-center gap-1">
                <span className="rounded-full border px-2 py-0.5 text-[11px] font-medium theme-border theme-muted">
                  {documentCategoryLabels[folder.category]}
                </span>
                <button
                  type="button"
                  aria-label={`Open actions for ${folder.name}`}
                  onClick={(event) => openFolderMenu(folder, event)}
                  className="inline-flex size-7 items-center justify-center rounded-md border theme-secondary-button"
                >
                  <MoreHorizontal className="size-3.5" aria-hidden="true" />
                </button>
                {activeFolderMenuId === folder.id ? (
                  <FolderCardMenu
                    ref={folderMenuRef}
                    deleting={deletingFolderId === folder.id}
                    folder={folder}
                    onClose={() => setActiveFolderMenuId("")}
                    onDeleteFolder={deleteFolder}
                    onOpenFolder={openFolderWindow}
                    onRenameFolder={(item) => {
                      setActiveFolderMenuId("");
                      setRenameTarget({ kind: "folder", item });
                    }}
                  />
                ) : null}
              </div>
            </div>
            <h4 className="mt-3 text-sm font-semibold theme-foreground">
              {folder.name}
            </h4>
            <p className="mt-1 text-xs theme-muted">
              {draggingFolderId === folder.id
                ? "Drop files into this folder"
                : `${folder.files} files · Updated ${folder.updated}`}
            </p>
          </article>
        ))}
      </section>

      {loading ? (
        <div className="rounded-2xl border p-8 text-center theme-surface-muted">
          <p className="text-sm font-semibold theme-foreground">
            Loading documents...
          </p>
        </div>
      ) : null}

      {viewMode === "grid" ? (
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredDocuments.map((document) => (
            <DocumentCard
              key={document.id}
              document={document}
              deleting={deletingId === document.id}
              onContextMenu={openDocumentMenu}
              onMenu={openDocumentMenu}
            />
          ))}
        </section>
      ) : (
        <section className="overflow-hidden rounded-2xl border theme-surface">
          <div className="hidden border-b px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] theme-border theme-surface-muted theme-muted lg:grid lg:grid-cols-[1.3fr_0.65fr_0.55fr_0.75fr_0.85fr_0.75fr_0.8fr] lg:gap-3">
            <span>File name</span>
            <span>Category</span>
            <span>Type</span>
            <span>Status</span>
            <span>Visibility</span>
            <span>Modified</span>
            <span>Actions</span>
          </div>
          <div className="divide-y theme-border">
            {filteredDocuments.map((document) => (
              <DocumentRow
                key={document.id}
                document={document}
                deleting={deletingId === document.id}
                onContextMenu={openDocumentMenu}
                onMenu={openDocumentMenu}
              />
            ))}
          </div>
        </section>
      )}

      {!loading && !filteredDocuments.length ? (
        <div className="rounded-2xl border border-dashed p-8 text-center theme-surface-muted">
          <p className="text-sm font-semibold theme-foreground">
            No documents found.
          </p>
          <p className="mt-2 text-sm theme-muted">
            Try a different keyword or folder filter.
          </p>
        </div>
      ) : null}

      {contextMenu ? (
        <FileManagerContextMenu
          ref={menuRef}
          menu={contextMenu}
          deletingDocumentId={deletingId}
          onClose={() => setContextMenu(null)}
          onDeleteDocument={deleteDocument}
          onDownloadDocument={downloadDocument}
          onOpenDocument={openDocument}
          onRenameDocument={(item) => {
            setContextMenu(null);
            setRenameTarget({ kind: "document", item });
          }}
        />
      ) : null}

      {openedFolder ? (
        <FolderWindow
          documents={openedFolderDocuments}
          dragging={draggingFolderWindow}
          folder={openedFolder}
          search={folderWindowSearch}
          uploading={uploading}
          uploadStatus={uploadStatus}
          viewMode={folderWindowViewMode}
          onClose={() => {
            setDraggingFolderWindow(false);
            setOpenedFolder(null);
          }}
          onContextMenu={openDocumentMenu}
          onDragEnter={handleFolderWindowDragEnter}
          onDragLeave={handleFolderWindowDragLeave}
          onDragOver={handleFolderWindowDragOver}
          onDrop={(event) => handleFolderWindowDrop(event, openedFolder)}
          onMenu={openDocumentMenu}
          onSearchChange={setFolderWindowSearch}
          onUploadFiles={(files) =>
            uploadDocuments(files, {
              category: openedFolder.category,
              folderId: openedFolder.id,
            })
          }
          onViewModeChange={setFolderWindowViewMode}
        />
      ) : null}

      {renameTarget ? (
        <RenameDialog
          key={`${renameTarget.kind}-${renameTarget.item.id}`}
          busy={renaming}
          initialValue={
            renameTarget.kind === "document"
              ? renameTarget.item.fileName
              : renameTarget.item.name
          }
          title={renameTarget.kind === "document" ? "Rename document" : "Rename folder"}
          confirmLabel={renaming ? "Saving..." : "Rename"}
          onCancel={() => {
            if (!renaming) setRenameTarget(null);
          }}
          onSubmit={(value) => submitRename(renameTarget, value)}
        />
      ) : null}
    </div>
  );
}

function FolderWindow({
  documents,
  dragging,
  folder,
  onClose,
  onContextMenu,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
  onMenu,
  onSearchChange,
  onUploadFiles,
  onViewModeChange,
  search,
  uploading,
  uploadStatus,
  viewMode,
}: {
  documents: MyDocumentItem[];
  dragging: boolean;
  folder: FolderItem;
  onClose: () => void;
  onContextMenu: (document: MyDocumentItem, event: MouseEvent<HTMLElement>) => void;
  onDragEnter: (event: DragEvent<HTMLElement>) => void;
  onDragLeave: (event: DragEvent<HTMLElement>) => void;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
  onMenu: (document: MyDocumentItem, event: MouseEvent<HTMLElement>) => void;
  onSearchChange: (value: string) => void;
  onUploadFiles: (files: File[]) => void;
  onViewModeChange: (mode: DocumentViewMode) => void;
  search: string;
  uploading: boolean;
  uploadStatus: string;
  viewMode: DocumentViewMode;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-6"
      onClick={onClose}
    >
      <section
        className="relative flex max-h-[calc(100dvh-1.5rem)] w-full max-w-[880px] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white text-zinc-950 shadow-2xl shadow-zinc-950/25 sm:max-h-[76vh]"
        onClick={(event) => event.stopPropagation()}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {dragging ? (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-emerald-50/85 p-6">
            <div className="rounded-2xl border border-emerald-300 bg-white px-6 py-5 text-center shadow-xl shadow-emerald-950/10">
              <Folder className="mx-auto size-7 text-emerald-600" aria-hidden="true" />
              <p className="mt-3 text-sm font-semibold text-zinc-950">
                Drop files into {folder.name}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                PDF, JPG, PNG, or WebP · Max 20MB
              </p>
            </div>
          </div>
        ) : null}

        <header className="border-b border-zinc-200 bg-zinc-50/80 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-2.5">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white">
                <FolderOpen className="size-4 text-emerald-600" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold text-zinc-950">
                  {folder.name}
                </h3>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[11px] font-medium text-zinc-600">
                    {documentCategoryLabels[folder.category]}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {documents.length} {documents.length === 1 ? "file" : "files"}
                  </span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close folder"
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>

          <div className="mt-3 flex flex-col gap-2 lg:flex-row lg:items-center">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                if (files.length) onUploadFiles(files);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-zinc-950 px-3 text-xs font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Upload className="size-3.5" aria-hidden="true" />
              {uploading ? uploadStatus || "Uploading..." : "Upload to this folder"}
            </button>
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Search inside folder</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Search inside folder"
                className="h-8 w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-3 text-xs text-zinc-950 outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-400/20"
              />
            </label>
            <div className="inline-flex h-8 rounded-lg border border-zinc-200 bg-white p-0.5">
              <button
                type="button"
                aria-label="Folder grid view"
                onClick={() => onViewModeChange("grid")}
                className={`inline-flex size-7 items-center justify-center rounded-md transition ${
                  viewMode === "grid"
                    ? "bg-zinc-950 text-white"
                    : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950"
                }`}
              >
                <Grid2X2 className="size-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Folder list view"
                onClick={() => onViewModeChange("list")}
                className={`inline-flex size-7 items-center justify-center rounded-md transition ${
                  viewMode === "list"
                    ? "bg-zinc-950 text-white"
                    : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950"
                }`}
              >
                <List className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </header>

        <div className="min-h-0 overflow-y-auto bg-white p-3">
          {!documents.length ? (
            <div className="mx-auto flex min-h-[280px] max-w-sm items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-6 py-8 text-center">
              <div>
                <FolderOpen className="mx-auto size-8 text-zinc-400" aria-hidden="true" />
                <p className="mt-3 text-sm font-semibold text-zinc-950">
                  This folder is empty.
                </p>
                <p className="mt-1 text-sm text-zinc-500">
                  Drag files here or upload a document.
                </p>
              </div>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {documents.map((document) => (
                <DocumentCard
                  key={document.id}
                  document={document}
                  deleting={false}
                  onContextMenu={onContextMenu}
                  onMenu={onMenu}
                />
              ))}
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
              <div className="hidden border-b border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500 lg:grid lg:grid-cols-[1.3fr_0.65fr_0.55fr_0.75fr_0.85fr_0.75fr_0.8fr] lg:gap-3">
                <span>File name</span>
                <span>Category</span>
                <span>Type</span>
                <span>Status</span>
                <span>Visibility</span>
                <span>Modified</span>
                <span>Actions</span>
              </div>
              <div className="divide-y divide-zinc-200">
                {documents.map((document) => (
                  <DocumentRow
                    key={document.id}
                    document={document}
                    deleting={false}
                    onContextMenu={onContextMenu}
                    onMenu={onMenu}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function DocumentCard({
  document,
  deleting,
  onContextMenu,
  onMenu,
}: {
  document: MyDocumentItem;
  deleting: boolean;
  onContextMenu: (document: MyDocumentItem, event: MouseEvent<HTMLElement>) => void;
  onMenu: (document: MyDocumentItem, event: MouseEvent<HTMLElement>) => void;
}) {
  return (
    <article
      onContextMenu={(event) => onContextMenu(document, event)}
      className="rounded-2xl border p-3 theme-surface-elevated"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl border theme-border theme-surface-muted">
            <FileText className="size-4 text-[var(--accent-foreground)]" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h4 className="line-clamp-2 text-sm font-semibold leading-5 theme-foreground">
              {document.fileName}
            </h4>
            <p className="mt-1 text-xs theme-muted">
              {documentCategoryLabels[document.category]} · {document.fileType} · {formatFileSize(document.fileSize)}
            </p>
            {document.folderName ? (
              <p className="mt-1 text-xs theme-muted">{document.folderName}</p>
            ) : null}
          </div>
        </div>
        <DocumentActions
          deleting={deleting}
          document={document}
          onMenu={onMenu}
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <StatusChip label="Uploaded" tone="Uploaded" />
        <StatusChip
          label={documentVisibilityLabels[document.visibilityStatus]}
          tone={documentVisibilityLabels[document.visibilityStatus]}
        />
      </div>
      <p className="mt-3 text-xs theme-muted">
        Last modified {document.lastModified}
      </p>
    </article>
  );
}

function DocumentRow({
  document,
  deleting,
  onContextMenu,
  onMenu,
}: {
  document: MyDocumentItem;
  deleting: boolean;
  onContextMenu: (document: MyDocumentItem, event: MouseEvent<HTMLElement>) => void;
  onMenu: (document: MyDocumentItem, event: MouseEvent<HTMLElement>) => void;
}) {
  return (
    <article
      onContextMenu={(event) => onContextMenu(document, event)}
      className="grid gap-3 p-3 transition hover:bg-[var(--muted)] lg:grid-cols-[1.3fr_0.65fr_0.55fr_0.75fr_0.85fr_0.75fr_0.8fr] lg:items-center"
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border theme-border theme-surface-muted">
          <FileText className="size-4 text-[var(--accent-foreground)]" aria-hidden="true" />
        </span>
        <span className="truncate text-sm font-semibold theme-foreground">
          {document.fileName}
        </span>
      </div>
      <LibraryCell label="Category" value={documentCategoryLabels[document.category]} />
      <LibraryCell label="Type" value={document.fileType} />
      <div>
        <StatusChip label="Uploaded" tone="Uploaded" />
      </div>
      <div>
        <StatusChip
          label={documentVisibilityLabels[document.visibilityStatus]}
          tone={documentVisibilityLabels[document.visibilityStatus]}
        />
      </div>
      <LibraryCell label="Modified" value={document.lastModified} />
      <DocumentActions
        deleting={deleting}
        document={document}
        onMenu={onMenu}
      />
    </article>
  );
}

function DocumentActions({
  deleting,
  document,
  onMenu,
}: {
  deleting: boolean;
  document: MyDocumentItem;
  onMenu: (document: MyDocumentItem, event: MouseEvent<HTMLElement>) => void;
}) {
  return (
    <button
      type="button"
      onClick={(event) => onMenu(document, event)}
      disabled={deleting}
      className="inline-flex h-8 items-center gap-1 rounded-md border px-2 text-xs font-medium transition theme-secondary-button hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
    >
      <MoreHorizontal className="size-3.5" aria-hidden="true" />
      Actions
    </button>
  );
}

const FileManagerContextMenu = forwardRef<
  HTMLDivElement,
  {
    menu: FileManagerContextMenuState;
    deletingDocumentId: string;
    onClose: () => void;
    onDeleteDocument: (document: MyDocumentItem) => void;
    onDownloadDocument: (document: MyDocumentItem) => void;
    onOpenDocument: (document: MyDocumentItem) => void;
    onRenameDocument: (document: MyDocumentItem) => void;
  }
>(function FileManagerContextMenu(
  {
    menu,
    deletingDocumentId,
    onClose,
    onDeleteDocument,
    onDownloadDocument,
    onOpenDocument,
    onRenameDocument,
  },
  ref,
) {
  const deleting = deletingDocumentId === menu.item.id;

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Document actions"
      className="fixed z-50 w-56 rounded-xl border border-zinc-200 bg-white p-1.5 text-zinc-900 shadow-xl shadow-zinc-950/15"
      style={{ left: menu.x, top: menu.y }}
    >
      <ContextMenuButton
        icon={Eye}
        label="Open / Preview"
        onClick={() => onOpenDocument(menu.item)}
      />
      <ContextMenuButton
        icon={Download}
        label="Download"
        onClick={() => onDownloadDocument(menu.item)}
      />
      <MenuDivider />
      <ContextMenuButton
        icon={Pencil}
        label="Rename"
        onClick={() => onRenameDocument(menu.item)}
      />
      <ContextMenuButton
        danger
        disabled={deleting}
        icon={Trash2}
        label={deleting ? "Deleting..." : "Delete"}
        onClick={() => onDeleteDocument(menu.item)}
      />
      <button
        type="button"
        onClick={onClose}
        className="mt-1 w-full rounded-lg px-2 py-1.5 text-left text-xs font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
      >
        Close
      </button>
    </div>
  );
});

const FolderCardMenu = forwardRef<
  HTMLDivElement,
  {
    deleting: boolean;
    folder: FolderItem;
    onClose: () => void;
    onDeleteFolder: (folder: FolderItem) => void;
    onOpenFolder: (folder: FolderItem) => void;
    onRenameFolder: (folder: FolderItem) => void;
  }
>(function FolderCardMenu(
  {
    deleting,
    folder,
    onClose,
    onDeleteFolder,
    onOpenFolder,
    onRenameFolder,
  },
  ref,
) {
  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Folder actions"
      className="absolute right-0 top-9 z-50 w-56 rounded-xl border border-zinc-200 bg-white p-1.5 text-zinc-900 shadow-xl shadow-zinc-950/15"
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <ContextMenuButton
        icon={FolderOpen}
        label="Open folder"
        onClick={() => onOpenFolder(folder)}
      />
      <MenuDivider />
      <ContextMenuButton
        icon={Pencil}
        label="Rename folder"
        onClick={() => onRenameFolder(folder)}
      />
      <ContextMenuButton
        danger
        disabled={deleting}
        icon={Trash2}
        label={deleting ? "Deleting..." : "Delete folder"}
        onClick={() => onDeleteFolder(folder)}
      />
      <button
        type="button"
        onClick={onClose}
        className="mt-1 w-full rounded-lg px-2 py-1.5 text-left text-xs font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
      >
        Close
      </button>
    </div>
  );
});

function ContextMenuButton({
  danger = false,
  disabled = false,
  icon: Icon,
  label,
  onClick,
}: {
  danger?: boolean;
  disabled?: boolean;
  icon: typeof Eye;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={`flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
        danger
          ? "text-red-600 hover:bg-red-50"
          : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950"
      }`}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </button>
  );
}

function MenuDivider() {
  return <div className="my-1 h-px bg-zinc-200" role="separator" />;
}

function RenameDialog({
  busy,
  confirmLabel,
  initialValue,
  onCancel,
  onSubmit,
  title,
}: {
  busy: boolean;
  confirmLabel: string;
  initialValue: string;
  onCancel: () => void;
  onSubmit: (value: string) => void;
  title: string;
}) {
  const [value, setValue] = useState(initialValue);

  const trimmed = value.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/45 p-4 backdrop-blur-sm">
      <form
        className="w-full max-w-sm rounded-2xl border p-4 theme-surface-elevated"
        onSubmit={(event) => {
          event.preventDefault();
          if (!trimmed || busy) return;
          onSubmit(trimmed);
        }}
      >
        <h3 className="text-sm font-semibold theme-foreground">{title}</h3>
        <label className="mt-4 grid gap-1.5">
          <span className="text-xs font-medium theme-muted">Name</span>
          <input
            autoFocus
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className="h-10 rounded-xl border px-3 text-sm outline-none theme-input focus:border-emerald-300 focus:ring-2 focus:ring-emerald-400/20"
            maxLength={255}
          />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="h-8 rounded-md border px-3 text-xs font-semibold theme-secondary-button disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || !trimmed}
            className="h-8 rounded-md px-3 text-xs font-semibold theme-primary-button disabled:cursor-not-allowed disabled:opacity-60"
          >
            {confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}

function ViewToggleButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof Grid2X2;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`inline-flex size-7 items-center justify-center rounded-md transition ${
        active ? "theme-primary-button" : "theme-ghost-button"
      }`}
    >
      <Icon className="size-3.5" aria-hidden="true" />
    </button>
  );
}

function FilterChips<T extends string>({
  filters,
  active,
  onChange,
}: {
  filters: readonly T[];
  active: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {filters.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => onChange(item)}
          className={`h-8 rounded-full border px-3 text-xs font-medium transition ${
            active === item
              ? "theme-success-badge"
              : "theme-border theme-muted hover:text-[var(--foreground)]"
          }`}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

function LibraryCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] theme-muted xl:hidden">
        {label}
      </p>
      <p className="mt-1 break-words text-xs leading-5 theme-muted lg:mt-0">
        {value}
      </p>
    </div>
  );
}

function StatusChips({ statuses }: { statuses: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {statuses.map((status) => (
        <StatusChip key={status} label={status} tone={status} />
      ))}
    </div>
  );
}

function StatusChip({ label, tone }: { label: string; tone: string }) {
  const className =
    tone === "Needs review"
      ? "theme-warning-badge"
      : tone === "Approved" || tone === "Signed" || tone === "Shared with buyer"
        ? "theme-success-badge"
        : "theme-border theme-muted";

  return (
    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${className}`}>
      {label}
    </span>
  );
}

function formLibraryLabels(item: FormLibraryItem) {
  if (item.templateSlug) {
    return ["Trade82 Template", "Printable template", "Can be auto-filled later"];
  }

  if (item.sourceType === "official") {
    return ["Official source", "Not auto-filled by Trade82", "Broker / importer usually files"];
  }

  if (item.filter === "Logistics") {
    return ["Carrier / forwarder issued", "Reference only", "Not auto-filled by Trade82"];
  }

  if (item.filter === "Compliance") {
    return ["Manufacturer / lab issued", "Buyer may request", "Upload to My Documents later"];
  }

  if (item.sourceType === "template") {
    return ["Trade82 Template", "Can be auto-filled later"];
  }

  return ["Reference only", "Not auto-filled by Trade82"];
}

function formActions(item: FormLibraryItem) {
  if (item.templateSlug) {
    return ["Preview", "Print / Save as PDF", "Download PDF"];
  }
  if (item.sourceType === "official") {
    return item.officialUrl ? ["Open official source", "View details"] : ["View details"];
  }
  return ["View details"];
}
