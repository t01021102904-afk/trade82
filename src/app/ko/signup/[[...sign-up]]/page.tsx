import type { Metadata } from "next";

import { AuthShell } from "@/components/auth-shell";
import { publicPageMetadata } from "@/lib/seo";

export const metadata: Metadata = publicPageMetadata({
  title: "Sign up | Trade82",
  description:
    "Create a Trade82 account to connect Korean sellers with U.S. buyers.",
  path: "/ko/signup",
  languages: {
    en: "/signup",
    ko: "/ko/signup",
  },
});

export default function KoSignupPage() {
  return <AuthShell locale="ko" mode="signup" basePath="/ko" />;
}
