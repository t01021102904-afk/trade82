import type { Metadata } from "next";

export const SITE_URL = "https://trade82.com";
export const DEFAULT_OG_IMAGE_URL = `${SITE_URL}/og/linkpicture-v2.png`;
export const SITE_NAME = "Trade82";

const defaultImage = {
  url: DEFAULT_OG_IMAGE_URL,
  width: 1200,
  height: 630,
  alt: "Trade82 Korean-U.S. B2B Marketplace",
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
