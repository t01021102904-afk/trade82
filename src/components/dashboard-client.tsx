"use client";

import {
  Building2,
  ClipboardCheck,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Handshake,
  MessageCircle,
  ShoppingBag,
  Star,
  Search,
  Users,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/badge";
import { useI18n } from "@/components/i18n-provider";
import {
  ProductEditor,
  type DbProduct,
  type EditableProduct,
} from "@/components/product-management";
import { withLocale } from "@/lib/i18n";
import { buyerCategoryLabel } from "@/lib/company-select-options";
import { safeImageUrl } from "@/lib/url-security";

export type DashboardSection =
  | "overview"
  | "saved-products"
  | "following"
  | "messages"
  | "products"
  | "documents";

type Summary = {
  company?: {
    id: string;
    name: string;
    verificationStatus: string;
    categories?: string[];
  } | null;
  buyerProfile?: {
    displayName: string;
    companyName: string;
    categories: string[];
    keywords: string[];
    signUpPath: string;
    profileCompletion: number;
  };
  suggestedCategories?: string[];
  recommendedProducts?: Array<{
    id: string;
    name: string;
    category: string;
    imageUrl: string | null;
    href: string;
    sellerName: string;
    priceMin: string | null;
    priceMax: string | null;
    currency: string;
    moq: string;
    tags: string[];
  }>;
  metrics: Record<string, number>;
  recentReviews: Array<{
    id: string;
    rating: number;
    text: string;
    createdAt: string;
  }>;
  recentInquiries?: Array<{
    id: string;
    message: string;
    companyName: string;
    productName: string | null;
  }>;
  recentSavedItems?: Array<{
    id: string;
    type: "product" | "company";
    displayName: string | null;
    href: string | null;
  }>;
};

type Metric = {
  label: string;
  value: string | number;
  section: DashboardSection;
  icon: MetricIconKey;
};

type MetricIconKey =
  | "users"
  | "productViews"
  | "companyViews"
  | "messages"
  | "deals"
  | "reviews"
  | "products"
  | "rating";

const metricIcons: Record<MetricIconKey, LucideIcon> = {
  users: Users,
  productViews: Eye,
  companyViews: Building2,
  messages: MessageCircle,
  deals: Handshake,
  reviews: ClipboardCheck,
  products: ShoppingBag,
  rating: Star,
};

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

type FormLibraryItem = {
  id: string;
  section: string;
  filter: Exclude<FormsLibraryFilter, "All">;
  name: string;
  category: string;
  usedFor: string;
  filledBy: string;
  format: string;
  source: string;
  statuses: string[];
  actions: string[];
};

const formsLibrarySections = [
  "Core Trade Templates",
  "U.S. Customs / CBP Forms",
  "FDA / Food & Cosmetics",
  "USDA / Agriculture",
  "Logistics & Shipping",
  "Product Compliance",
];

const formsLibraryItems: FormLibraryItem[] = [
  {
    id: "proforma-invoice",
    section: "Core Trade Templates",
    filter: "Trade Templates",
    name: "Proforma Invoice",
    category: "Trade Templates",
    usedFor: "Initial quote and buyer import planning",
    filledBy: "Seller",
    format: "PDF / DOCX",
    source: "Trade82 template",
    statuses: ["Template", "Workflow support"],
    actions: ["Download PDF", "Download DOCX", "Preview"],
  },
  {
    id: "commercial-invoice",
    section: "Core Trade Templates",
    filter: "Trade Templates",
    name: "Commercial Invoice",
    category: "Trade Templates",
    usedFor: "Shipment value, parties, and product line details",
    filledBy: "Seller / exporter",
    format: "PDF / DOCX",
    source: "Trade82 template",
    statuses: ["Template", "Shipment document"],
    actions: ["Download PDF", "Download DOCX", "Preview"],
  },
  {
    id: "packing-list",
    section: "Core Trade Templates",
    filter: "Trade Templates",
    name: "Packing List",
    category: "Trade Templates",
    usedFor: "Carton, pallet, weight, and package details",
    filledBy: "Seller / warehouse",
    format: "PDF / DOCX",
    source: "Trade82 template",
    statuses: ["Template", "Logistics"],
    actions: ["Download PDF", "Download DOCX", "Preview"],
  },
  {
    id: "purchase-order",
    section: "Core Trade Templates",
    filter: "Trade Templates",
    name: "Purchase Order",
    category: "Trade Templates",
    usedFor: "Buyer order confirmation and requested terms",
    filledBy: "Buyer",
    format: "PDF / DOCX",
    source: "Trade82 template",
    statuses: ["Template", "Workflow support"],
    actions: ["Download PDF", "Download DOCX", "Preview"],
  },
  {
    id: "export-sales-contract",
    section: "Core Trade Templates",
    filter: "Trade Templates",
    name: "Export Sales Contract",
    category: "Trade Templates",
    usedFor: "Commercial terms, delivery terms, and order scope",
    filledBy: "Buyer and seller",
    format: "PDF / DOCX",
    source: "Trade82 template",
    statuses: ["Template", "Contract support"],
    actions: ["Download PDF", "Download DOCX", "Preview"],
  },
  {
    id: "certificate-origin-template",
    section: "Core Trade Templates",
    filter: "Trade Templates",
    name: "Certificate of Origin Template",
    category: "Trade Templates",
    usedFor: "Origin statement support for trade review",
    filledBy: "Seller / chamber where applicable",
    format: "PDF / DOCX",
    source: "Trade82 template",
    statuses: ["Template", "Origin"],
    actions: ["Download PDF", "Download DOCX", "Preview"],
  },
  {
    id: "shipper-letter-instruction",
    section: "Core Trade Templates",
    filter: "Trade Templates",
    name: "Shipper’s Letter of Instruction",
    category: "Trade Templates",
    usedFor: "Instructions to freight forwarder or logistics partner",
    filledBy: "Seller / shipper",
    format: "PDF / DOCX",
    source: "Trade82 template",
    statuses: ["Template", "Logistics"],
    actions: ["Download PDF", "Download DOCX", "Preview"],
  },
  {
    id: "document-checklist",
    section: "Core Trade Templates",
    filter: "Trade Templates",
    name: "Document Checklist",
    category: "Trade Templates",
    usedFor: "Shipment and compliance document planning",
    filledBy: "Buyer and seller",
    format: "PDF / DOCX",
    source: "Trade82 template",
    statuses: ["Template", "Workflow support"],
    actions: ["Download PDF", "Download DOCX", "Preview"],
  },
  {
    id: "cbp-3461",
    section: "U.S. Customs / CBP Forms",
    filter: "CBP",
    name: "CBP Form 3461 - Entry / Immediate Delivery",
    category: "CBP",
    usedFor: "Entry or immediate delivery process",
    filledBy: "Customs broker",
    format: "Official form",
    source: "U.S. Customs and Border Protection",
    statuses: ["Official U.S. Form", "Broker usually files"],
    actions: ["Open official form", "View details"],
  },
  {
    id: "cbp-7501",
    section: "U.S. Customs / CBP Forms",
    filter: "CBP",
    name: "CBP Form 7501 - Entry Summary",
    category: "CBP",
    usedFor: "Entry summary and duty/tax reporting",
    filledBy: "Customs broker",
    format: "Official form",
    source: "U.S. Customs and Border Protection",
    statuses: ["Official U.S. Form", "Broker usually files"],
    actions: ["Open official form", "View details"],
  },
  {
    id: "cbp-5106",
    section: "U.S. Customs / CBP Forms",
    filter: "CBP",
    name: "CBP Form 5106 - Importer Identity Form",
    category: "CBP",
    usedFor: "Importer identity setup with CBP",
    filledBy: "Importer / broker",
    format: "Official form",
    source: "U.S. Customs and Border Protection",
    statuses: ["Official U.S. Form", "Importer required"],
    actions: ["Open official form", "View details"],
  },
  {
    id: "cbp-301",
    section: "U.S. Customs / CBP Forms",
    filter: "CBP",
    name: "CBP Form 301 - Customs Bond",
    category: "CBP",
    usedFor: "Customs bond documentation",
    filledBy: "Importer / surety / broker",
    format: "Official form",
    source: "U.S. Customs and Border Protection",
    statuses: ["Official U.S. Form", "Importer required"],
    actions: ["Open official form", "View details"],
  },
  {
    id: "cbp-3311",
    section: "U.S. Customs / CBP Forms",
    filter: "CBP",
    name: "CBP Form 3311 - Declaration for Free Entry of Returned American Products",
    category: "CBP",
    usedFor: "Returned American products entry support",
    filledBy: "Importer / broker",
    format: "Official form",
    source: "U.S. Customs and Border Protection",
    statuses: ["Official U.S. Form", "Category-specific"],
    actions: ["Open official form", "View details"],
  },
  {
    id: "cbp-3299",
    section: "U.S. Customs / CBP Forms",
    filter: "CBP",
    name: "CBP Form 3299 - Declaration for Free Entry of Unaccompanied Articles",
    category: "CBP",
    usedFor: "Unaccompanied articles entry support",
    filledBy: "Importer / broker",
    format: "Official form",
    source: "U.S. Customs and Border Protection",
    statuses: ["Official U.S. Form", "Category-specific"],
    actions: ["Open official form", "View details"],
  },
  {
    id: "fda-prior-notice-guide",
    section: "FDA / Food & Cosmetics",
    filter: "FDA",
    name: "FDA Prior Notice Guide",
    category: "FDA",
    usedFor: "Food shipment prior notice planning",
    filledBy: "Importer / broker / filer",
    format: "Official guide",
    source: "U.S. Food and Drug Administration",
    statuses: ["Official source", "Food / cosmetics"],
    actions: ["Open official guide", "View details"],
  },
  {
    id: "fda-facility-registration",
    section: "FDA / Food & Cosmetics",
    filter: "FDA",
    name: "FDA Facility Registration Reference",
    category: "FDA",
    usedFor: "Facility registration planning",
    filledBy: "Facility owner / importer",
    format: "Official reference",
    source: "U.S. Food and Drug Administration",
    statuses: ["Official source", "Category-specific"],
    actions: ["Open official guide", "View details"],
  },
  {
    id: "ingredient-declaration-template",
    section: "FDA / Food & Cosmetics",
    filter: "FDA",
    name: "Ingredient Declaration Template",
    category: "FDA",
    usedFor: "Ingredient statement collection and review",
    filledBy: "Seller / manufacturer",
    format: "Checklist",
    source: "Trade82 template",
    statuses: ["Category-specific", "Food / cosmetics"],
    actions: ["Download checklist", "View details"],
  },
  {
    id: "nutrition-allergen-checklist",
    section: "FDA / Food & Cosmetics",
    filter: "FDA",
    name: "Nutrition / Allergen Checklist",
    category: "FDA",
    usedFor: "Nutrition and allergen disclosure planning",
    filledBy: "Seller / importer",
    format: "Checklist",
    source: "Trade82 template",
    statuses: ["Category-specific", "Food / cosmetics"],
    actions: ["Download checklist", "View details"],
  },
  {
    id: "cosmetic-labeling-checklist",
    section: "FDA / Food & Cosmetics",
    filter: "FDA",
    name: "Cosmetic Labeling Checklist",
    category: "FDA",
    usedFor: "Cosmetic label review preparation",
    filledBy: "Seller / brand owner",
    format: "Checklist",
    source: "Trade82 template",
    statuses: ["Category-specific", "Food / cosmetics"],
    actions: ["Download checklist", "View details"],
  },
  {
    id: "mocra-reference",
    section: "FDA / Food & Cosmetics",
    filter: "FDA",
    name: "MoCRA Reference",
    category: "FDA",
    usedFor: "Cosmetics regulatory reference planning",
    filledBy: "Brand owner / responsible person",
    format: "Official reference",
    source: "U.S. Food and Drug Administration",
    statuses: ["Official source", "Category-specific"],
    actions: ["Open official guide", "View details"],
  },
  {
    id: "aphis-import-permit",
    section: "USDA / Agriculture",
    filter: "USDA",
    name: "APHIS Import Permit Reference",
    category: "USDA",
    usedFor: "Agricultural product import permit review",
    filledBy: "Importer / broker",
    format: "Official reference",
    source: "USDA APHIS",
    statuses: ["Category-specific", "Permit may be required"],
    actions: ["Open official source", "View details"],
  },
  {
    id: "plant-product-import-guide",
    section: "USDA / Agriculture",
    filter: "USDA",
    name: "Plant Product Import Guide",
    category: "USDA",
    usedFor: "Plant product import requirement planning",
    filledBy: "Importer / broker",
    format: "Official guide",
    source: "USDA APHIS",
    statuses: ["Category-specific", "Permit may be required"],
    actions: ["Open official source", "View details"],
  },
  {
    id: "animal-product-import-guide",
    section: "USDA / Agriculture",
    filter: "USDA",
    name: "Animal Product Import Guide",
    category: "USDA",
    usedFor: "Animal product import requirement planning",
    filledBy: "Importer / broker",
    format: "Official guide",
    source: "USDA APHIS",
    statuses: ["Category-specific", "Permit may be required"],
    actions: ["Open official source", "View details"],
  },
  {
    id: "vs-16-3-reference",
    section: "USDA / Agriculture",
    filter: "USDA",
    name: "VS Form 16-3 Reference",
    category: "USDA",
    usedFor: "Animal product import permit reference",
    filledBy: "Importer / broker",
    format: "Official reference",
    source: "USDA APHIS",
    statuses: ["Category-specific", "Permit may be required"],
    actions: ["Open official source", "View details"],
  },
  {
    id: "ppq-permit-reference",
    section: "USDA / Agriculture",
    filter: "USDA",
    name: "PPQ Permit Reference",
    category: "USDA",
    usedFor: "Plant protection and quarantine permit reference",
    filledBy: "Importer / broker",
    format: "Official reference",
    source: "USDA APHIS",
    statuses: ["Category-specific", "Permit may be required"],
    actions: ["Open official source", "View details"],
  },
  {
    id: "bill-of-lading",
    section: "Logistics & Shipping",
    filter: "Logistics",
    name: "Bill of Lading Reference",
    category: "Logistics",
    usedFor: "Ocean shipment carrier document reference",
    filledBy: "Forwarder / carrier",
    format: "Reference",
    source: "Forwarder / carrier issued",
    statuses: ["Logistics", "Forwarder / carrier issued", "Reference only"],
    actions: ["View details"],
  },
  {
    id: "air-waybill",
    section: "Logistics & Shipping",
    filter: "Logistics",
    name: "Air Waybill Reference",
    category: "Logistics",
    usedFor: "Air shipment carrier document reference",
    filledBy: "Forwarder / carrier",
    format: "Reference",
    source: "Forwarder / carrier issued",
    statuses: ["Logistics", "Forwarder / carrier issued", "Reference only"],
    actions: ["View details"],
  },
  {
    id: "delivery-order",
    section: "Logistics & Shipping",
    filter: "Logistics",
    name: "Delivery Order",
    category: "Logistics",
    usedFor: "Cargo release or delivery coordination",
    filledBy: "Forwarder / carrier",
    format: "Template",
    source: "Trade82 template",
    statuses: ["Logistics", "Reference only"],
    actions: ["Download template", "View details"],
  },
  {
    id: "arrival-notice",
    section: "Logistics & Shipping",
    filter: "Logistics",
    name: "Arrival Notice",
    category: "Logistics",
    usedFor: "Shipment arrival and charges notification",
    filledBy: "Forwarder / carrier",
    format: "Reference",
    source: "Forwarder / carrier issued",
    statuses: ["Logistics", "Forwarder / carrier issued", "Reference only"],
    actions: ["View details"],
  },
  {
    id: "insurance-certificate",
    section: "Logistics & Shipping",
    filter: "Logistics",
    name: "Insurance Certificate",
    category: "Logistics",
    usedFor: "Cargo insurance documentation",
    filledBy: "Insurer / forwarder",
    format: "Reference",
    source: "Insurer / forwarder issued",
    statuses: ["Logistics", "Reference only"],
    actions: ["View details"],
  },
  {
    id: "dangerous-goods-declaration",
    section: "Logistics & Shipping",
    filter: "Logistics",
    name: "Dangerous Goods Declaration",
    category: "Logistics",
    usedFor: "Hazardous shipment declaration planning",
    filledBy: "Shipper / specialist",
    format: "Reference",
    source: "Carrier / regulator specific",
    statuses: ["Logistics", "Category-specific", "Reference only"],
    actions: ["View details"],
  },
  {
    id: "carton-marking-template",
    section: "Logistics & Shipping",
    filter: "Logistics",
    name: "Carton Marking Template",
    category: "Logistics",
    usedFor: "Carton label and warehouse marking planning",
    filledBy: "Seller / warehouse",
    format: "Template",
    source: "Trade82 template",
    statuses: ["Logistics", "Template"],
    actions: ["Download template", "View details"],
  },
  {
    id: "coa",
    section: "Product Compliance",
    filter: "Compliance",
    name: "COA",
    category: "Compliance",
    usedFor: "Certificate of analysis request and review",
    filledBy: "Manufacturer / lab",
    format: "Reference",
    source: "Manufacturer / lab issued",
    statuses: ["Product-specific", "Compliance", "Buyer may request"],
    actions: ["View details"],
  },
  {
    id: "msds-sds",
    section: "Product Compliance",
    filter: "Compliance",
    name: "MSDS / SDS",
    category: "Compliance",
    usedFor: "Safety data sheet review",
    filledBy: "Manufacturer",
    format: "Reference",
    source: "Manufacturer issued",
    statuses: ["Product-specific", "Compliance", "Buyer may request"],
    actions: ["View details"],
  },
  {
    id: "test-report",
    section: "Product Compliance",
    filter: "Compliance",
    name: "Test Report",
    category: "Compliance",
    usedFor: "Product testing evidence review",
    filledBy: "Lab / manufacturer",
    format: "Reference",
    source: "Lab / manufacturer issued",
    statuses: ["Product-specific", "Compliance", "Buyer may request"],
    actions: ["View details"],
  },
  {
    id: "fcc-declaration",
    section: "Product Compliance",
    filter: "Compliance",
    name: "FCC Declaration",
    category: "Compliance",
    usedFor: "Electronics compliance declaration planning",
    filledBy: "Manufacturer / importer",
    format: "Template",
    source: "Trade82 template",
    statuses: ["Product-specific", "Compliance"],
    actions: ["Download template", "View details"],
  },
  {
    id: "cpsc-cpsia-certificate",
    section: "Product Compliance",
    filter: "Compliance",
    name: "CPSC / CPSIA Certificate",
    category: "Compliance",
    usedFor: "Consumer product certificate planning",
    filledBy: "Importer / manufacturer",
    format: "Template",
    source: "Trade82 template",
    statuses: ["Product-specific", "Compliance"],
    actions: ["Download template", "View details"],
  },
  {
    id: "label-compliance-file",
    section: "Product Compliance",
    filter: "Compliance",
    name: "Label Compliance File",
    category: "Compliance",
    usedFor: "Label review packet organization",
    filledBy: "Seller / importer",
    format: "Template",
    source: "Trade82 template",
    statuses: ["Product-specific", "Compliance"],
    actions: ["Download template", "View details"],
  },
  {
    id: "certificate-free-sale",
    section: "Product Compliance",
    filter: "Compliance",
    name: "Certificate of Free Sale",
    category: "Compliance",
    usedFor: "Marketability or regulatory support where requested",
    filledBy: "Manufacturer / authority",
    format: "Reference",
    source: "Issuer specific",
    statuses: ["Product-specific", "Buyer may request"],
    actions: ["View details"],
  },
  {
    id: "brand-authorization-letter",
    section: "Product Compliance",
    filter: "Compliance",
    name: "Brand Authorization Letter",
    category: "Compliance",
    usedFor: "Brand authorization support",
    filledBy: "Brand owner",
    format: "Template",
    source: "Trade82 template",
    statuses: ["Product-specific", "Buyer may request"],
    actions: ["Download template", "View details"],
  },
  {
    id: "product-spec-sheet",
    section: "Product Compliance",
    filter: "Compliance",
    name: "Product Specification Sheet",
    category: "Compliance",
    usedFor: "Product attribute and technical detail summary",
    filledBy: "Seller / manufacturer",
    format: "Template",
    source: "Trade82 template",
    statuses: ["Product-specific", "Buyer may request"],
    actions: ["Download template", "View details"],
  },
];

export function DashboardClient({
  role,
  activeSection = "overview",
  onSectionChange,
}: {
  role: "buyer" | "seller";
  activeSection?: DashboardSection;
  onSectionChange?: (section: DashboardSection) => void;
}) {
  const { locale, t } = useI18n();
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    void fetch(`/api/dashboard/summary?role=${role}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((value: Summary | null) => setSummary(value));
  }, [role]);

  if (!summary) {
    return <p className="text-sm text-zinc-600">{t("common.loading")}</p>;
  }

  const recentInquiries = summary.recentInquiries ?? [];
  const recentSavedItems = summary.recentSavedItems ?? [];
  const savedProducts = recentSavedItems.filter((item) => item.type === "product");
  const followingCompanies = recentSavedItems.filter((item) => item.type === "company");
  const reviewCount = summary.metrics.reviewCount ?? 0;
  const averageRating = Number(summary.metrics.averageRating ?? 0).toFixed(1);
  const metrics: Metric[] =
    role === "seller"
      ? [
          {
            label: t("dashboard.followers"),
            value: summary.metrics.followers ?? 0,
            section: "overview",
            icon: "users",
          },
          {
            label: t("dashboard.productViews"),
            value: summary.metrics.productViews ?? 0,
            section: "products",
            icon: "productViews",
          },
          {
            label: t("dashboard.companyViews"),
            value: summary.metrics.companyViews ?? 0,
            section: "overview",
            icon: "companyViews",
          },
          {
            label: t("dashboard.receivedInquiries"),
            value: summary.metrics.receivedInquiries ?? summary.metrics.inquiryCount ?? 0,
            section: "overview",
            icon: "messages",
          },
          {
            label: t("dashboard.completedDeals"),
            value: summary.metrics.completedDeals ?? 0,
            section: "overview",
            icon: "deals",
          },
          {
            label: t("dashboard.reviewRequests"),
            value: summary.metrics.reviewRequests ?? 0,
            section: "overview",
            icon: "reviews",
          },
          {
            label: t("dashboard.publicProducts"),
            value: summary.metrics.listedProductCount ?? 0,
            section: "products",
            icon: "products",
          },
          {
            label: t("dashboard.averageRating"),
            value: `${averageRating} (${reviewCount})`,
            section: "overview",
            icon: "rating",
          },
        ]
      : [
          {
            label: t("dashboard.savedProducts"),
            value: summary.metrics.savedProducts ?? 0,
            section: "saved-products",
            icon: "products",
          },
          {
            label: t("dashboard.savedCompanies"),
            value: summary.metrics.savedCompanies ?? 0,
            section: "following",
            icon: "companyViews",
          },
          {
            label: t("dashboard.sentInquiries"),
            value: summary.metrics.sentInquiries ?? summary.metrics.inquiryCount ?? 0,
            section: "messages",
            icon: "messages",
          },
          {
            label: t("dashboard.completedDeals"),
            value: summary.metrics.completedDeals ?? 0,
            section: "overview",
            icon: "deals",
          },
          {
            label: t("dashboard.reviewRequests"),
            value: summary.metrics.reviewRequests ?? 0,
            section: "overview",
            icon: "reviews",
          },
          {
            label: t("dashboard.recentMessages"),
            value: recentInquiries.length,
            section: "messages",
            icon: "messages",
          },
        ];

  return (
    <div key={`${role}-${activeSection}`} className="bm-section-in grid gap-4">
      {activeSection === "overview" ? (
        role === "buyer" ? (
          <BuyerDiscoveryDashboard
            summary={summary}
            metrics={metrics}
            savedProducts={savedProducts}
            inquiries={recentInquiries}
            locale={locale}
            onSectionChange={onSectionChange}
          />
        ) : (
          <OverviewSection
            role={role}
            metrics={metrics}
            summary={summary}
            locale={locale}
            onSectionChange={onSectionChange}
          />
        )
      ) : null}

      {role === "buyer" && activeSection === "saved-products" ? (
        <SavedItemsPanel
          title={t("dashboard.savedProducts")}
          items={savedProducts}
          emptyText={t("dashboard.noSavedProducts")}
        />
      ) : null}

      {activeSection === "following" ? (
        role === "buyer" ? (
          <SavedItemsPanel
            title={t("dashboard.savedCompanies")}
            items={followingCompanies}
            emptyText={t("dashboard.noSavedCompanies")}
          />
        ) : (
          <StatPanel
            title={t("dashboard.followers")}
            value={summary.metrics.followers ?? 0}
            emptyText={t("dashboard.noFollowers")}
          />
        )
      ) : null}

      {activeSection === "messages" ? (
        <MessagesPanel
          title={role === "buyer" ? t("dashboard.sentInquiries") : t("dashboard.receivedInquiries")}
          inquiries={recentInquiries}
          locale={locale}
          emptyText={t("dashboard.noInquiries")}
        />
      ) : null}

      {role === "seller" && activeSection === "products" ? (
        <SellerProductsPanel
          listedCount={summary.metrics.listedProductCount ?? 0}
          productViews={summary.metrics.productViews ?? 0}
          emptyText={t("dashboard.noListedProducts")}
        />
      ) : null}

      {role === "seller" && activeSection === "documents" ? (
        <TradeFormsLibraryPanel />
      ) : null}
    </div>
  );
}

function TradeFormsLibraryPanel() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FormsLibraryFilter>("All");
  const [selectedItem, setSelectedItem] = useState<FormLibraryItem | null>(null);
  const [notice, setNotice] = useState("");

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    return formsLibraryItems.filter((item) => {
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

  const groupedItems = formsLibrarySections
    .map((section) => ({
      section,
      items: filteredItems.filter((item) => item.section === section),
    }))
    .filter((group) => group.items.length > 0);

  function handleAction(item: FormLibraryItem, action: string) {
    setSelectedItem(item);

    if (action === "View details") {
      setNotice("");
      return;
    }

    if (action === "Open official form" || action === "Open official guide" || action === "Open official source") {
      setNotice("Official source link will be available soon.");
      return;
    }

    if (action === "Preview") {
      setNotice("Template preview will be available soon.");
      return;
    }

    setNotice("Template file will be available soon.");
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
            className="inline-flex w-fit rounded-xl border p-1 theme-surface-muted"
            role="tablist"
            aria-label="Documents tabs"
          >
            <button
              type="button"
              role="tab"
              className="h-8 rounded-lg px-3 text-xs font-semibold theme-primary-button"
              aria-selected="true"
            >
              Forms Library
            </button>
            <button
              type="button"
              role="tab"
              disabled
              className="h-8 cursor-not-allowed rounded-lg px-3 text-xs font-medium opacity-55 theme-muted"
              title="Coming soon"
              aria-selected="false"
            >
              My Documents · Coming soon
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-xs leading-5 theme-muted">
          Forms and templates are provided for workflow support only. Requirements vary by product, importer, shipment, and government agency. Confirm final requirements with your customs broker, freight forwarder, or compliance advisor.
        </div>
      </div>

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
              className="h-10 w-full rounded-xl border pl-9 pr-3 text-sm outline-none theme-input focus:border-emerald-300 focus:ring-2 focus:ring-emerald-400/20"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {formsLibraryFilters.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setFilter(item)}
                className={`h-8 rounded-full border px-3 text-xs font-medium transition ${
                  filter === item
                    ? "theme-success-badge"
                    : "theme-border theme-muted hover:text-[var(--foreground)]"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        {notice ? (
          <p
            role="status"
            className="mt-3 rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-3 text-sm font-medium theme-success-text"
          >
            {notice}
          </p>
        ) : null}

        {selectedItem ? (
          <div className="mt-3 rounded-xl border p-3 theme-surface-elevated">
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
              <div className="flex flex-wrap gap-1.5">
                {selectedItem.statuses.map((status) => (
                  <span
                    key={status}
                    className="rounded-full border px-2 py-1 text-[11px] font-medium theme-border theme-muted"
                  >
                    {status}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="grid gap-4">
        {groupedItems.map((group) => (
          <section key={group.section} className="rounded-2xl border p-4 theme-surface">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold theme-foreground">
                  {group.section}
                </h3>
                <p className="mt-1 text-xs theme-muted">
                  {group.items.length} item{group.items.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>
            <div className="mt-3 hidden rounded-xl border px-3 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] theme-surface-muted theme-muted xl:grid xl:grid-cols-[1.25fr_0.75fr_1.1fr_0.85fr_0.7fr_0.9fr_1.05fr] xl:gap-3">
              <span>Form / Template</span>
              <span>Category</span>
              <span>Used for</span>
              <span>Filled by</span>
              <span>Format</span>
              <span>Source</span>
              <span>Action</span>
            </div>
            <div className="mt-2 grid gap-2">
              {group.items.map((item) => (
                <FormLibraryRow
                  key={item.id}
                  item={item}
                  onAction={handleAction}
                />
              ))}
            </div>
          </section>
        ))}
        {!groupedItems.length ? (
          <div className="rounded-2xl border border-dashed p-8 text-center theme-surface-muted">
            <p className="text-sm font-semibold theme-foreground">
              No forms found.
            </p>
            <p className="mt-2 text-sm theme-muted">
              Try a different keyword or category filter.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function FormLibraryRow({
  item,
  onAction,
}: {
  item: FormLibraryItem;
  onAction: (item: FormLibraryItem, action: string) => void;
}) {
  return (
    <article className="rounded-xl border p-3 theme-surface-elevated">
      <div className="grid gap-3 xl:grid-cols-[1.25fr_0.75fr_1.1fr_0.85fr_0.7fr_0.9fr_1.05fr] xl:items-center">
        <div className="min-w-0">
          <div className="flex min-w-0 items-start gap-2">
            <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-lg border theme-border theme-surface-muted">
              <FileText className="size-3.5 text-[var(--accent-foreground)]" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h4 className="text-sm font-semibold theme-foreground">
                {item.name}
              </h4>
              <div className="mt-1 flex flex-wrap gap-1.5 xl:hidden">
                {item.statuses.map((status) => (
                  <span
                    key={status}
                    className="rounded-full border px-2 py-0.5 text-[11px] font-medium theme-border theme-muted"
                  >
                    {status}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
        <LibraryCell label="Category" value={item.category} />
        <LibraryCell label="Used for" value={item.usedFor} />
        <LibraryCell label="Filled by" value={item.filledBy} />
        <LibraryCell label="Format" value={item.format} />
        <LibraryCell label="Source" value={item.source} />
        <div className="flex flex-wrap gap-2">
          {item.actions.map((action) => (
            <button
              key={action}
              type="button"
              onClick={() => onAction(item, action)}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition theme-secondary-button hover:-translate-y-0.5"
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
      </div>
      <div className="mt-2 hidden flex-wrap gap-1.5 xl:flex">
        {item.statuses.map((status) => (
          <span
            key={status}
            className="rounded-full border px-2 py-0.5 text-[11px] font-medium theme-border theme-muted"
          >
            {status}
          </span>
        ))}
      </div>
    </article>
  );
}

function LibraryCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] theme-muted xl:hidden">
        {label}
      </p>
      <p className="mt-1 break-words text-xs leading-5 theme-muted xl:mt-0">
        {value}
      </p>
    </div>
  );
}

function BuyerDiscoveryDashboard({
  summary,
  metrics,
  savedProducts,
  inquiries,
  locale,
  onSectionChange,
}: {
  summary: Summary;
  metrics: Metric[];
  savedProducts: NonNullable<Summary["recentSavedItems"]>;
  inquiries: NonNullable<Summary["recentInquiries"]>;
  locale: "en" | "ko";
  onSectionChange?: (section: DashboardSection) => void;
}) {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [keyword, setKeyword] = useState("all");
  const profile = summary.buyerProfile;
  const recommendedProducts = useMemo(
    () => summary.recommendedProducts ?? [],
    [summary.recommendedProducts],
  );
  const categories = profile?.categories?.length
    ? profile.categories
    : summary.suggestedCategories ?? [];
  const keywords = profile?.keywords ?? [];
  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return recommendedProducts.filter((product) => {
      const selectedCategoryLabel = buyerCategoryLabel(category, "en").toLowerCase();
      const productCategory = product.category.toLowerCase();
      const matchesCategory =
        category === "all" ||
        productCategory === category.toLowerCase() ||
        productCategory === selectedCategoryLabel ||
        productCategory.includes(selectedCategoryLabel);
      const text = [
        product.name,
        product.category,
        product.sellerName,
        product.moq,
        ...product.tags,
      ]
        .join(" ")
        .toLowerCase();
      const matchesKeyword = keyword === "all" || text.includes(keyword.toLowerCase());
      const matchesSearch = !query || text.includes(query);
      return matchesCategory && matchesKeyword && matchesSearch;
    });
  }, [category, keyword, recommendedProducts, search]);

  return (
    <div className="grid gap-4 theme-foreground">
      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border p-5 theme-surface-elevated">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] theme-success-text">
                {t("dashboard.buyerWorkspace")}
              </p>
              <h2 className="mt-3 text-xl font-semibold theme-foreground">
                {t("dashboard.buyerWelcome", "Welcome")}
                {profile?.displayName ? `, ${profile.displayName}` : ""}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 theme-muted">
                {profile?.companyName
                  ? t("dashboard.buyerCompanyIntro").replace("{company}", profile.companyName)
                  : t("dashboard.buyerCompanyIntroEmpty")}
              </p>
            </div>
            <div className="rounded-2xl border px-4 py-3 text-right theme-success-badge">
              <p className="text-xs font-medium">
                {t("dashboard.profileCompletion")}
              </p>
              <p className="mt-1 text-xl font-semibold theme-foreground">
                {profile?.profileCompletion ?? 0}%
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {categories.slice(0, 6).map((item) => (
              <span
                key={item}
                className="rounded-full border px-3 py-1 text-xs font-medium theme-surface-muted theme-muted"
              >
                {buyerCategoryLabel(item, locale)}
              </span>
            ))}
            {keywords.slice(0, 6).map((item) => (
              <span
                key={item}
                className="rounded-full border px-3 py-1 text-xs font-medium theme-success-badge"
              >
                #{item}
              </span>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href={withLocale("/marketplace", locale)}
              className="inline-flex h-9 items-center rounded-xl px-3 text-sm font-semibold transition theme-primary-button"
            >
              {t("dashboard.browseProducts")}
            </Link>
            <button
              type="button"
              onClick={() => onSectionChange?.("messages")}
              className="inline-flex h-9 items-center rounded-xl border px-3 text-sm font-medium transition theme-secondary-button"
            >
              {t("dashboard.sendInquiry")}
            </button>
            <Link
              href={withLocale("/settings/company", locale)}
              className="inline-flex h-9 items-center rounded-xl border px-3 text-sm font-medium transition theme-secondary-button"
            >
              {t("dashboard.updateProductInterests")}
            </Link>
          </div>
        </div>

        <div className="grid gap-3 rounded-2xl border p-4 theme-surface">
          <h3 className="text-base font-semibold theme-foreground">
            {t("dashboard.buyerSnapshot")}
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {metrics.slice(0, 4).map((metric) => (
              <button
                key={metric.label}
                type="button"
                onClick={() => onSectionChange?.(metric.section)}
                className="rounded-xl border p-3 text-left transition theme-surface-muted theme-card-hover"
              >
                <span className="flex min-w-0 items-center gap-2 text-xs theme-muted">
                  <MetricIcon icon={metric.icon} />
                  <span className="truncate">{metric.label}</span>
                </span>
                <span className="mt-1 block text-lg font-semibold theme-foreground">
                  {metric.value}
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border p-4 theme-surface">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-base font-semibold theme-foreground">
              {t("dashboard.productDiscovery")}
            </h3>
            <p className="mt-1 text-sm theme-muted">
              {t("dashboard.productDiscoveryHelp")}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("dashboard.searchKoreanProducts")}
              className="h-10 min-w-0 rounded-xl border px-3 text-sm outline-none theme-input focus:border-emerald-300 focus:ring-2 focus:ring-emerald-400/20 sm:w-64"
            />
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="h-10 rounded-xl border px-3 text-sm outline-none theme-input focus:border-emerald-300 focus:ring-2 focus:ring-emerald-400/20"
            >
              <option value="all">{t("dashboard.allCategories")}</option>
              {categories.map((item) => (
                <option key={item} value={item}>
                  {buyerCategoryLabel(item, locale)}
                </option>
              ))}
            </select>
          </div>
        </div>
        {keywords.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setKeyword("all")}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                keyword === "all"
                  ? "theme-success-badge"
                  : "theme-border theme-muted hover:text-[var(--foreground)]"
              }`}
            >
              {t("dashboard.allKeywords")}
            </button>
            {keywords.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setKeyword(item)}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  keyword === item
                    ? "theme-success-badge"
                    : "theme-border theme-muted hover:text-[var(--foreground)]"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        ) : null}
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredProducts.map((product) => {
            const displayImageUrl = safeImageUrl(product.imageUrl, "");

            return (
              <Link
                key={product.id}
                href={withLocale(product.href, locale)}
                className="group overflow-hidden rounded-2xl border transition hover:-translate-y-0.5 theme-surface-elevated theme-card-hover"
              >
                <div className="aspect-[4/3] bg-zinc-900">
                  {displayImageUrl ? (
                    <Image
                      src={displayImageUrl}
                      alt=""
                      width={480}
                      height={360}
                      className="size-full object-cover transition duration-300 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center text-sm text-zinc-600">
                      {t("dashboard.noProductImage")}
                    </div>
                  )}
                </div>
                <div className="grid gap-2 p-3">
                  <div>
                    <p className="line-clamp-1 text-sm font-semibold theme-foreground">
                      {product.name}
                    </p>
                    <p className="mt-1 line-clamp-1 text-xs theme-muted">
                      {product.sellerName}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-xs">
                    <span className="rounded-full border px-2 py-0.5 theme-border theme-muted">
                      {product.category}
                    </span>
                    <span className="rounded-full border px-2 py-0.5 theme-border theme-muted">
                      {formatBuyerProductPrice(product, t("dashboard.priceOnRequest"))}
                    </span>
                    {product.moq ? (
                      <span className="rounded-full border px-2 py-0.5 theme-border theme-muted">
                        {product.moq}
                      </span>
                    ) : null}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
        {!filteredProducts.length ? (
          <div className="mt-4 rounded-2xl border border-dashed p-6 text-center theme-surface-muted">
            <p className="text-sm font-semibold theme-foreground">
              {t("dashboard.noRecommendedProducts")}
            </p>
            <p className="mt-2 text-sm theme-muted">
              {t("dashboard.startExploringKoreanProducts")}
            </p>
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <DarkListPanel
          title={t("dashboard.savedProducts")}
          actionLabel={t("dashboard.browseProducts")}
          href={withLocale("/marketplace", locale)}
          emptyTitle={t("dashboard.noSavedProductsTitle")}
          emptyText={t("dashboard.startExploringKoreanProducts")}
        >
          {savedProducts.map((item) =>
            item.href ? (
              <Link
                key={item.id}
                href={withLocale(item.href, locale)}
                className="rounded-xl border p-3 text-sm font-medium theme-surface-muted theme-card-hover"
              >
                {item.displayName}
              </Link>
            ) : null,
          )}
        </DarkListPanel>
        <DarkListPanel
          title={t("dashboard.inquiryManagement")}
          actionLabel={t("dashboard.viewMessages")}
          href={withLocale("/messages", locale)}
          emptyTitle={t("dashboard.noInquiriesTitle")}
          emptyText={t("dashboard.startByExploringProducts")}
        >
          {inquiries.map((item, index) => (
            <Link
              key={item.id}
              href={withLocale("/messages", locale)}
              className="rounded-xl border p-3 theme-surface-muted theme-card-hover"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium theme-foreground">
                    {item.productName || item.companyName}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 theme-muted">
                    {item.message}
                  </p>
                </div>
                <span className="shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium theme-border theme-muted">
                  {index === 0
                    ? t("dashboard.sellerReplied")
                    : t("dashboard.waitingForResponse")}
                </span>
              </div>
            </Link>
          ))}
        </DarkListPanel>
      </section>

      <section className="rounded-2xl border p-4 theme-surface">
        <h3 className="text-base font-semibold theme-foreground">
          {t("dashboard.suggestedCategories")}
        </h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {(summary.suggestedCategories ?? categories).map((item) => (
            <Link
              key={item}
              href={withLocale(`/marketplace?category=${encodeURIComponent(item)}`, locale)}
              className="rounded-full border px-3 py-1 text-xs font-medium transition theme-surface-muted theme-muted hover:text-[var(--foreground)]"
            >
              {buyerCategoryLabel(item, locale)}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function DarkListPanel({
  title,
  actionLabel,
  href,
  emptyTitle,
  emptyText,
  children,
}: {
  title: string;
  actionLabel: string;
  href: string;
  emptyTitle: string;
  emptyText: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border p-4 theme-surface">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold theme-foreground">{title}</h3>
        <Link
          href={href}
          className="text-xs font-semibold theme-success-text hover:underline"
        >
          {actionLabel}
        </Link>
      </div>
      <div className="mt-3 grid gap-2">
        {children}
        {Array.isArray(children) && children.filter(Boolean).length ? null : (
          <div className="rounded-2xl border border-dashed p-5 theme-surface-muted">
            <p className="text-sm font-semibold theme-foreground">{emptyTitle}</p>
            <p className="mt-1 text-sm leading-6 theme-muted">{emptyText}</p>
          </div>
        )}
      </div>
    </section>
  );
}

function formatBuyerProductPrice(
  product: NonNullable<Summary["recommendedProducts"]>[number],
  fallback: string,
) {
  if (!product.priceMin && !product.priceMax) return fallback;
  if (product.priceMin && product.priceMax && product.priceMin !== product.priceMax) {
    return `${product.currency} ${product.priceMin} - ${product.priceMax}`;
  }
  return `${product.currency} ${product.priceMin ?? product.priceMax}`;
}

function OverviewSection({
  role,
  metrics,
  summary,
  locale,
  onSectionChange,
}: {
  role: "buyer" | "seller";
  metrics: Metric[];
  summary: Summary;
  locale: "en" | "ko";
  onSectionChange?: (section: DashboardSection) => void;
}) {
  const { t } = useI18n();
  const recentInquiries = summary.recentInquiries ?? [];
  const recentSavedItems = summary.recentSavedItems ?? [];

  return (
    <>
      <MetricGrid metrics={metrics} onSectionChange={onSectionChange} />

      <section className="grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
        <MessagesPanel
          title={t("dashboard.recentMessages")}
          inquiries={recentInquiries}
          locale={locale}
          emptyText={t("dashboard.noInquiries")}
        />

        {role === "seller" ? (
          <ReviewsPanel reviews={summary.recentReviews} />
        ) : (
          <SavedItemsPanel
            title={t("dashboard.recentSavedItems")}
            items={recentSavedItems}
            emptyText={t("dashboard.noRecentSavedItems")}
          />
        )}
      </section>

      {role === "buyer" ? (
        <section className="bm-premium-card rounded-md border p-4 theme-surface">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
                {t("dashboard.recentActivity")}
              </p>
              <h2 className="mt-2 text-lg font-semibold theme-foreground">
                {t("dashboard.recommendedSellers")}
              </h2>
              {(summary.metrics.savedCompanies ?? 0) === 0 ? (
                <p className="mt-1 break-words text-sm leading-6 theme-muted">
                  {t("dashboard.noSavedCompanies")}
                </p>
              ) : null}
            </div>
            <Link
              href={withLocale("/sellers", locale)}
              className="inline-flex h-8 items-center justify-center rounded-md px-2.5 text-xs font-medium theme-primary-button"
            >
              {t("dashboard.exploreKoreanSellers")}
            </Link>
          </div>
        </section>
      ) : null}
    </>
  );
}

function MetricGrid({
  metrics,
  onSectionChange,
}: {
  metrics: Metric[];
  onSectionChange?: (section: DashboardSection) => void;
}) {
  const { t } = useI18n();

  return (
    <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <button
          key={metric.label}
          type="button"
          onClick={() => onSectionChange?.(metric.section)}
          className="bm-premium-card min-w-0 rounded-md border p-3 text-left transition theme-surface theme-card-hover"
        >
          <span className="flex min-w-0 items-center gap-2 text-xs font-medium uppercase tracking-wide theme-muted">
            <MetricIcon icon={metric.icon} />
            <span className="truncate">{metric.label}</span>
          </span>
          <span className="mt-2 block truncate text-xl font-semibold theme-foreground">
            {metric.value}
          </span>
          <span className="mt-2 block text-xs font-medium text-blue-700">
            {t("dashboard.sectionView")}
          </span>
        </button>
      ))}
    </section>
  );
}

function MetricIcon({ icon }: { icon: MetricIconKey }) {
  const Icon = metricIcons[icon];

  return (
    <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border theme-border theme-surface-muted">
      <Icon className="size-4 text-[var(--accent-foreground)]" aria-hidden="true" />
    </span>
  );
}

function MessagesPanel({
  title,
  inquiries,
  locale,
  emptyText,
}: {
  title: string;
  inquiries: NonNullable<Summary["recentInquiries"]>;
  locale: "en" | "ko";
  emptyText: string;
}) {
  const { t } = useI18n();

  return (
    <section className="bm-premium-card min-w-0 rounded-md border p-4 theme-surface">
      <div className="flex items-center justify-between gap-3">
        <h2 className="truncate text-base font-semibold theme-foreground">{title}</h2>
        <Link
          href={withLocale("/messages", locale)}
          className="shrink-0 text-sm font-medium text-blue-700"
        >
          {t("dashboard.viewMessages")}
        </Link>
      </div>
      <div className="mt-3 grid gap-2">
        {inquiries.map((item) => (
          <Link
            key={item.id}
            href={withLocale("/messages", locale)}
            className="min-w-0 rounded-md border p-3 transition theme-surface-muted theme-card-hover"
          >
            <p className="truncate font-medium theme-foreground">
              {item.productName || item.companyName}
            </p>
            <p className="mt-1 line-clamp-2 break-words text-sm theme-muted">
              {item.message}
            </p>
          </Link>
        ))}
        {!inquiries.length ? <Empty text={emptyText} /> : null}
      </div>
    </section>
  );
}

function SavedItemsPanel({
  title,
  items,
  emptyText,
}: {
  title: string;
  items: NonNullable<Summary["recentSavedItems"]>;
  emptyText: string;
}) {
  const { locale, t } = useI18n();

  return (
    <section className="bm-premium-card min-w-0 rounded-md border p-4 theme-surface">
      <h2 className="truncate text-base font-semibold theme-foreground">{title}</h2>
      <div className="mt-3 grid gap-2">
        {items.map((item) => {
          const label =
            item.displayName ||
            (item.type === "company"
              ? t("common.followingCompany")
              : t("common.saved"));

          return item.href ? (
            <Link
              key={item.id}
              href={withLocale(item.href, locale)}
              className="min-w-0 rounded-md border p-3 text-sm font-medium transition theme-surface-muted theme-card-hover"
            >
              <span className="block truncate">{label}</span>
            </Link>
          ) : (
            <div
              key={item.id}
              className="min-w-0 rounded-md border p-3 text-sm font-medium theme-surface-muted"
            >
              <span className="block truncate">{label}</span>
            </div>
          );
        })}
        {!items.length ? <Empty text={emptyText} /> : null}
      </div>
    </section>
  );
}

function ReviewsPanel({
  reviews,
}: {
  reviews: Summary["recentReviews"];
}) {
  const { t } = useI18n();

  return (
    <section className="bm-premium-card min-w-0 rounded-md border p-4 theme-surface">
      <h2 className="truncate text-base font-semibold theme-foreground">
        {t("dashboard.recentReviews")}
      </h2>
      <div className="mt-3 grid gap-2">
        {reviews.map((review) => (
          <article
            key={review.id}
            className="min-w-0 rounded-md border p-3 theme-surface-muted"
          >
            <p className="text-sm font-medium text-amber-700">{review.rating}/5</p>
            <p className="mt-1 line-clamp-3 break-words text-sm theme-muted">
              {review.text}
            </p>
          </article>
        ))}
        {!reviews.length ? <Empty text={t("dashboard.noReviews")} /> : null}
      </div>
    </section>
  );
}

function SellerProductsPanel({
  listedCount,
  productViews,
  emptyText,
}: {
  listedCount: number;
  productViews: number;
  emptyText: string;
}) {
  const { locale, t } = useI18n();
  const [products, setProducts] = useState<DbProduct[] | null>(null);
  const [editing, setEditing] = useState<EditableProduct | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const fetchProducts = useCallback(async () => {
    const response = await fetch("/api/account/products", { cache: "no-store" });
    if (!response.ok) {
      return {
        products: [] as DbProduct[],
        error:
          response.status === 403
          ? t("settings.sellerProductsOnly")
          : t("dashboard.productsLoadFailed"),
      };
    }

    return {
      products: (await response.json()) as DbProduct[],
      error: "",
    };
  }, [t]);

  async function refreshProducts() {
    const result = await fetchProducts();
    setProducts(result.products);
    setError(result.error);
  }

  useEffect(() => {
    let active = true;

    void fetchProducts().then((result) => {
      if (!active) return;
      setProducts(result.products);
      setError(result.error);
    });

    return () => {
      active = false;
    };
  }, [fetchProducts]);

  async function setPreparing(product: DbProduct) {
    setPendingId(product.id);
    setNotice("");
    setError("");
    try {
      const response = await fetch(`/api/account/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "inactive" }),
      });
      const result = (await response.json().catch(() => null)) as
        | DbProduct
        | { error?: string }
        | null;

      if (!response.ok) {
        const errorMessage =
          result && "error" in result && typeof result.error === "string"
            ? result.error
            : t("dashboard.productUpdateFailed");
        setError(
          errorMessage,
        );
        return;
      }

      if (result && "id" in result) {
        setProducts((current) =>
          (current ?? []).map((item) => (item.id === product.id ? result : item)),
        );
      }
      setNotice(t("dashboard.productSetPreparing"));
      await refreshProducts();
    } catch {
      setError(t("dashboard.productUpdateFailed"));
    } finally {
      setPendingId(null);
    }
  }

  async function publishProduct(product: DbProduct) {
    setPendingId(product.id);
    setNotice("");
    setError("");
    try {
      const response = await fetch(`/api/account/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "active" }),
      });
      const result = (await response.json().catch(() => null)) as
        | DbProduct
        | { error?: string }
        | null;

      if (!response.ok) {
        const errorMessage =
          result && "error" in result && typeof result.error === "string"
            ? result.error
            : t("dashboard.productUpdateFailed");
        setError(errorMessage);
        return;
      }

      if (result && "id" in result) {
        setProducts((current) =>
          (current ?? []).map((item) => (item.id === product.id ? result : item)),
        );
      }
      setNotice(t("listing.productPublished"));
      await refreshProducts();
    } catch {
      setError(t("dashboard.productUpdateFailed"));
    } finally {
      setPendingId(null);
    }
  }

  async function deleteProduct(product: DbProduct) {
    if (!window.confirm(t("dashboard.deleteProductConfirm"))) return;

    setPendingId(product.id);
    setNotice("");
    setError("");
    try {
      const response = await fetch(`/api/account/products/${product.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        setError(result?.error ?? t("dashboard.productDeleteFailed"));
        return;
      }

      setProducts((current) =>
        (current ?? []).filter((item) => item.id !== product.id),
      );
      if (editing?.id === product.id) setEditing(null);
      setNotice(t("dashboard.productDeleted"));
      await refreshProducts();
    } catch {
      setError(t("dashboard.productDeleteFailed"));
    } finally {
      setPendingId(null);
    }
  }

  const productList = products ?? [];

  return (
    <section className="bm-premium-card min-w-0 rounded-md border p-4 theme-surface">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold theme-foreground">
            {t("dashboard.productManagement")}
          </h2>
          <p className="mt-1 text-sm leading-5 theme-muted">
            {t("dashboard.productManagementHelp")}
          </p>
        </div>
        <Link
          href={withLocale("/sell", locale)}
          className="inline-flex h-8 shrink-0 items-center justify-center rounded-md px-2.5 text-xs font-medium theme-primary-button"
        >
          {t("settings.addProduct")}
        </Link>
      </div>
      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="min-w-0 rounded-md border p-3 theme-surface-muted">
          <dt className="truncate text-xs font-medium uppercase tracking-wide theme-muted">
            {t("dashboard.publicProducts")}
          </dt>
          <dd className="mt-1 text-xl font-semibold theme-foreground">
            {listedCount}
          </dd>
        </div>
        <div className="min-w-0 rounded-md border p-3 theme-surface-muted">
          <dt className="truncate text-xs font-medium uppercase tracking-wide theme-muted">
            {t("dashboard.productViews")}
          </dt>
          <dd className="mt-1 text-xl font-semibold theme-foreground">
            {productViews}
          </dd>
        </div>
      </dl>

      {notice ? (
        <p
          role="status"
          className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-2.5 text-sm font-medium text-emerald-700"
        >
          {notice}
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="mt-3 rounded-md border border-red-200 bg-red-50 p-2.5 text-sm font-medium text-red-700"
        >
          {error}
        </p>
      ) : null}

      {editing ? (
        <div className="mt-4">
          <ProductEditor
            initialProduct={editing}
            onCancel={() => setEditing(null)}
            onSaved={async () => {
              setEditing(null);
              setNotice(t("dashboard.productUpdated"));
              await refreshProducts();
            }}
          />
        </div>
      ) : null}

      <div className="mt-4 grid gap-2">
        {products === null ? (
          <div className="md:col-span-2 xl:col-span-3">
            <Empty text={t("common.loading")} />
          </div>
        ) : productList.length ? (
          productList.map((product) => (
            <SellerProductCard
              key={product.id}
              product={product}
              pending={pendingId === product.id}
              onEdit={() => setEditing({ ...product })}
              onSetPreparing={() => void setPreparing(product)}
              onPublish={() => void publishProduct(product)}
              onDelete={() => void deleteProduct(product)}
            />
          ))
        ) : (
          <div className="md:col-span-2 xl:col-span-3">
            <Empty text={emptyText} />
          </div>
        )}
      </div>
    </section>
  );
}

function SellerProductCard({
  product,
  pending,
  onEdit,
  onSetPreparing,
  onPublish,
  onDelete,
}: {
  product: DbProduct;
  pending: boolean;
  onEdit: () => void;
  onSetPreparing: () => void;
  onPublish: () => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  const imageUrl = safeImageUrl(product.images[0]?.cardUrl || product.imageUrl, "");
  const status = productStatusMeta(product, t);
  const price = formatDashboardProductPrice(product, t("dashboard.priceOnRequest"));

  return (
    <article className="grid min-w-0 gap-3 rounded-md border p-3 theme-surface-muted sm:grid-cols-[72px_minmax(0,1fr)] xl:grid-cols-[72px_minmax(0,1fr)_auto] xl:items-center">
      <div className="relative aspect-square overflow-hidden rounded-md bg-zinc-100 sm:size-[72px]">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={product.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm font-semibold theme-muted">
            {product.name.charAt(0)}
          </div>
        )}
      </div>

      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
          <h3 className="min-w-0 flex-1 break-words text-sm font-semibold theme-foreground">
            {product.name}
          </h3>
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>
        <p className="mt-0.5 truncate text-xs theme-muted">{product.category}</p>

        <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <div className="flex min-w-0 gap-1.5">
            <dt className="theme-muted">{t("dashboard.price")}</dt>
            <dd className="truncate font-medium text-zinc-900">{price}</dd>
          </div>
          <div className="flex min-w-0 gap-1.5">
            <dt className="theme-muted">{t("marketplace.moq")}</dt>
            <dd className="truncate font-medium text-zinc-900">
              {product.moq || t("productDetail.notProvided")}
            </dd>
          </div>
          <div className="flex min-w-0 gap-1.5">
            <dt className="theme-muted">{t("dashboard.productViews")}</dt>
            <dd className="font-medium text-zinc-900">{Number(product.viewCount ?? 0)}</dd>
          </div>
        </dl>
      </div>

      <div className="flex flex-wrap gap-1.5 sm:col-start-2 xl:col-start-auto xl:justify-end">
        <button
          type="button"
          onClick={onEdit}
          className="h-8 rounded-md px-2.5 text-xs font-medium theme-primary-button"
        >
          {t("settings.editProduct")}
        </button>
        {product.status === "active" ? (
          <button
            type="button"
            disabled={pending}
            onClick={onSetPreparing}
            className="h-8 rounded-md border border-amber-200 px-2.5 text-xs font-medium text-amber-800 disabled:cursor-wait disabled:opacity-60"
          >
            {pending ? t("settings.saving") : t("dashboard.setPreparing")}
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={onPublish}
            className="h-8 rounded-md border border-blue-200 px-2.5 text-xs font-medium text-blue-700 disabled:cursor-wait disabled:opacity-60"
          >
            {pending ? t("settings.saving") : t("listing.publishProduct")}
          </button>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={onDelete}
          className="h-8 rounded-md border border-red-200 px-2.5 text-xs font-medium text-red-700 disabled:cursor-wait disabled:opacity-60"
        >
          {pending ? t("settings.saving") : t("settings.deleteProduct")}
        </button>
      </div>
    </article>
  );
}

function productStatusMeta(
  product: DbProduct,
  t: ReturnType<typeof useI18n>["t"],
) {
  if (product.status === "active" && product.sellerCompany.verificationStatus === "verified") {
    return { label: t("dashboard.statusPublic"), tone: "green" as const };
  }
  if (product.status === "active") {
    return { label: t("dashboard.statusActive"), tone: "blue" as const };
  }
  if (product.status === "draft") {
    return { label: t("dashboard.statusDraft"), tone: "amber" as const };
  }
  return { label: t("dashboard.statusPreparing"), tone: "gray" as const };
}

function formatDashboardProductPrice(
  product: Pick<DbProduct, "priceMin" | "priceMax" | "currency">,
  fallback: string,
) {
  if (!product.priceMin && !product.priceMax) return fallback;
  if (product.priceMin === product.priceMax || !product.priceMax) {
    return `${product.currency} ${product.priceMin}`;
  }
  return `${product.currency} ${product.priceMin}-${product.priceMax}`;
}

function StatPanel({
  title,
  value,
  emptyText,
}: {
  title: string;
  value: number;
  emptyText: string;
}) {
  return (
    <section className="bm-premium-card min-w-0 rounded-md border p-4 theme-surface">
      <h2 className="truncate text-base font-semibold theme-foreground">{title}</h2>
      <p className="mt-2 text-xl font-semibold theme-foreground">{value}</p>
      {value === 0 ? <div className="mt-3"><Empty text={emptyText} /></div> : null}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed border-zinc-300 p-4 text-sm text-zinc-600">
      {text}
    </div>
  );
}
