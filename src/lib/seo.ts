import type { Metadata } from "next";

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
  return new URL(path, SITE_URL).toString();
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
  const url = absoluteSiteUrl(path);

  return {
    title,
    description,
    alternates: {
      canonical: url,
      ...(languages
        ? {
            languages: Object.fromEntries(
              Object.entries(languages).map(([locale, href]) => [
                locale,
                absoluteSiteUrl(href),
              ]),
            ),
          }
        : {}),
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
    name: SITE_NAME,
    url: SITE_URL,
    logo: absoluteSiteUrl("/trade82-logo.png"),
    sameAs: [],
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
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
      navigationElement(3, "Login", "/login"),
      navigationElement(4, "Sign up", "/signup"),
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

function navigationElement(position: number, name: string, path: string) {
  return {
    "@type": "SiteNavigationElement",
    position,
    name,
    url: absoluteSiteUrl(path),
  };
}
