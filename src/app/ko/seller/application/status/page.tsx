import { redirect } from "next/navigation";

import { SupplierApplicationStatusCard } from "@/components/supplier-program-page";
import { getCurrentSupplierApplication } from "@/lib/supplier-application";
import { requireSupplierApplicant } from "@/lib/require-auth";

export default async function KoSupplierApplicationStatusPage() {
  const user = await requireSupplierApplicant("/ko/seller/application/status");
  const application = await getCurrentSupplierApplication(user.id);
  if (!application) redirect("/ko/seller/apply");
  return <SupplierApplicationStatusCard locale="ko" application={application} />;
}
