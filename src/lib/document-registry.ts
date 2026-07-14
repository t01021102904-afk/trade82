import type { Locale } from "@/lib/i18n";

export const documentSlugs = [
  "about",
  "how-it-works",
  "for-sellers",
  "for-buyers",
  "partner-program",
  "product-registration-guide",
  "rfq-guide",
  "export-shipping-guide",
  "compliance-documentation",
  "faq",
  "privacy",
  "terms",
  "payment-refund-policy",
] as const;

export type DocumentSlug = (typeof documentSlugs)[number];

export type DocumentDefinition = {
  fileName: string;
  description: string;
};

export const documentDefinitions: Record<DocumentSlug, DocumentDefinition> = {
  about: {
    fileName: "about-us.txt",
    description: "Learn about Trade82 and its global B2B marketplace mission.",
  },
  "how-it-works": {
    fileName: "how-it-works.txt",
    description: "How Trade82 supports global sourcing and Korean suppliers.",
  },
  "for-sellers": {
    fileName: "for-sellers.txt",
    description: "A guide for Korean sellers using Trade82.",
  },
  "for-buyers": {
    fileName: "for-buyers.txt",
    description: "A guide for global buyers sourcing through Trade82.",
  },
  "partner-program": {
    fileName: "partner-program.txt",
    description: "Information about the Trade82 partner program.",
  },
  "product-registration-guide": {
    fileName: "product-registration-guide.txt",
    description: "How sellers can register products on Trade82.",
  },
  "rfq-guide": {
    fileName: "rfq-guide.txt",
    description: "How to create and manage Trade82 RFQs.",
  },
  "export-shipping-guide": {
    fileName: "export-shipping-guide.txt",
    description: "Export and shipping guidance for Trade82 transactions.",
  },
  "compliance-documentation": {
    fileName: "compliance-documentation.txt",
    description: "Compliance and documentation guidance for Trade82 users.",
  },
  faq: {
    fileName: "faq.txt",
    description: "Frequently asked questions about Trade82.",
  },
  privacy: {
    fileName: "privacy-policy.txt",
    description: "Trade82 Privacy Policy.",
  },
  terms: {
    fileName: "terms-of-service.txt",
    description: "Trade82 Terms of Service.",
  },
  "payment-refund-policy": {
    fileName: "payment-refund-policy.txt",
    description: "Trade82 Payment and Refund Policy.",
  },
};

export function isDocumentSlug(value: string): value is DocumentSlug {
  return documentSlugs.includes(value as DocumentSlug);
}

export function getDocumentPath(slug: DocumentSlug, locale: Locale) {
  const prefix = locale === "ko" ? "/ko" : "";
  return `${prefix}/${slug}`;
}
