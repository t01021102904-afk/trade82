import type { MetadataRoute } from "next";

import { DELETED_COMPANY_NAME } from "@/lib/deletion-markers";
import { getDb } from "@/lib/db";
import { documentSlugs, getDocumentPath } from "@/lib/document-registry";
import { absoluteSiteUrl } from "@/lib/seo";
import { localizedSitemapPaths, staticSitemapPaths } from "@/lib/sitemap-routes";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes = [
    ...staticSitemapPaths,
    ...documentSlugs.flatMap((slug) => localizedSitemapPaths(getDocumentPath(slug, "en"))),
  ].map((path) => ({
    url: absoluteSiteUrl(path),
  }));

  return [...staticRoutes, ...(await dynamicPublicRoutes())];
}

async function dynamicPublicRoutes(): Promise<MetadataRoute.Sitemap> {
  try {
    const [products, companies] = await Promise.all([
      getDb().product.findMany({
        where: {
          status: "active",
          deletedAt: null,
          sellerCompany: {
            verificationStatus: "verified",
            deletedAt: null,
            legalName: { not: DELETED_COMPANY_NAME },
          },
        },
        select: {
          id: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: "desc" },
        take: 5000,
      }),
      getDb().company.findMany({
        where: {
          verificationStatus: "verified",
          deletedAt: null,
          legalName: { not: DELETED_COMPANY_NAME },
        },
        select: {
          id: true,
          companyRole: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: "desc" },
        take: 5000,
      }),
    ]);

    const productRoutes = products.flatMap((product) =>
      localizedRoutes(`/products/${encodeURIComponent(product.id)}`, product.updatedAt),
    );

    const companyRoutes = companies.flatMap((company) => {
      const profileRoutes =
        company.companyRole === "buyer"
          ? localizedRoutes(`/buyers/${encodeURIComponent(company.id)}`, company.updatedAt)
          : localizedRoutes(`/companies/${encodeURIComponent(company.id)}`, company.updatedAt);
      const storeRoutes =
        company.companyRole === "seller"
          ? localizedRoutes(`/stores/${encodeURIComponent(company.id)}`, company.updatedAt)
          : [];
      return [...profileRoutes, ...storeRoutes];
    });

    return [...productRoutes, ...companyRoutes];
  } catch (error) {
    console.warn("Sitemap dynamic public routes were skipped.", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return [];
  }
}

function localizedRoutes(
  basePath: string,
  lastModified: Date,
): MetadataRoute.Sitemap {
  return localizedSitemapPaths(basePath).map((path) => sitemapEntry(path, lastModified));
}

function sitemapEntry(
  path: string,
  lastModified: Date,
) {
  return {
    url: absoluteSiteUrl(path),
    lastModified,
  };
}
