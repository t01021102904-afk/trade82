import { redirect } from "next/navigation";

import { SupplierApplicationStatusCard } from "@/components/supplier-program-page";
import { getCurrentSupplierApplication } from "@/lib/supplier-application";
import { requireSupplierApplicant } from "@/lib/require-auth";

export default async function SupplierApplicationStatusPage() {
  const user = await requireSupplierApplicant("/seller/application/status");
  const application = await getCurrentSupplierApplication(user.id);
  if (!application) redirect("/seller/apply");
  return <SupplierApplicationStatusCard locale="en" application={application} />;
}
