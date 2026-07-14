"use client";

import { Loader2, Pencil, Plus, Search, X } from "lucide-react";
import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";

import { isSafeOfficialBankWebsite } from "@/lib/bank-directory-security";

type Bank = {
  id: string; countryCode: string; bankNameLocal: string; bankNameEnglish: string; bankCode: string | null;
  defaultSwiftBic: string | null; defaultBankAddress: string | null; officialWebsite: string | null;
  sourceUrl: string | null; verifiedAt: string | null; sourceType: "SEED" | "ADMIN" | "ADMIN_OVERRIDE"; isActive: boolean;
};
type FormState = Omit<Bank, "id" | "sourceType"> & { id?: string };
const blank: FormState = { countryCode: "", bankNameLocal: "", bankNameEnglish: "", bankCode: "", defaultSwiftBic: "", defaultBankAddress: "", officialWebsite: "", sourceUrl: "", verifiedAt: null, isActive: true };

export function AdminBankDirectory() {
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
      const query = new URLSearchParams(); if (search.trim()) query.set("search", search.trim()); if (countryCode.trim()) query.set("countryCode", countryCode.trim().toUpperCase());
      const response = await fetch(`/api/admin/banks?${query.toString()}`, { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Unable to load banks.");
      setBanks(data.banks ?? []);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load banks."); }
    finally { setLoading(false); }
  }, [search, countryCode]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 150); return () => window.clearTimeout(timer); }, [load]);

  function update(key: keyof FormState, value: string | boolean | null) { setForm((current) => ({ ...current, [key]: value })); }
  function edit(bank: Bank) { setError(""); setForm({ id: bank.id, countryCode: bank.countryCode, bankNameLocal: bank.bankNameLocal, bankNameEnglish: bank.bankNameEnglish, bankCode: bank.bankCode, defaultSwiftBic: bank.defaultSwiftBic, defaultBankAddress: bank.defaultBankAddress, officialWebsite: bank.officialWebsite, sourceUrl: bank.sourceUrl, verifiedAt: bank.verifiedAt, isActive: bank.isActive }); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function reset() { setForm(blank); setError(""); }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const body = { ...form, verifiedAt: Boolean(form.verifiedAt) };
      const response = await fetch("/api/admin/banks", { method: form.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Unable to save bank directory entry.");
      reset(); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save bank directory entry."); }
    finally { setSaving(false); }
  }

  return <section className="grid gap-5">
    <form onSubmit={save} className="grid gap-3 rounded-xl border p-4 theme-surface-elevated sm:grid-cols-2">
      <div className="flex items-center justify-between gap-3 sm:col-span-2"><div><h2 className="font-semibold theme-foreground">{form.id ? "Edit bank directory entry" : "Add bank directory entry"}</h2><p className="mt-1 text-xs theme-muted">Only verified fields are eligible for seller auto-fill. Editing seed data records an admin override.</p></div>{form.id ? <button type="button" onClick={reset} className="inline-flex h-8 items-center gap-1 rounded-md border px-2 text-xs font-semibold"><X className="size-3.5" />Cancel edit</button> : null}</div>
      <Field label="Country code"><input value={form.countryCode} onChange={(event) => update("countryCode", event.target.value.toUpperCase())} maxLength={2} placeholder="KR" className="input" required /></Field><Field label="Bank name in English"><input value={form.bankNameEnglish} onChange={(event) => update("bankNameEnglish", event.target.value)} className="input" required /></Field><Field label="Bank name local"><input value={form.bankNameLocal} onChange={(event) => update("bankNameLocal", event.target.value)} className="input" required /></Field><Field label="Bank code"><input value={form.bankCode ?? ""} onChange={(event) => update("bankCode", event.target.value)} className="input" /></Field><Field label="Verified SWIFT / BIC"><input value={form.defaultSwiftBic ?? ""} onChange={(event) => update("defaultSwiftBic", event.target.value)} className="input" /></Field><Field label="Official HTTPS website"><input value={form.officialWebsite ?? ""} onChange={(event) => update("officialWebsite", event.target.value)} className="input" placeholder="https://" /></Field><Field label="Bank address"><input value={form.defaultBankAddress ?? ""} onChange={(event) => update("defaultBankAddress", event.target.value)} className="input" /></Field><Field label="Official source URL"><input value={form.sourceUrl ?? ""} onChange={(event) => update("sourceUrl", event.target.value)} className="input" placeholder="https://" /></Field>
      <label className="flex items-center gap-2 text-sm"><input checked={Boolean(form.verifiedAt)} onChange={(event) => update("verifiedAt", event.target.checked ? new Date().toISOString() : null)} type="checkbox" />Official source verified</label><label className="flex items-center gap-2 text-sm"><input checked={form.isActive} onChange={(event) => update("isActive", event.target.checked)} type="checkbox" />Active for seller selection</label><button disabled={saving} className="inline-flex h-9 w-fit items-center gap-2 rounded-md bg-zinc-950 px-3 text-sm font-semibold text-white disabled:opacity-50"><Plus className="size-4" />{saving ? "Saving..." : form.id ? "Save changes" : "Add bank"}</button>
    </form>
    <div className="flex flex-wrap gap-2"><label className="relative"><Search className="pointer-events-none absolute left-3 top-2.5 size-4 theme-muted" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search bank or SWIFT / BIC" className="input h-9 pl-9" /></label><input value={countryCode} onChange={(event) => setCountryCode(event.target.value.toUpperCase())} maxLength={2} placeholder="Country" className="input h-9 w-24" /></div>
    {error ? <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
    {loading ? <Loader2 className="size-5 animate-spin" /> : <div className="overflow-x-auto rounded-xl border"><table className="min-w-[1200px] text-left text-sm"><thead className="border-b theme-surface-muted"><tr>{["Country", "Bank", "Local name", "Code", "SWIFT / BIC", "Bank address", "Official website", "Source", "Verified", "Origin", "Active", ""].map((label) => <th key={label} className="px-3 py-3 font-semibold">{label}</th>)}</tr></thead><tbody>{banks.length ? banks.map((bank) => <tr key={bank.id} className="border-b theme-border"><td className="px-3 py-3">{bank.countryCode}</td><td className="px-3 py-3 font-medium">{bank.bankNameEnglish}</td><td className="px-3 py-3">{bank.bankNameLocal}</td><td className="px-3 py-3">{bank.bankCode ?? "—"}</td><td className="px-3 py-3">{bank.defaultSwiftBic ?? "—"}</td><td className="max-w-64 px-3 py-3">{bank.defaultBankAddress ?? "—"}</td><td className="px-3 py-3">{bank.verifiedAt && isSafeOfficialBankWebsite(bank.officialWebsite) ? <a href={bank.officialWebsite ?? undefined} target="_blank" rel="noopener noreferrer" className="theme-success-text">Open</a> : "—"}</td><td className="px-3 py-3">{isSafeOfficialBankWebsite(bank.sourceUrl) ? <a href={bank.sourceUrl ?? undefined} target="_blank" rel="noopener noreferrer" className="theme-success-text">Source</a> : "—"}</td><td className="px-3 py-3">{bank.verifiedAt ? new Date(bank.verifiedAt).toLocaleDateString() : "Unverified"}</td><td className="px-3 py-3">{bank.sourceType === "SEED" ? "Seed" : bank.sourceType === "ADMIN_OVERRIDE" ? "Admin override" : "Admin"}</td><td className="px-3 py-3">{bank.isActive ? "Active" : "Disabled"}</td><td className="px-3 py-3"><button onClick={() => edit(bank)} className="inline-flex h-8 items-center gap-1 rounded-md border px-2 text-xs font-semibold"><Pencil className="size-3.5" />Edit</button></td></tr>) : <tr><td colSpan={12} className="p-8 text-center theme-muted">No banks match this search.</td></tr>}</tbody></table></div>}
  </section>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid gap-1 text-sm"><span>{label}</span>{children}</label>; }
