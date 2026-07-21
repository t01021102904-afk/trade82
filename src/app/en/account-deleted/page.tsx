import type { Metadata } from "next";

import { AccountDeletedSessionReset } from "@/components/account-deleted-session-reset";
import { privatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = privatePageMetadata;

export default function EnAccountDeletedPage() {
  return <AccountDeletedSessionReset />;
}
