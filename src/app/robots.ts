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
        "/deals",
        "/login",
        "/messages",
        "/onboarding",
        "/settings",
        "/signup",
        "/en/admin",
        "/en/dashboard",
        "/en/deals",
        "/en/login",
        "/en/messages",
        "/en/onboarding",
        "/en/settings",
        "/en/signup",
        "/ko/admin",
        "/ko/dashboard",
        "/ko/deals",
        "/ko/login",
        "/ko/messages",
        "/ko/onboarding",
        "/ko/settings",
        "/ko/signup",
      ],
    },
    sitemap: absoluteSiteUrl("/sitemap.xml"),
    host: SITE_URL,
  };
}
