import type { Metadata } from "next";

import { AuthShell } from "@/components/auth-shell";
import { privatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = privatePageMetadata;

export default function SignupPage() {
  return <AuthShell locale="en" mode="signup" basePath="" />;
}
