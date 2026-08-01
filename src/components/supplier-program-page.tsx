import Link from "next/link";
import { ClipboardCheck, ShieldCheck, Store } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDictionary, withLocale, type Locale } from "@/lib/i18n";

export function SupplierProgramPage({ locale }: { locale: Locale }) {
  const copy = getDictionary(locale).supplierApplication;
  const steps = [
    [ClipboardCheck, copy.basic],
    [ShieldCheck, copy.business],
    [Store, copy.finalReview],
  ] as const;
  return <main className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:px-8">
    <section className="grid gap-6 border-b pb-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-end">
      <div className="space-y-3"><p className="text-sm font-medium text-muted-foreground">Trade82 Supplier Program</p><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{copy.programTitle}</h1><p className="max-w-2xl text-base leading-7 text-muted-foreground">{copy.programDescription}</p></div>
      <Button render={<Link href={withLocale("/seller/apply", locale)} />} size="lg">{copy.startApplication}</Button>
    </section>
    <section className="grid gap-4 md:grid-cols-3">{steps.map(([Icon, label], index) => <Card key={label}><CardHeader><Icon className="size-5 text-primary" aria-hidden="true" /><CardTitle className="text-base">{index + 1}. {label}</CardTitle></CardHeader><CardContent><CardDescription>{copy.privateNotice}</CardDescription></CardContent></Card>)}</section>
  </main>;
}

export function SupplierApplicationStatusCard({ locale, application }: { locale: Locale; application: { id: string; applicationNumber: string; status: string; statusReason: string | null; submittedAt: Date | null } }) {
  const copy = getDictionary(locale).supplierApplication;
  return <main className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-10 sm:px-6"><Card><CardHeader><CardDescription>{application.applicationNumber}</CardDescription><CardTitle className="text-2xl">{copy.statusTitle}</CardTitle><CardDescription>{application.status.replaceAll("_", " ")}</CardDescription></CardHeader><CardContent className="space-y-5"><p className="text-sm leading-6 text-muted-foreground">{application.status === "APPROVED" ? copy.approvedNotice : copy.pendingNotice}</p>{application.statusReason ? <div className="rounded-md border bg-muted/40 p-3 text-sm"><p className="font-medium">{copy.statusReason}</p><p className="mt-1 text-muted-foreground">{application.statusReason}</p></div> : null}<Button render={<Link href={withLocale(`/seller/apply/${application.id}`, locale)} />}>{copy.continueApplication}</Button></CardContent></Card></main>;
}
