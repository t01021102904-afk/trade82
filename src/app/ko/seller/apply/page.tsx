import { redirect } from "next/navigation";

import { SupplierApplicationStart } from "@/components/supplier-application-workspace";
import { getCurrentSupplierApplication } from "@/lib/supplier-application";
import { requireSupplierApplicant } from "@/lib/require-auth";

export default async function KoSupplierApplyPage() {
  const user = await requireSupplierApplicant("/ko/seller/apply");
  const application = await getCurrentSupplierApplication(user.id);
  if (application) redirect(`/ko/seller/apply/${application.id}`);
  return <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6"><h1 className="mb-2 text-2xl font-semibold tracking-tight">공급사 신청</h1><p className="mb-6 text-sm text-muted-foreground">Trade82 공급사 심사에 필요한 기본 정보를 먼저 입력해 주세요.</p><SupplierApplicationStart locale="ko" /></main>;
}
