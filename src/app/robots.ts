import type { MetadataRoute } from "next";

import { absoluteSiteUrl, SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/api",
        "/dashboard",
        "/messages",
        "/settings",
        "/en/admin",
        "/en/dashboard",
        "/en/messages",
        "/en/settings",
        "/ko/admin",
        "/ko/dashboard",
        "/ko/messages",
        "/ko/settings",
      ],
    },
    sitemap: absoluteSiteUrl("/sitemap.xml"),
    host: SITE_URL,
  };
}
