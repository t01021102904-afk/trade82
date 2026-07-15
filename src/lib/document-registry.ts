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
  enFileName: string;
  koFileName: string;
  descriptions: Record<Locale, string>;
};

export const documentDefinitions: Record<DocumentSlug, DocumentDefinition> = {
  about: {
    enFileName: "about-us.en.txt",
    koFileName: "about-us.ko.txt",
    descriptions: {
      en: "Learn about Trade82 and its global B2B marketplace mission.",
      ko: "Trade82와 글로벌 B2B 마켓플레이스의 미션을 소개합니다.",
    },
  },
  "how-it-works": {
    enFileName: "how-it-works.en.txt",
    koFileName: "how-it-works.ko.txt",
    descriptions: {
      en: "How Trade82 supports global sourcing and Korean suppliers.",
      ko: "Trade82가 글로벌 소싱과 한국 공급업체를 지원하는 방식을 안내합니다.",
    },
  },
  "for-sellers": {
    enFileName: "for-sellers.en.txt",
    koFileName: "for-sellers.ko.txt",
    descriptions: {
      en: "A guide for Korean sellers using Trade82.",
      ko: "Trade82를 이용하는 한국 셀러를 위한 안내입니다.",
    },
  },
  "for-buyers": {
    enFileName: "for-buyers.en.txt",
    koFileName: "for-buyers.ko.txt",
    descriptions: {
      en: "A guide for global buyers sourcing through Trade82.",
      ko: "Trade82를 통해 소싱하는 글로벌 바이어를 위한 안내입니다.",
    },
  },
  "partner-program": {
    enFileName: "partner-program.en.txt",
    koFileName: "partner-program.ko.txt",
    descriptions: {
      en: "Information about the Trade82 partner program.",
      ko: "Trade82 파트너 프로그램 정보를 안내합니다.",
    },
  },
  "product-registration-guide": {
    enFileName: "product-registration-guide.en.txt",
    koFileName: "product-registration-guide.ko.txt",
    descriptions: {
      en: "How sellers can register products on Trade82.",
      ko: "셀러가 Trade82에 상품을 등록하는 방법을 안내합니다.",
    },
  },
  "rfq-guide": {
    enFileName: "rfq-guide.en.txt",
    koFileName: "rfq-guide.ko.txt",
    descriptions: {
      en: "How to create and manage Trade82 RFQs.",
      ko: "Trade82 RFQ를 생성하고 관리하는 방법을 안내합니다.",
    },
  },
  "export-shipping-guide": {
    enFileName: "export-shipping-guide.en.txt",
    koFileName: "export-shipping-guide.ko.txt",
    descriptions: {
      en: "Export and shipping guidance for Trade82 transactions.",
      ko: "Trade82 거래의 수출 및 배송 절차를 안내합니다.",
    },
  },
  "compliance-documentation": {
    enFileName: "compliance-documentation.en.txt",
    koFileName: "compliance-documentation.ko.txt",
    descriptions: {
      en: "Compliance and documentation guidance for Trade82 users.",
      ko: "Trade82 이용자를 위한 규정 준수 및 문서 안내입니다.",
    },
  },
  faq: {
    enFileName: "faq.en.txt",
    koFileName: "faq.ko.txt",
    descriptions: {
      en: "Frequently asked questions about Trade82.",
      ko: "Trade82에 관해 자주 묻는 질문을 안내합니다.",
    },
  },
  privacy: {
    enFileName: "privacy-policy.en.txt",
    koFileName: "privacy-policy.ko.txt",
    descriptions: {
      en: "Trade82 Privacy Policy.",
      ko: "Trade82 개인정보처리방침입니다.",
    },
  },
  terms: {
    enFileName: "terms-of-service.en.txt",
    koFileName: "terms-of-service.ko.txt",
    descriptions: {
      en: "Trade82 Terms of Service.",
      ko: "Trade82 이용약관입니다.",
    },
  },
  "payment-refund-policy": {
    enFileName: "payment-refund-policy.en.txt",
    koFileName: "payment-refund-policy.ko.txt",
    descriptions: {
      en: "Trade82 Payment and Refund Policy.",
      ko: "Trade82 결제 및 환불 정책입니다.",
    },
  },
};

export function isDocumentSlug(value: string): value is DocumentSlug {
  return documentSlugs.includes(value as DocumentSlug);
}

export function getDocumentPath(slug: DocumentSlug, locale: Locale) {
  const prefix = locale === "ko" ? "/ko" : "";
  return `${prefix}/${slug}`;
}
