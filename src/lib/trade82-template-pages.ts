export const TRADE82_TEMPLATE_DISCLAIMER =
  "Template provided for workflow support only. Requirements vary by product, importer, shipment, and government agency. Confirm final requirements with your customs broker, freight forwarder, or compliance advisor.";

export type TemplateTable = {
  title: string;
  columns: string[];
  rows: number;
};

export type TemplateSection = {
  title: string;
  fields: string[];
};

export type Trade82TemplatePage = {
  slug: string;
  title: string;
  eyebrow: string;
  description: string;
  documentFields: string[];
  parties: TemplateSection[];
  sections: TemplateSection[];
  tables: TemplateTable[];
  notesLabel?: string;
  declaration?: string;
  signatureLabels: string[];
};

export const trade82TemplatePages: Trade82TemplatePage[] = [
  {
    slug: "proforma-invoice",
    title: "Proforma Invoice",
    eyebrow: "Trade82 workflow template",
    description: "Use this template to outline quoted terms before a buyer places a confirmed order.",
    documentFields: ["Proforma invoice number", "Date", "Valid until", "Currency"],
    parties: [
      { title: "Seller / exporter", fields: ["Company name", "Contact name", "Address", "Email / phone"] },
      { title: "Buyer / importer", fields: ["Company name", "Contact name", "Address", "Email / phone"] },
    ],
    sections: [
      {
        title: "Trade terms",
        fields: ["MOQ", "Lead time", "Incoterms", "Payment terms", "Shipping origin", "Destination"],
      },
    ],
    tables: [
      {
        title: "Product and pricing",
        columns: ["Product description", "HS code", "Quantity", "Unit price", "Total amount"],
        rows: 6,
      },
    ],
    notesLabel: "Notes",
    signatureLabels: ["Authorized signature"],
  },
  {
    slug: "commercial-invoice",
    title: "Commercial Invoice",
    eyebrow: "Trade82 workflow template",
    description: "Use this template to organize shipment value, parties, and product line details.",
    documentFields: ["Invoice number", "Date", "Country of origin", "Destination country", "Currency"],
    parties: [
      { title: "Seller / exporter", fields: ["Company name", "Contact name", "Address", "Email / phone"] },
      { title: "Buyer / importer", fields: ["Company name", "Contact name", "Address", "Email / phone"] },
    ],
    sections: [
      {
        title: "Shipment terms",
        fields: ["Incoterms", "Shipment terms"],
      },
    ],
    tables: [
      {
        title: "Invoice line items",
        columns: ["Product description", "HS code", "Quantity", "Unit value", "Total value"],
        rows: 7,
      },
    ],
    notesLabel: "Additional shipment notes",
    signatureLabels: ["Authorized signature"],
  },
  {
    slug: "packing-list",
    title: "Packing List",
    eyebrow: "Trade82 workflow template",
    description: "Use this template to organize carton, weight, package, and shipping mark details.",
    documentFields: ["Packing list number", "Date"],
    parties: [
      { title: "Seller / exporter", fields: ["Company name", "Contact name", "Address", "Email / phone"] },
      { title: "Buyer / importer", fields: ["Company name", "Contact name", "Address", "Email / phone"] },
    ],
    sections: [
      {
        title: "Shipment totals",
        fields: ["Carton count", "Total CBM", "Shipping marks"],
      },
    ],
    tables: [
      {
        title: "Packing details",
        columns: ["Product name", "Units per carton", "Net weight", "Gross weight", "Carton dimensions"],
        rows: 8,
      },
    ],
    notesLabel: "Notes",
    signatureLabels: [],
  },
  {
    slug: "purchase-order",
    title: "Purchase Order",
    eyebrow: "Trade82 workflow template",
    description: "Use this template for buyer order confirmation and requested commercial terms.",
    documentFields: ["PO number", "Date", "Delivery date", "Currency"],
    parties: [
      { title: "Buyer", fields: ["Company name", "Contact name", "Address", "Email / phone"] },
      { title: "Seller", fields: ["Company name", "Contact name", "Address", "Email / phone"] },
    ],
    sections: [
      {
        title: "Order terms",
        fields: ["Shipping terms", "Payment terms"],
      },
    ],
    tables: [
      {
        title: "Purchase order items",
        columns: ["Product", "Quantity", "Unit price", "Total amount"],
        rows: 7,
      },
    ],
    notesLabel: "Buyer notes",
    signatureLabels: ["Authorized signature"],
  },
  {
    slug: "export-sales-contract",
    title: "Export Sales Contract",
    eyebrow: "Trade82 workflow template",
    description: "Use this template to organize commercial terms for review by both parties.",
    documentFields: ["Contract number", "Date", "Currency"],
    parties: [
      { title: "Seller", fields: ["Company name", "Contact name", "Address", "Email / phone"] },
      { title: "Buyer", fields: ["Company name", "Contact name", "Address", "Email / phone"] },
    ],
    sections: [
      {
        title: "Commercial terms",
        fields: ["Product", "Quantity", "Price", "Incoterms", "Payment terms", "Delivery terms"],
      },
      {
        title: "Review terms",
        fields: ["Inspection", "Required compliance documents", "Dispute resolution placeholder"],
      },
    ],
    tables: [],
    notesLabel: "Additional terms",
    signatureLabels: ["Seller signature", "Buyer signature"],
  },
  {
    slug: "certificate-of-origin-template",
    title: "Certificate of Origin Template",
    eyebrow: "Trade82 workflow template",
    description: "Use this worksheet to collect origin information before confirming final requirements.",
    documentFields: ["Invoice number", "Date", "Country of origin"],
    parties: [
      { title: "Exporter", fields: ["Company name", "Contact name", "Address", "Email / phone"] },
      { title: "Consignee", fields: ["Company name", "Contact name", "Address", "Email / phone"] },
    ],
    sections: [
      {
        title: "Origin details",
        fields: ["Product description", "HS code", "Quantity"],
      },
    ],
    tables: [],
    declaration:
      "Origin declaration / statement: The exporter should complete this section only after confirming the required wording and supporting records for the shipment.",
    notesLabel: "Supporting notes",
    signatureLabels: ["Authorized signature"],
  },
  {
    slug: "shippers-letter-of-instruction",
    title: "Shipper's Letter of Instruction",
    eyebrow: "Trade82 workflow template",
    description: "Use this template to organize instructions for a freight forwarder or logistics partner.",
    documentFields: ["Reference number", "Date"],
    parties: [
      { title: "Exporter", fields: ["Company name", "Contact name", "Address", "Email / phone"] },
      { title: "Forwarder", fields: ["Company name", "Contact name", "Address", "Email / phone"] },
      { title: "Consignee", fields: ["Company name", "Contact name", "Address", "Email / phone"] },
      { title: "Notify party", fields: ["Company name", "Contact name", "Address", "Email / phone"] },
    ],
    sections: [
      {
        title: "Routing instructions",
        fields: ["Shipment method", "Port of loading", "Port of discharge", "Incoterms"],
      },
      {
        title: "Product details",
        fields: ["Product details", "Special instructions"],
      },
    ],
    tables: [],
    notesLabel: "Special instructions",
    signatureLabels: ["Authorized signature"],
  },
  {
    slug: "document-checklist",
    title: "Document Checklist",
    eyebrow: "Trade82 workflow template",
    description: "Use this checklist to plan company, product, shipping, customs, and compliance documents.",
    documentFields: ["Checklist number", "Date", "Shipment / inquiry reference"],
    parties: [
      { title: "Seller / exporter", fields: ["Company name", "Contact name"] },
      { title: "Buyer / importer", fields: ["Company name", "Contact name"] },
    ],
    sections: [],
    tables: [
      {
        title: "Company documents",
        columns: ["Document", "Status", "Notes"],
        rows: 5,
      },
      {
        title: "Product documents",
        columns: ["Document", "Status", "Notes"],
        rows: 5,
      },
      {
        title: "Shipping documents",
        columns: ["Document", "Status", "Notes"],
        rows: 5,
      },
      {
        title: "Customs documents",
        columns: ["Document", "Status", "Notes"],
        rows: 5,
      },
      {
        title: "Compliance documents",
        columns: ["Document", "Status", "Notes"],
        rows: 5,
      },
    ],
    notesLabel: "Checklist notes",
    signatureLabels: [],
  },
];

export const trade82TemplateSlugs = trade82TemplatePages.map((template) => template.slug);

export function getTrade82TemplatePage(slug: string) {
  return trade82TemplatePages.find((template) => template.slug === slug) ?? null;
}
