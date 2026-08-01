import { AdminSupplierApplicationDetail } from "@/components/admin-supplier-applications";
import { requireAdmin } from "@/lib/require-auth";

export default async function EnAdminSupplierApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin("/en/admin/supplier-applications");
  return <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8"><AdminSupplierApplicationDetail locale="en" applicationId={(await params).id} /></main>;
}
