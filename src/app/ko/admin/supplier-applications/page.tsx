import { AdminSupplierApplications } from "@/components/admin-supplier-applications";
import { requireAdmin } from "@/lib/require-auth";

export default async function KoAdminSupplierApplicationsPage() {
  await requireAdmin("/ko/admin/supplier-applications");
  return <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8"><header><h1 className="text-2xl font-semibold tracking-tight">공급사 신청</h1><p className="mt-1 text-sm text-muted-foreground">공개 셀러 회사를 생성하기 전에 신청을 검토합니다.</p></header><AdminSupplierApplications locale="ko" /></main>;
}
