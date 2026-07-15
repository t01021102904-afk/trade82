import type { Metadata } from "next";

import { AuthShell } from "@/components/auth-shell";
import { privatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = privatePageMetadata;

export default function KoSignupPage() {
  return <AuthShell locale="ko" mode="signup" basePath="/ko" />;
}
