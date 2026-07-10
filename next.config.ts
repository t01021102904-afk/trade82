import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
];

const privateRobotsHeaders = [
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];

const privateRouteSources = [
  "/login/:path*",
  "/signup/:path*",
  "/dashboard/:path*",
  "/settings/:path*",
  "/messages/:path*",
  "/admin/:path*",
  "/onboarding/:path*",
  "/deals/:path*",
  "/en/login/:path*",
  "/en/signup/:path*",
  "/en/dashboard/:path*",
  "/en/settings/:path*",
  "/en/messages/:path*",
  "/en/admin/:path*",
  "/en/onboarding/:path*",
  "/en/deals/:path*",
  "/ko/login/:path*",
  "/ko/signup/:path*",
  "/ko/dashboard/:path*",
  "/ko/settings/:path*",
  "/ko/messages/:path*",
  "/ko/admin/:path*",
  "/ko/onboarding/:path*",
  "/ko/deals/:path*",
] as const;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cjryteuoyiiwsxarblfd.supabase.co",
        pathname: "/storage/v1/object/public/marketplace-assets/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      ...privateRouteSources.map((source) => ({
        source,
        headers: privateRobotsHeaders,
      })),
    ];
  },
};

export default nextConfig;
