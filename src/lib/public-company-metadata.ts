import "server-only";

import type { Metadata } from "next";

import { DELETED_COMPANY_NAME } from "@/lib/deletion-markers";
import { getDb } from "@/lib/db";
import { canonicalPublicPath } from "@/lib/english-canonical-path";
import type { Locale } from "@/lib/i18n";
import { localizedText } from "@/lib/multilingual-content";
import {
  DEFAULT_OG_IMAGE_URL,
  absoluteSiteUrl,
  publicPageMetadata,
} from "@/lib/seo";

type PublicCompanyDetailType = "company" | "store" | "buyer";

const typeConfig = {
  company: {
    role: "seller",
    path: "companies",
    titleFallback: "Company profile",
    descriptionFallback:
      "Review this Korean seller profile, products, and export-ready business information on Trade82.",
  },
  store: {
    role: "seller",
    path: "stores",
    titleFallback: "Seller store",
    descriptionFallback:
      "Browse this Korean seller store and export-ready products on Trade82.",
  },
  buyer: {
    role: "buyer",
    path: "buyers",
    titleFallback: "Buyer profile",
    descriptionFallback:
      "Review this global buyer profile and sourcing interests on Trade82.",
  },
} as const;

export async function getPublicCompanyMetadata({
  id,
  localePrefix = "",
  type,
}: {
  id: string;
  localePrefix?: string;
  type: PublicCompanyDetailType;
}): Promise<Metadata> {
  const config = typeConfig[type];
  const encodedId = encodeURIComponent(id);
  const path = canonicalPublicPath(`${localePrefix}/${config.path}/${encodedId}`);
  const locale: Locale = localePrefix.startsWith("/ko") ? "ko" : "en";

  try {
    const company = await getDb().company.findFirst({
      where: {
        id,
        companyRole: config.role,
        verificationStatus: "verified",
        deletedAt: null,
        legalName: { not: DELETED_COMPANY_NAME },
      },
      select: {
        legalName: true,
        tradeName: true,
        displayNameEn: true,
        description: true,
        descriptionEn: true,
        logoUrl: true,
        logoThumbnailUrl: true,
        logoOriginalUrl: true,
      },
    });

    if (!company) {
      return fallbackMetadata(path, config.titleFallback, config.descriptionFallback, type);
    }

    const name = localizedText({
      locale,
      original: company.tradeName || company.legalName,
      english: company.displayNameEn,
    });
    const description = cleanDescription(
      localizedText({
        locale,
        original: company.description,
        english: company.descriptionEn,
      }),
      config.descriptionFallback,
    );
    const imageUrl =
      company.logoThumbnailUrl || company.logoUrl || company.logoOriginalUrl
        ? absoluteUrl(
            company.logoThumbnailUrl ||
              company.logoUrl ||
              company.logoOriginalUrl ||
              DEFAULT_OG_IMAGE_URL,
          )
        : DEFAULT_OG_IMAGE_URL;

    const metadata = publicPageMetadata({
      title: `${name} | Trade82`,
      description,
      path,
      languages: localizedLanguages(config.path, encodedId),
    });

    return {
      ...metadata,
      openGraph: {
        ...metadata.openGraph,
        images: [
          {
            url: imageUrl,
            alt: name,
          },
        ],
      },
      twitter: {
        ...metadata.twitter,
        images: [imageUrl],
      },
    };
  } catch {
    return fallbackMetadata(path, config.titleFallback, config.descriptionFallback, type);
  }
}

function fallbackMetadata(
  path: string,
  title: string,
  description: string,
  type: PublicCompanyDetailType,
) {
  return publicPageMetadata({
    title: `${title} | Trade82`,
    description,
    path,
    languages: localizedLanguages(typeConfig[type].path, path.split("/").pop() ?? ""),
  });
}

function localizedLanguages(pathSegment: string, encodedId: string) {
  return {
    en: `/${pathSegment}/${encodedId}`,
    ko: `/ko/${pathSegment}/${encodedId}`,
    "x-default": `/${pathSegment}/${encodedId}`,
  };
}

function cleanDescription(value: string | null | undefined, fallback: string) {
  const cleaned = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return fallback;
  return cleaned.length > 180 ? `${cleaned.slice(0, 177).trim()}...` : cleaned;
}

function absoluteUrl(value: string) {
  try {
    return new URL(value).toString();
  } catch {
    return absoluteSiteUrl(value);
  }
}
