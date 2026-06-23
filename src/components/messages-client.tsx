"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useI18n } from "@/components/i18n-provider";
import { CompanyLogo } from "@/components/profile-identity";
import { withLocale } from "@/lib/i18n";
import { formatDate } from "@/lib/utils";

type InquiryThread = {
  id: string;
  message: string;
  quantity: string | null;
  targetDate: string | null;
  status: string;
  updatedAt: string;
  buyerCompany: { id: string; legalName: string; tradeName?: string; logoUrl?: string; useDefaultLogo: boolean };
  sellerCompany: { id: string; legalName: string; tradeName?: string; logoUrl?: string; useDefaultLogo: boolean };
  product: { name: string } | null;
  messages: Array<{ id: string; body: string; createdAt: string; senderCompanyId: string | null }>;
};

export function MessagesClient() {
  const { locale, t } = useI18n();
  const [threads, setThreads] = useState<InquiryThread[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState("");

  async function load() {
    const response = await fetch("/api/inquiries");
    if (response.ok) setThreads((await response.json()) as InquiryThread[]);
  }

  useEffect(() => {
    void fetch("/api/inquiries")
      .then((response) => (response.ok ? response.json() : []))
      .then((items: InquiryThread[]) => setThreads(items));
  }, []);

  const selected = useMemo(
    () => threads.find((thread) => thread.id === selectedId) ?? threads[0],
    [selectedId, threads],
  );

  async function submitReply() {
    if (!selected || !reply.trim()) return;
    const response = await fetch(`/api/inquiries/${selected.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: reply.trim() }),
    });
    if (response.ok) {
      setReply("");
      await load();
    }
  }

  if (!threads.length) {
    return <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-10 text-center"><h2 className="text-xl font-semibold text-zinc-950">{t("messages.emptyTitle")}</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-zinc-600">{t("messages.emptyText")}</p><Link href={withLocale("/marketplace", locale)} className="mt-5 inline-flex rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white">{t("common.browseProducts")}</Link></div>;
  }

  return (
    <div className="grid min-h-[620px] overflow-hidden rounded-lg border border-zinc-200 bg-white lg:grid-cols-[340px_1fr]">
      <aside className="border-r border-zinc-200">
        {threads.map((thread) => {
          const company = thread.sellerCompany;
          return <button key={thread.id} type="button" onClick={() => setSelectedId(thread.id)} className={`flex w-full gap-3 border-b border-zinc-100 p-4 text-left ${selected?.id === thread.id ? "bg-blue-50" : "hover:bg-zinc-50"}`}><CompanyLogo companyName={company.tradeName || company.legalName} logoUrl={company.logoUrl} useDefaultLogo={company.useDefaultLogo} size="sm" /><div className="min-w-0"><p className="truncate font-medium text-zinc-950">{company.tradeName || company.legalName}</p><p className="truncate text-xs text-zinc-500">{thread.product?.name || t("messages.sellerInquiry")}</p><p className="mt-2 text-xs text-zinc-500">{formatDate(thread.updatedAt)}</p></div></button>;
        })}
      </aside>
      {selected ? <section className="flex min-h-[620px] flex-col"><header className="border-b border-zinc-200 p-5"><h2 className="text-xl font-semibold text-zinc-950">{selected.product?.name || t("messages.sellerInquiry")}</h2><p className="mt-1 text-sm text-zinc-500">{selected.buyerCompany.legalName} · {selected.sellerCompany.legalName}</p></header><div className="flex-1 space-y-4 overflow-y-auto bg-zinc-50 p-5"><div className="rounded-lg border border-zinc-200 bg-white p-4"><p className="whitespace-pre-wrap text-sm leading-6 text-zinc-700">{selected.message}</p></div>{selected.messages.map((message) => <div key={message.id} className="rounded-lg border border-blue-200 bg-blue-50 p-4"><p className="whitespace-pre-wrap text-sm text-blue-950">{message.body}</p><p className="mt-2 text-xs text-blue-700">{formatDate(message.createdAt)}</p></div>)}</div><footer className="border-t border-zinc-200 p-4"><textarea value={reply} onChange={(event) => setReply(event.target.value)} rows={3} placeholder={t("messages.replyPlaceholder")} className="w-full rounded-md border border-zinc-200 px-3 py-2" /><button type="button" onClick={() => void submitReply()} className="mt-3 rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white">{t("messages.saveReply")}</button></footer></section> : null}
    </div>
  );
}
