import { AdminSupplierApplications } from "@/components/admin-supplier-applications";
import { requireAdmin } from "@/lib/require-auth";

export default async function AdminSupplierApplicationsPage() {
  await requireAdmin("/admin/supplier-applications");
  return <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8"><header><h1 className="text-2xl font-semibold tracking-tight">Supplier applications</h1><p className="mt-1 text-sm text-muted-foreground">Review applications before a live seller company is created.</p></header><AdminSupplierApplications locale="en" /></main>;
}
