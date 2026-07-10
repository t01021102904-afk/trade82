import "server-only";

import type { Metadata } from "next";

import { DELETED_COMPANY_NAME } from "@/lib/deletion-markers";
import { getDb } from "@/lib/db";
import type { Locale } from "@/lib/i18n";
import { localizedText } from "@/lib/multilingual-content";
import { normalizeProductFieldVisibility } from "@/lib/product-field-visibility";
import {
  DEFAULT_OG_IMAGE_URL,
  absoluteSiteUrl,
} from "@/lib/seo";

const DEFAULT_DESCRIPTION =
  "Discover trade-ready Korean products and connect with global buyers and Korean suppliers on Trade82.";

function absoluteUrl(value: string) {
  try {
    return new URL(value).toString();
  } catch {
    return absoluteSiteUrl(value);
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

function publicProductImageUrls(
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
  const primary = publicProductImageUrl(product);
  const additional =
    product?.images
      .flatMap((image) => [
        image.detailUrl,
        image.mainUrl,
        image.cardUrl,
        image.originalUrl,
      ])
      .filter((value) => value.trim().length > 0)
      .map(absoluteUrl) ?? [];

  return Array.from(new Set([primary, ...additional]));
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
        languages: {
          en: absoluteUrl(`/en/products/${encodeURIComponent(productId)}`),
          ko: absoluteUrl(`/ko/products/${encodeURIComponent(productId)}`),
          "x-default": absoluteUrl(`/products/${encodeURIComponent(productId)}`),
        },
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

export async function getProductStructuredData(
  productId: string,
  localePrefix = "",
) {
  const locale: Locale = localePrefix.startsWith("/ko") ? "ko" : "en";
  const url = absoluteUrl(`${localePrefix}/products/${encodeURIComponent(productId)}`);

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
        id: true,
        name: true,
        nameEn: true,
        category: true,
        shortDescription: true,
        shortDescriptionEn: true,
        detailedDescription: true,
        detailedDescriptionEn: true,
        imageUrl: true,
        priceMin: true,
        currency: true,
        fieldVisibility: true,
        sellerCompany: {
          select: {
            legalName: true,
            tradeName: true,
            displayNameEn: true,
          },
        },
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

    if (!product) return null;

    const productName = localizedText({
      locale,
      original: product.name,
      english: product.nameEn,
    });
    const productDescription = cleanMetaText(
      localizedText({
        locale,
        original: product.shortDescription || product.detailedDescription,
        english: product.shortDescriptionEn || product.detailedDescriptionEn,
      }),
      DEFAULT_DESCRIPTION,
    );
    const sellerName = localizedText({
      locale,
      original: product.sellerCompany.tradeName || product.sellerCompany.legalName,
      english: product.sellerCompany.displayNameEn,
    });
    const visibility = normalizeProductFieldVisibility(product.fieldVisibility);
    const price = Number(product.priceMin);
    const offers =
      visibility.minimumUnitPrice === "public" && Number.isFinite(price) && price > 0
        ? {
            "@type": "Offer",
            url,
            priceCurrency: product.currency || "USD",
            price: product.priceMin?.toString(),
            availability: "https://schema.org/InStock",
            itemCondition: "https://schema.org/NewCondition",
          }
        : undefined;

    return {
      "@context": "https://schema.org",
      "@type": "Product",
      name: productName,
      image: publicProductImageUrls(product),
      description: productDescription,
      brand: {
        "@type": "Brand",
        name: sellerName,
      },
      sku: product.id,
      category: product.category,
      ...(offers ? { offers } : {}),
    };
  } catch {
    return null;
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
