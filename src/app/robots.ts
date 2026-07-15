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
        "/orders",
        "/reviews",
        "/en/admin",
        "/en/dashboard",
        "/en/deals",
        "/en/login",
        "/en/messages",
        "/en/onboarding",
        "/en/settings",
        "/en/signup",
        "/en/orders",
        "/en/reviews",
        "/ko/admin",
        "/ko/dashboard",
        "/ko/deals",
        "/ko/login",
        "/ko/messages",
        "/ko/onboarding",
        "/ko/settings",
        "/ko/signup",
        "/ko/orders",
        "/ko/reviews",
      ],
    },
    sitemap: absoluteSiteUrl("/sitemap.xml"),
    host: SITE_URL,
  };
}
