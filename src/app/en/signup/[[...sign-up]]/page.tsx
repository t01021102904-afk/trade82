import type { Metadata } from "next";

import { AuthShell } from "@/components/auth-shell";
import { privatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = privatePageMetadata;

export default async function EnSignupPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string | string[] }>;
}) {
  const params = await searchParams;
  const redirectUrl = Array.isArray(params.redirect_url)
    ? params.redirect_url[0]
    : params.redirect_url;

  return <AuthShell locale="en" mode="signup" basePath="/en" redirectUrl={redirectUrl} />;
}
