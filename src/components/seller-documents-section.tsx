"use client";

import {
  Download,
  ExternalLink,
  Eye,
  FileText,
  Folder,
  FolderPlus,
  Grid2X2,
  List,
  MoreHorizontal,
  Search,
  Upload,
} from "lucide-react";
import { useMemo, useState } from "react";

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
};

type MyDocumentItem = {
  id: string;
  name: string;
  category: "Company" | "Product" | "Compliance" | "Shipping" | "Contracts";
  fileType: "PDF" | "DOCX" | "XLSX";
  status: "Approved" | "Uploaded" | "Needs review" | "Draft" | "Signed";
  visibility: "Private" | "Shared with buyer" | "Internal review";
  lastModified: string;
};

type FolderItem = {
  name: string;
  category: Exclude<MyDocumentFilter, "All" | "Shared with buyer">;
  files: number;
  updated: string;
  badge?: string;
};

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
    format: "PDF / DOCX",
    source: "Trade82 template",
    statuses: ["Template", "Workflow support"],
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
    format: "PDF / DOCX",
    source: "Trade82 template",
    statuses: ["Template", "Shipment document"],
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
    format: "PDF / DOCX",
    source: "Trade82 template",
    statuses: ["Template", "Logistics"],
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
    format: "PDF / DOCX",
    source: "Trade82 template",
    statuses: ["Template", "Workflow support"],
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
    format: "PDF / DOCX",
    source: "Trade82 template",
    statuses: ["Template", "Contract support"],
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
    format: "PDF / DOCX",
    source: "Trade82 template",
    statuses: ["Template", "Origin"],
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
    format: "PDF / DOCX",
    source: "Trade82 template",
    statuses: ["Template", "Logistics"],
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
    format: "PDF / DOCX",
    source: "Trade82 template",
    statuses: ["Template", "Workflow support"],
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

const folders: FolderItem[] = [
  {
    name: "Company Documents",
    category: "Company",
    files: 8,
    updated: "Jul 2, 2026",
    badge: "Private",
  },
  {
    name: "Product Documents",
    category: "Product",
    files: 14,
    updated: "Jul 2, 2026",
  },
  {
    name: "Compliance Documents",
    category: "Compliance",
    files: 11,
    updated: "Jul 1, 2026",
    badge: "Needs review",
  },
  {
    name: "Shipping Documents",
    category: "Shipping",
    files: 6,
    updated: "Jun 30, 2026",
  },
  {
    name: "Contracts",
    category: "Contracts",
    files: 4,
    updated: "Jun 29, 2026",
    badge: "Shared with buyer",
  },
];

const myDocuments: MyDocumentItem[] = [
  {
    id: "business-registration-certificate",
    name: "Business Registration Certificate.pdf",
    category: "Company",
    fileType: "PDF",
    status: "Approved",
    visibility: "Private",
    lastModified: "Jul 2, 2026",
  },
  {
    id: "product-specification-sheet",
    name: "Product Specification Sheet.docx",
    category: "Product",
    fileType: "DOCX",
    status: "Uploaded",
    visibility: "Shared with buyer",
    lastModified: "Jul 2, 2026",
  },
  {
    id: "certificate-of-origin",
    name: "Certificate of Origin.pdf",
    category: "Compliance",
    fileType: "PDF",
    status: "Needs review",
    visibility: "Internal review",
    lastModified: "Jul 1, 2026",
  },
  {
    id: "commercial-invoice-draft",
    name: "Commercial Invoice Draft.xlsx",
    category: "Shipping",
    fileType: "XLSX",
    status: "Draft",
    visibility: "Private",
    lastModified: "Jun 30, 2026",
  },
  {
    id: "export-sales-contract",
    name: "Export Sales Contract.pdf",
    category: "Contracts",
    fileType: "PDF",
    status: "Signed",
    visibility: "Shared with buyer",
    lastModified: "Jun 29, 2026",
  },
];

