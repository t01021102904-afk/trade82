import "server-only";

import type { Metadata } from "next";

import { DELETED_COMPANY_NAME } from "@/lib/deletion-markers";
import { getDb } from "@/lib/db";
import type { Locale } from "@/lib/i18n";
import { localizedText } from "@/lib/multilingual-content";

const DEFAULT_OG_IMAGE_URL = "https://trade82.com/og/linkpicture-v2.png";
const DEFAULT_DESCRIPTION =
  "Discover trade-ready Korean products and connect with global buyers and Korean suppliers on Trade82.";

function getSiteOrigin() {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || process.env.SITE_URL?.trim();

  if (!configured) return "https://trade82.com";

  try {
    return new URL(configured).origin;
  } catch {
    return "https://trade82.com";
  }
}

function absoluteUrl(value: string) {
  try {
    return new URL(value).toString();
  } catch {
    return new URL(value, getSiteOrigin()).toString();
  }
}

function cleanMetaText(value: string | null | undefined, fallback: string) {
  const cleaned = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return fallback;
  return cleaned.length > 180 ? `${cleaned.slice(0, 177).trim()}...` : cleaned;
}

function publicProductImageUrl(
  product:
    | {
        imageUrl: string | null;
        images: Array<{
          detailUrl: string;
          mainUrl: string;
          cardUrl: string;
          originalUrl: string;
        }>;
      }
    | null,
) {
  if (!product) return DEFAULT_OG_IMAGE_URL;

  const image = product.images[0];
  const candidate =
    image?.detailUrl ||
    image?.mainUrl ||
    image?.cardUrl ||
    image?.originalUrl ||
    product.imageUrl ||
    "";

  return candidate.trim()
    ? absoluteUrl(candidate)
    : DEFAULT_OG_IMAGE_URL;
}

export async function getProductShareMetadata(
  productId: string,
  localePrefix = "",
): Promise<Metadata> {
  const canonicalPath = `${localePrefix}/products/${encodeURIComponent(productId)}`;
  const url = absoluteUrl(canonicalPath);
  const locale: Locale = localePrefix.startsWith("/ko") ? "ko" : "en";

  try {
    const product = await getDb().product.findFirst({
      where: {
        id: productId,
        status: "active",
        sellerCompany: {
          verificationStatus: "verified",
          legalName: { not: DELETED_COMPANY_NAME },
        },
      },
      select: {
        name: true,
        nameEn: true,
        shortDescription: true,
        shortDescriptionEn: true,
        detailedDescription: true,
        detailedDescriptionEn: true,
        imageUrl: true,
        images: {
          orderBy: { position: "asc" },
          select: {
            detailUrl: true,
            mainUrl: true,
            cardUrl: true,
            originalUrl: true,
          },
        },
      },
    });

    if (!product) {
      return fallbackProductMetadata(url);
    }

    const productName = localizedText({
      locale,
      original: product.name,
      english: product.nameEn,
    });
    const productDescription = localizedText({
      locale,
      original: product.shortDescription || product.detailedDescription,
      english: product.shortDescriptionEn || product.detailedDescriptionEn,
    });
    const title = `${cleanMetaText(productName, "Trade82 product")} | Trade82`;
    const description = cleanMetaText(
      productDescription,
      DEFAULT_DESCRIPTION,
    );
    const imageUrl = publicProductImageUrl(product);

    return {
      title,
      description,
      alternates: {
        canonical: url,
      },
      openGraph: {
        title: productName,
        description,
        url,
        type: "website",
        siteName: "Trade82",
        images: [
          {
            url: imageUrl,
            alt: productName,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: productName,
        description,
        images: [imageUrl],
      },
    };
  } catch {
    return fallbackProductMetadata(url);
  }
}

function fallbackProductMetadata(url: string): Metadata {
  const imageUrl = DEFAULT_OG_IMAGE_URL;

  return {
    title: "Trade82 product | Trade82",
    description: DEFAULT_DESCRIPTION,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: "Trade82 product",
      description: DEFAULT_DESCRIPTION,
      url,
      type: "website",
      siteName: "Trade82",
      images: [
        {
          url: imageUrl,
          alt: "Trade82",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "Trade82 product",
      description: DEFAULT_DESCRIPTION,
      images: [imageUrl],
    },
  };
}
