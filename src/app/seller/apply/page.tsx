import { redirect } from "next/navigation";

import { SupplierApplicationStart } from "@/components/supplier-application-workspace";
import { getCurrentSupplierApplication } from "@/lib/supplier-application";
import { requireSupplierApplicant } from "@/lib/require-auth";

export default async function SupplierApplyPage() {
  const user = await requireSupplierApplicant("/seller/apply");
  const application = await getCurrentSupplierApplication(user.id);
  if (application) redirect(`/seller/apply/${application.id}`);
  return <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6"><h1 className="mb-2 text-2xl font-semibold tracking-tight">Supplier application</h1><p className="mb-6 text-sm text-muted-foreground">Start with the information Trade82 needs to assess your supplier application.</p><SupplierApplicationStart locale="en" /></main>;
}
