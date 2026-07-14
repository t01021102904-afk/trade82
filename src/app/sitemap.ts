import type { MetadataRoute } from "next";

import { DELETED_COMPANY_NAME } from "@/lib/deletion-markers";
import { getDb } from "@/lib/db";
import { documentSlugs, getDocumentPath } from "@/lib/document-registry";
import { absoluteSiteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

const staticPublicRoutes = [
  { path: "/", priority: 1 },
  { path: "/en", priority: 0.9 },
  { path: "/ko", priority: 0.9 },
  { path: "/marketplace", priority: 0.9 },
  { path: "/en/marketplace", priority: 0.85 },
  { path: "/ko/marketplace", priority: 0.85 },
  { path: "/sellers", priority: 0.85 },
  { path: "/en/sellers", priority: 0.8 },
  { path: "/ko/sellers", priority: 0.8 },
  { path: "/buyers", priority: 0.75 },
  { path: "/en/buyers", priority: 0.72 },
  { path: "/ko/buyers", priority: 0.72 },
  { path: "/pricing", priority: 0.7 },
  { path: "/en/pricing", priority: 0.68 },
  { path: "/ko/pricing", priority: 0.68 },
  { path: "/sourcing-terms", priority: 0.35 },
  { path: "/en/sourcing-terms", priority: 0.33 },
  { path: "/ko/sourcing-terms", priority: 0.33 },
  { path: "/business", priority: 0.25 },
  { path: "/en/business", priority: 0.23 },
  { path: "/ko/business", priority: 0.23 },
] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticRoutes = [
    ...staticPublicRoutes,
    ...documentSlugs.flatMap((slug) => [
      { path: getDocumentPath(slug, "en"), priority: 0.35 },
      { path: `/en${getDocumentPath(slug, "en")}`, priority: 0.33 },
      { path: getDocumentPath(slug, "ko"), priority: 0.33 },
    ]),
  ].map((route) => ({
    url: absoluteSiteUrl(route.path),
    changeFrequency: route.path === "/" ? ("weekly" as const) : ("daily" as const),
    priority: route.priority,
    lastModified: now,
  }));

  return [...staticRoutes, ...(await dynamicPublicRoutes())];
}

async function dynamicPublicRoutes(): Promise<MetadataRoute.Sitemap> {
  try {
    const [products, companies] = await Promise.all([
      getDb().product.findMany({
        where: {
          status: "active",
          sellerCompany: {
            verificationStatus: "verified",
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
      localizedRoutes(`/products/${encodeURIComponent(product.id)}`, product.updatedAt, 0.64),
    );

    const companyRoutes = companies.flatMap((company) => {
      const profileRoutes =
        company.companyRole === "buyer"
          ? localizedRoutes(`/buyers/${encodeURIComponent(company.id)}`, company.updatedAt, 0.58)
          : localizedRoutes(`/companies/${encodeURIComponent(company.id)}`, company.updatedAt, 0.62);
      const storeRoutes =
        company.companyRole === "seller"
          ? localizedRoutes(`/stores/${encodeURIComponent(company.id)}`, company.updatedAt, 0.58)
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
  priority: number,
): MetadataRoute.Sitemap {
  return [
    sitemapEntry(basePath, lastModified, priority),
    sitemapEntry(`/en${basePath}`, lastModified, Math.max(priority - 0.02, 0.1)),
    sitemapEntry(`/ko${basePath}`, lastModified, Math.max(priority - 0.02, 0.1)),
  ];
}

function sitemapEntry(
  path: string,
  lastModified: Date,
  priority: number,
) {
  return {
    url: absoluteSiteUrl(path),
    changeFrequency: "weekly" as const,
    priority,
    lastModified,
  };
}
