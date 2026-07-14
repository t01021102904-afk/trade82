import { notFound } from "next/navigation";

import { InternalOrderSystemTestClient } from "@/components/internal-order-system-test-client";
import { getInternalOrderTestAccess } from "@/lib/internal-order-test-feature";

export const dynamic = "force-dynamic";

export default async function InternalOrderSystemTestPage() {
  const access = await getInternalOrderTestAccess();
  if (!access) notFound();

  return <InternalOrderSystemTestClient />;
}
