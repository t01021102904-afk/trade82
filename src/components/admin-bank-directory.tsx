"use client";

import { Loader2, Pencil, Plus, Search, X } from "lucide-react";
import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";

import { useI18n } from "@/components/i18n-provider";
import { isSafeOfficialBankWebsite } from "@/lib/bank-directory-security";
import { formatTradeDate } from "@/lib/trade-order-i18n";

type Bank = {
  id: string;
  countryCode: string;
  bankNameLocal: string;
  bankNameEnglish: string;
  bankCode: string | null;
  defaultSwiftBic: string | null;
  defaultBankAddress: string | null;
  officialWebsite: string | null;
  sourceUrl: string | null;
  verifiedAt: string | null;
  sourceType: "SEED" | "ADMIN" | "ADMIN_OVERRIDE";
  isActive: boolean;
};

type FormState = Omit<Bank, "id" | "sourceType"> & { id?: string };

const blank: FormState = {
  countryCode: "",
  bankNameLocal: "",
  bankNameEnglish: "",
  bankCode: "",
  defaultSwiftBic: "",
  defaultBankAddress: "",
  officialWebsite: "",
  sourceUrl: "",
  verifiedAt: null,
  isActive: true,
};

export function AdminBankDirectory() {
  const { locale, t } = useI18n();
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [form, setForm] = useState<FormState>(blank);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (search.trim()) query.set("search", search.trim());
      if (countryCode.trim()) query.set("countryCode", countryCode.trim().toUpperCase());
      const response = await fetch(`/api/admin/banks?${query.toString()}`, { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(t("payouts.bankDirectory.loadError"));
      setBanks(data.banks ?? []);
    } catch {
      setError(t("payouts.bankDirectory.loadError"));
    } finally {
      setLoading(false);
    }
  }, [countryCode, search, t]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 150);
    return () => window.clearTimeout(timer);
  }, [load]);

  function update(key: keyof FormState, value: string | boolean | null) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function edit(bank: Bank) {
    setError("");
    setForm({
      id: bank.id,
      countryCode: bank.countryCode,
      bankNameLocal: bank.bankNameLocal,
      bankNameEnglish: bank.bankNameEnglish,
      bankCode: bank.bankCode,
      defaultSwiftBic: bank.defaultSwiftBic,
      defaultBankAddress: bank.defaultBankAddress,
      officialWebsite: bank.officialWebsite,
      sourceUrl: bank.sourceUrl,
      verifiedAt: bank.verifiedAt,
      isActive: bank.isActive,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function reset() {
    setForm(blank);
    setError("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const body = { ...form, verifiedAt: Boolean(form.verifiedAt) };
      const response = await fetch("/api/admin/banks", {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      await response.json().catch(() => null);
      if (!response.ok) throw new Error(t("payouts.bankDirectory.saveError"));
      reset();
      await load();
    } catch {
      setError(t("payouts.bankDirectory.saveError"));
    } finally {
      setSaving(false);
    }
  }

  const headers = [
    t("payouts.country"), t("payouts.bank"), t("payouts.bankDirectory.localName"), t("payouts.bankDirectory.code"),
    "SWIFT / BIC", t("payouts.bankAddress"), t("payouts.bankDirectory.officialWebsite"), t("payouts.bankDirectory.source"),
    t("payouts.bankDirectory.verified"), t("payouts.bankDirectory.origin"), t("payouts.bankDirectory.active"), "",
  ];

  return (
    <section className="grid gap-5">
      <form onSubmit={save} className="grid gap-3 rounded-xl border p-4 theme-surface-elevated sm:grid-cols-2">
        <div className="flex items-center justify-between gap-3 sm:col-span-2">
          <div><h2 className="font-semibold theme-foreground">{form.id ? t("payouts.bankDirectory.edit") : t("payouts.bankDirectory.add")}</h2><p className="mt-1 text-xs theme-muted">{t("payouts.bankDirectory.description")}</p></div>
          {form.id ? <button type="button" onClick={reset} className="inline-flex h-8 items-center gap-1 rounded-md border px-2 text-xs font-semibold"><X className="size-3.5" />{t("payouts.bankDirectory.cancelEdit")}</button> : null}
        </div>
        <Field label={t("payouts.bankDirectory.countryCode")}><input value={form.countryCode} onChange={(event) => update("countryCode", event.target.value.toUpperCase())} maxLength={2} placeholder="KR" className="input" required /></Field>
        <Field label={t("payouts.bankDirectory.bankNameEnglish")}><input value={form.bankNameEnglish} onChange={(event) => update("bankNameEnglish", event.target.value)} className="input" required /></Field>
        <Field label={t("payouts.bankDirectory.bankNameLocal")}><input value={form.bankNameLocal} onChange={(event) => update("bankNameLocal", event.target.value)} className="input" required /></Field>
        <Field label={t("payouts.bankCode")}><input value={form.bankCode ?? ""} onChange={(event) => update("bankCode", event.target.value)} className="input" /></Field>
        <Field label={t("payouts.bankDirectory.verifiedSwiftBic")}><input value={form.defaultSwiftBic ?? ""} onChange={(event) => update("defaultSwiftBic", event.target.value)} className="input" /></Field>
        <Field label={t("payouts.bankDirectory.officialWebsite")}><input value={form.officialWebsite ?? ""} onChange={(event) => update("officialWebsite", event.target.value)} className="input" placeholder="https://" /></Field>
        <Field label={t("payouts.bankAddress")}><input value={form.defaultBankAddress ?? ""} onChange={(event) => update("defaultBankAddress", event.target.value)} className="input" /></Field>
        <Field label={t("payouts.bankDirectory.officialSourceUrl")}><input value={form.sourceUrl ?? ""} onChange={(event) => update("sourceUrl", event.target.value)} className="input" placeholder="https://" /></Field>
        <label className="flex items-center gap-2 text-sm"><input checked={Boolean(form.verifiedAt)} onChange={(event) => update("verifiedAt", event.target.checked ? new Date().toISOString() : null)} type="checkbox" />{t("payouts.bankDirectory.officialSourceVerified")}</label>
        <label className="flex items-center gap-2 text-sm"><input checked={form.isActive} onChange={(event) => update("isActive", event.target.checked)} type="checkbox" />{t("payouts.bankDirectory.activeForSellerSelection")}</label>
        <button disabled={saving} className="inline-flex h-9 w-fit items-center gap-2 rounded-md bg-zinc-950 px-3 text-sm font-semibold text-white disabled:opacity-50"><Plus className="size-4" />{saving ? t("payouts.saving") : form.id ? t("payouts.bankDirectory.saveChanges") : t("payouts.bankDirectory.addBank")}</button>
      </form>
      <div className="flex flex-wrap gap-2"><label className="relative"><Search className="pointer-events-none absolute left-3 top-2.5 size-4 theme-muted" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("payouts.bankDirectory.searchPlaceholder")} className="input h-9 pl-9" /></label><input value={countryCode} onChange={(event) => setCountryCode(event.target.value.toUpperCase())} maxLength={2} placeholder={t("payouts.bankDirectory.searchCountry")} className="input h-9 w-24" /></div>
      {error ? <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {loading ? <Loader2 className="size-5 animate-spin" aria-label={t("payouts.loading")} /> : <div className="overflow-x-auto rounded-xl border"><table className="min-w-[1200px] text-left text-sm"><thead className="border-b theme-surface-muted"><tr>{headers.map((label, index) => <th key={`${label}-${index}`} className="px-3 py-3 font-semibold">{label}</th>)}</tr></thead><tbody>{banks.length ? banks.map((bank) => <tr key={bank.id} className="border-b theme-border"><td className="px-3 py-3">{bank.countryCode}</td><td className="px-3 py-3 font-medium">{bank.bankNameEnglish}</td><td className="px-3 py-3">{bank.bankNameLocal}</td><td className="px-3 py-3">{bank.bankCode ?? "—"}</td><td className="px-3 py-3">{bank.defaultSwiftBic ?? "—"}</td><td className="max-w-64 px-3 py-3">{bank.defaultBankAddress ?? "—"}</td><td className="px-3 py-3">{bank.verifiedAt && isSafeOfficialBankWebsite(bank.officialWebsite) ? <a href={bank.officialWebsite ?? undefined} target="_blank" rel="noopener noreferrer" className="theme-success-text">{t("payouts.bankDirectory.open")}</a> : "—"}</td><td className="px-3 py-3">{isSafeOfficialBankWebsite(bank.sourceUrl) ? <a href={bank.sourceUrl ?? undefined} target="_blank" rel="noopener noreferrer" className="theme-success-text">{t("payouts.bankDirectory.source")}</a> : "—"}</td><td className="px-3 py-3">{bank.verifiedAt ? formatTradeDate(bank.verifiedAt, locale) : t("payouts.bankDirectory.unverified")}</td><td className="px-3 py-3">{bank.sourceType === "SEED" ? t("payouts.bankDirectory.seed") : bank.sourceType === "ADMIN_OVERRIDE" ? t("payouts.bankDirectory.adminOverride") : t("payouts.bankDirectory.admin")}</td><td className="px-3 py-3">{bank.isActive ? t("payouts.bankDirectory.active") : t("payouts.bankDirectory.disabled")}</td><td className="px-3 py-3"><button type="button" onClick={() => edit(bank)} className="inline-flex h-8 items-center gap-1 rounded-md border px-2 text-xs font-semibold"><Pencil className="size-3.5" />{t("payouts.bankDirectory.editAction")}</button></td></tr>) : <tr><td colSpan={headers.length} className="p-8 text-center theme-muted">{t("payouts.bankDirectory.empty")}</td></tr>}</tbody></table></div>}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1 text-sm"><span>{label}</span>{children}</label>;
}
