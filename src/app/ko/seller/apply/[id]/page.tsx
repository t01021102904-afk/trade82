import { SupplierApplicationWorkspace } from "@/components/supplier-application-workspace";
import { requireSupplierApplicant } from "@/lib/require-auth";

export default async function KoSupplierApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSupplierApplicant("/ko/seller/apply");
  return <SupplierApplicationWorkspace locale="ko" applicationId={(await params).id} />;
}
