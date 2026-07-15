import type { Metadata } from "next";
import type { Product } from "@/lib/types";

import {
  canonicalPublicPath,
  publicLocaleAlternatePaths,
} from "@/lib/english-canonical-path";

export const SITE_URL = "https://trade82.com";
export const DEFAULT_OG_IMAGE_URL = `${SITE_URL}/og/linkpicture-v2.png`;
export const SITE_NAME = "Trade82";
export const DEFAULT_HOME_TITLE =
  "Trade82 | Global B2B Marketplace for Korean Products";
export const DEFAULT_HOME_DESCRIPTION =
  "Trade82 helps global buyers discover Korean suppliers, compare trade-ready products, review seller profiles, and start export inquiries.";
export const KOREAN_HOME_TITLE =
  "Trade82 | 한국 상품 글로벌 B2B 마켓플레이스";
export const KOREAN_HOME_DESCRIPTION =
  "Trade82는 전세계 바이어가 한국 셀러와 수출 준비된 상품을 찾고, 회사 정보와 제품 조건을 비교한 뒤 수출 문의를 시작할 수 있도록 돕습니다.";

const defaultImage = {
  url: DEFAULT_OG_IMAGE_URL,
  width: 1200,
  height: 630,
  alt: "Trade82 global B2B marketplace for Korean products",
};

export function absoluteSiteUrl(path = "/") {
  if (path === "/") return SITE_URL;
  return new URL(path, SITE_URL).toString();
}

export function publicLocaleAlternates(path: string) {
  return publicLocaleAlternatePaths(path);
}

export function publicPageMetadata({
  title,
  description,
  path,
  languages,
}: {
  title: string;
  description: string;
  path: string;
  languages?: Record<string, string>;
}): Metadata {
  const canonicalPath = canonicalPublicPath(path);
  const url = absoluteSiteUrl(canonicalPath);
  const normalizedLanguages = {
    ...publicLocaleAlternates(canonicalPath),
    ...Object.fromEntries(
      Object.entries(languages ?? {}).map(([locale, href]) => [
        locale,
        (locale === "en" || locale === "x-default")
          ? canonicalPublicPath(href)
          : href,
      ]),
    ),
  };

  return {
    title,
    description,
    alternates: {
      canonical: url,
      languages: Object.fromEntries(
        Object.entries(normalizedLanguages).map(([locale, href]) => [
          locale,
          absoluteSiteUrl(href),
        ]),
      ),
    },
    robots: {
      index: true,
      follow: true,
    },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      type: "website",
      images: [defaultImage],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [DEFAULT_OG_IMAGE_URL],
    },
  };
}

export const privatePageMetadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: SITE_NAME,
    url: SITE_URL,
    logo: absoluteSiteUrl("/trade82-logo.png"),
    email: "contact@trade82.com",
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: SITE_NAME,
    alternateName: "trade82.com",
    url: SITE_URL,
  };
}

export function siteNavigationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Trade82 primary navigation",
    itemListElement: [
      navigationElement(1, "Marketplace", "/marketplace"),
      navigationElement(2, "Sellers", "/sellers"),
      navigationElement(3, "Buyers", "/buyers"),
      navigationElement(4, "Pricing", "/pricing"),
    ],
  };
}

export function breadcrumbJsonLd(
  items: Array<{ name: string; path: string }>,
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteSiteUrl(item.path),
    })),
  };
}

export function marketplaceItemListJsonLd(
  products: Array<Pick<Product, "id" | "name">>,
  locale: "en" | "ko",
) {
  const productPathPrefix = locale === "ko" ? "/ko/products" : "/products";

  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: products.map((product, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: product.name,
      url: absoluteSiteUrl(`${productPathPrefix}/${product.id}`),
    })),
  };
}

function navigationElement(position: number, name: string, path: string) {
  return {
    "@type": "SiteNavigationElement",
    position,
    name,
    url: absoluteSiteUrl(path),
  };
}
