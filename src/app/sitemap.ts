import type { MetadataRoute } from "next";

import { absoluteSiteUrl } from "@/lib/seo";

const publicRoutes = [
  { path: "/", priority: 1 },
  { path: "/marketplace", priority: 0.9 },
  { path: "/sellers", priority: 0.85 },
  { path: "/login", priority: 0.7 },
  { path: "/signup", priority: 0.7 },
  { path: "/en", priority: 0.8 },
  { path: "/en/marketplace", priority: 0.75 },
  { path: "/en/sellers", priority: 0.7 },
  { path: "/en/login", priority: 0.6 },
  { path: "/en/signup", priority: 0.6 },
  { path: "/ko", priority: 0.8 },
  { path: "/ko/marketplace", priority: 0.75 },
  { path: "/ko/sellers", priority: 0.7 },
  { path: "/ko/login", priority: 0.6 },
  { path: "/ko/signup", priority: 0.6 },
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return publicRoutes.map((route) => ({
    url: absoluteSiteUrl(route.path),
    changeFrequency: route.path === "/" ? "weekly" : "daily",
    priority: route.priority,
  }));
}
