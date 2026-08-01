import { SupplierApplicationWorkspace } from "@/components/supplier-application-workspace";
import { requireSupplierApplicant } from "@/lib/require-auth";

export default async function SupplierApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSupplierApplicant("/seller/apply");
  return <SupplierApplicationWorkspace locale="en" applicationId={(await params).id} />;
}
