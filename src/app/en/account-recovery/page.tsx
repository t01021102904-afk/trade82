import type { Metadata } from "next";

import { OrphanedProfileRecovery } from "@/components/orphaned-profile-recovery";
import { privatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = privatePageMetadata;

export default function EnAccountRecoveryPage() {
  return <OrphanedProfileRecovery />;
}
