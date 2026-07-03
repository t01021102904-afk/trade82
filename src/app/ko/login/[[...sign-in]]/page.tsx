import type { Metadata } from "next";

import { AuthShell } from "@/components/auth-shell";
import { publicPageMetadata } from "@/lib/seo";

export const metadata: Metadata = publicPageMetadata({
  title: "Login | Trade82",
  description:
    "Log in to your Trade82 account to manage products, inquiries, documents, and buyer conversations.",
  path: "/ko/login",
  languages: {
    en: "/login",
    ko: "/ko/login",
  },
});

export default async function KoLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string | string[] }>;
}) {
  const params = await searchParams;
  const redirectUrl = Array.isArray(params.redirect_url)
    ? params.redirect_url[0]
    : params.redirect_url;

  return (
    <AuthShell
      locale="ko"
      mode="login"
      basePath="/ko"
      redirectUrl={redirectUrl}
    />
  );
}