export function SellerDocumentsSection() {
  const [activeTab, setActiveTab] = useState<DocumentsTab>("forms");
  const [notice, setNotice] = useState("");

  function showStorageNotice(message = "Document storage will be available when file storage is connected.") {
    setNotice(message);
  }

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
          <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-xs leading-5 theme-muted">
            Forms and templates are provided for workflow support only. Requirements vary by product, importer, shipment, and government agency. Confirm final requirements with your customs broker, freight forwarder, or compliance advisor.
          </div>
        ) : null}
      </div>

      {notice ? (
        <p
          role="status"
          className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-3 text-sm font-medium theme-success-text"
        >
          {notice}
        </p>
      ) : null}

      {activeTab === "forms" ? (
        <FormsLibraryView onAction={showStorageNotice} />
      ) : (
        <MyDocumentsView onAction={showStorageNotice} />
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

function FormsLibraryView({ onAction }: { onAction: (message?: string) => void }) {
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
    if (action === "Preview") {
      onAction("Template preview will be available soon.");
      return;
    }
    if (action.startsWith("Open official")) {
      onAction("Official source link will be available soon.");
      return;
    }
    onAction("Template file will be available soon.");
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
            <StatusChips statuses={selectedItem.statuses} />
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border theme-surface">
        <div className="hidden border-b px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] theme-border theme-surface-muted theme-muted xl:grid xl:grid-cols-[1.1fr_0.7fr_1.1fr_0.75fr_0.65fr_0.85fr_0.85fr_0.95fr] xl:gap-3">
          <span>Form / Template</span>
          <span>Category</span>
          <span>Used for</span>
          <span>Filled by</span>
          <span>Format</span>
          <span>Source</span>
          <span>Status</span>
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
  const actions = formActions(item.sourceType);

  return (
    <article className="p-3 transition hover:bg-[var(--muted)] xl:grid xl:grid-cols-[1.1fr_0.7fr_1.1fr_0.75fr_0.65fr_0.85fr_0.85fr_0.95fr] xl:items-center xl:gap-3">
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
      <LibraryCell label="Filled by" value={item.filledBy} />
      <LibraryCell label="Format" value={item.format} />
      <LibraryCell label="Source" value={item.source} />
      <div className="mt-2 xl:mt-0">
        <StatusChips statuses={item.statuses} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2 xl:mt-0">
        {actions.map((action) => (
          <button
            key={action}
            type="button"
            onClick={() => onAction(item, action)}
            className="inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs font-medium transition theme-secondary-button hover:-translate-y-0.5"
          >
            {action.startsWith("Open") ? (
              <ExternalLink className="size-3.5" aria-hidden="true" />
            ) : action.startsWith("Download") ? (
              <Download className="size-3.5" aria-hidden="true" />
            ) : (
              <Eye className="size-3.5" aria-hidden="true" />
            )}
            {action}
          </button>
        ))}
      </div>
    </article>
  );
}

function MyDocumentsView({ onAction }: { onAction: (message?: string) => void }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<MyDocumentFilter>("All");
  const [viewMode, setViewMode] = useState<DocumentViewMode>("grid");

  const filteredDocuments = useMemo(() => {
    const query = search.trim().toLowerCase();

    return myDocuments.filter((document) => {
      const matchesFilter =
        filter === "All" ||
        document.category === filter ||
        document.visibility === filter;
      const searchableText = [
        document.name,
        document.category,
        document.fileType,
        document.status,
        document.visibility,
      ]
        .join(" ")
        .toLowerCase();

      return matchesFilter && (!query || searchableText.includes(query));
    });
  }, [filter, search]);

  return (
    <div className="grid gap-4">
      <section className="rounded-2xl border p-4 theme-surface-elevated">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold theme-foreground">
                My Documents
              </h3>
              <span className="rounded-full border px-2 py-1 text-[11px] font-medium theme-warning-badge">
                Storage coming later
              </span>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 theme-muted">
              Store and organize company, product, compliance, shipping, and contract documents for Trade82 workflows.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <PlaceholderButton icon={Upload} label="Upload document" onClick={onAction} primary />
            <PlaceholderButton icon={FolderPlus} label="New folder" onClick={onAction} />
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

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {folders.map((folder) => (
          <button
            key={folder.name}
            type="button"
            onClick={() => onAction()}
            className="rounded-2xl border p-3 text-left transition theme-surface-elevated theme-card-hover"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="inline-flex size-9 items-center justify-center rounded-xl border theme-border theme-surface-muted">
                <Folder className="size-4 text-[var(--accent-foreground)]" aria-hidden="true" />
              </span>
              {folder.badge ? (
                <span className="rounded-full border px-2 py-0.5 text-[11px] font-medium theme-border theme-muted">
                  {folder.badge}
                </span>
              ) : null}
            </div>
            <h4 className="mt-3 text-sm font-semibold theme-foreground">
              {folder.name}
            </h4>
            <p className="mt-1 text-xs theme-muted">
              {folder.files} files · Updated {folder.updated}
            </p>
          </button>
        ))}
      </section>

      {viewMode === "grid" ? (
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredDocuments.map((document) => (
            <DocumentCard key={document.id} document={document} onAction={onAction} />
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
              <DocumentRow key={document.id} document={document} onAction={onAction} />
            ))}
          </div>
        </section>
      )}

      {!filteredDocuments.length ? (
        <div className="rounded-2xl border border-dashed p-8 text-center theme-surface-muted">
          <p className="text-sm font-semibold theme-foreground">
            No documents found.
          </p>
          <p className="mt-2 text-sm theme-muted">
            Try a different keyword or folder filter.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function DocumentCard({
  document,
  onAction,
}: {
  document: MyDocumentItem;
  onAction: (message?: string) => void;
}) {
  return (
    <article className="rounded-2xl border p-3 theme-surface-elevated">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl border theme-border theme-surface-muted">
            <FileText className="size-4 text-[var(--accent-foreground)]" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h4 className="line-clamp-2 text-sm font-semibold leading-5 theme-foreground">
              {document.name}
            </h4>
            <p className="mt-1 text-xs theme-muted">
              {document.category} · {document.fileType}
            </p>
          </div>
        </div>
        <DocumentActions onAction={onAction} />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <StatusChip label={document.status} tone={document.status} />
        <StatusChip label={document.visibility} tone={document.visibility} />
      </div>
      <p className="mt-3 text-xs theme-muted">
        Last modified {document.lastModified}
      </p>
    </article>
  );
}

function DocumentRow({
  document,
  onAction,
}: {
  document: MyDocumentItem;
  onAction: (message?: string) => void;
}) {
  return (
    <article className="grid gap-3 p-3 transition hover:bg-[var(--muted)] lg:grid-cols-[1.3fr_0.65fr_0.55fr_0.75fr_0.85fr_0.75fr_0.8fr] lg:items-center">
      <div className="flex min-w-0 items-center gap-2">
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border theme-border theme-surface-muted">
          <FileText className="size-4 text-[var(--accent-foreground)]" aria-hidden="true" />
        </span>
        <span className="truncate text-sm font-semibold theme-foreground">
          {document.name}
        </span>
      </div>
      <LibraryCell label="Category" value={document.category} />
      <LibraryCell label="Type" value={document.fileType} />
      <div>
        <StatusChip label={document.status} tone={document.status} />
      </div>
      <div>
        <StatusChip label={document.visibility} tone={document.visibility} />
      </div>
      <LibraryCell label="Modified" value={document.lastModified} />
      <DocumentActions onAction={onAction} />
    </article>
  );
}

function DocumentActions({ onAction }: { onAction: (message?: string) => void }) {
  const actions = ["Preview", "Download", "Rename", "Move", "Share", "Delete"];

  return (
    <details className="relative">
      <summary className="inline-flex h-8 cursor-pointer list-none items-center gap-1 rounded-md border px-2 text-xs font-medium transition theme-secondary-button hover:-translate-y-0.5">
        <MoreHorizontal className="size-3.5" aria-hidden="true" />
        Actions
      </summary>
      <div className="absolute right-0 z-20 mt-2 grid min-w-36 gap-1 rounded-xl border p-1 theme-surface-elevated">
        {actions.map((action) => (
          <button
            key={action}
            type="button"
            onClick={() => onAction()}
            className="rounded-lg px-2 py-1.5 text-left text-xs font-medium theme-ghost-button"
          >
            {action}
          </button>
        ))}
      </div>
    </details>
  );
}

function PlaceholderButton({
  icon: Icon,
  label,
  onClick,
  primary = false,
}: {
  icon: typeof Upload;
  label: string;
  onClick: (message?: string) => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick()}
      className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition hover:-translate-y-0.5 ${
        primary ? "theme-primary-button" : "border theme-secondary-button"
      }`}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {label}
    </button>
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
      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] theme-muted lg:hidden">
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

function formActions(sourceType: SourceType) {
  if (sourceType === "template") return ["Download PDF", "Download DOCX", "Preview"];
  if (sourceType === "official") return ["Open official form", "View details"];
  return ["View details"];
}
