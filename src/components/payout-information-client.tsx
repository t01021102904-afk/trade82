"use client";

import { Landmark, Loader2, Save, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { verifiedBankAutofill } from "@/lib/bank-directory-security";

type Bank = {
  id: string;
  bankNameLocal: string;
  bankNameEnglish: string;
  bankCode: string | null;
  defaultSwiftBic: string | null;
  defaultBankAddress: string | null;
  officialWebsite: string | null;
  verifiedAt: string | null;
};

type Profile = {
  country: string;
  bankDirectoryId: string | null;
  bankName: string;
  branchName: string | null;
  accountHolder: string;
  accountNumberMasked: string | null;
  accountType: "LOCAL" | "FOREIGN_CURRENCY" | "IBAN" | "OTHER";
  bankCode: string | null;
  swiftBic: string | null;
  bankAddress: string | null;
  beneficiaryAddress: string | null;
  payoutCurrency: string;
  supportedCurrencies: string[];
  intermediaryBankName: string | null;
  intermediaryBankSwift: string | null;
  intermediaryBankAddress: string | null;
  payoutMemo: string | null;
  accountBelongsToCompany: boolean;
  manualBankOverride: boolean;
  manualOverrideReason: string | null;
  status: string;
  verifiedAt: string | null;
  updatedAt: string;
};

const emptyProfile: Profile = {
  country: "KR", bankDirectoryId: null, bankName: "", branchName: null, accountHolder: "", accountNumberMasked: null,
  accountType: "LOCAL", bankCode: null, swiftBic: null, bankAddress: null, beneficiaryAddress: null, payoutCurrency: "usd",
  supportedCurrencies: ["usd"], intermediaryBankName: null, intermediaryBankSwift: null, intermediaryBankAddress: null,
  payoutMemo: null, accountBelongsToCompany: false, manualBankOverride: false, manualOverrideReason: null, status: "DRAFT", verifiedAt: null, updatedAt: "",
};

function fieldValue(value: string | null | undefined) { return value ?? ""; }

export function PayoutInformationClient({ locale = "en" }: { locale?: "en" | "ko" }) {
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [accountNumber, setAccountNumber] = useState("");
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const korean = locale === "ko";
  const title = korean ? "정산 정보" : "Payout Information";

  useEffect(() => {
    let active = true;
    void fetch("/api/account/payout-profile", { cache: "no-store" })
      .then(async (response) => ({ response, data: await response.json().catch(() => null) }))
      .then(({ response, data }) => {
        if (!active) return;
        if (!response.ok) { setError(data?.error ?? "Unable to load payout information."); return; }
        if (data?.profile) setProfile({ ...emptyProfile, ...data.profile });
      })
      .catch(() => active && setError("Unable to load payout information."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const countryCode = profile.country.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(countryCode)) { queueMicrotask(() => setBanks([])); return; }
    let active = true;
    void fetch(`/api/banks?countryCode=${encodeURIComponent(countryCode)}`, { cache: "no-store" })
      .then(async (response) => ({ response, data: await response.json().catch(() => null) }))
      .then(({ response, data }) => { if (active && response.ok) setBanks(data?.banks ?? []); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [profile.country]);

  const selectedBank = useMemo(() => banks.find((bank) => bank.id === profile.bankDirectoryId) ?? null, [banks, profile.bankDirectoryId]);
  const selectedBankAutofill = useMemo(
    () => verifiedBankAutofill(selectedBank, profile.manualBankOverride),
    [profile.manualBankOverride, selectedBank],
  );
  function update<K extends keyof Profile>(key: K, value: Profile[K]) { setProfile((current) => ({ ...current, [key]: value })); }
  function selectBank(id: string) {
    const bank = banks.find((item) => item.id === id) ?? null;
    update("bankDirectoryId", bank?.id ?? null);
    const autofill = verifiedBankAutofill(bank, profile.manualBankOverride);
    if (bank && autofill) {
      setProfile((current) => ({ ...current, bankDirectoryId: bank.id, bankName: autofill.bankName, bankCode: bank.bankCode, swiftBic: autofill.swiftBic, bankAddress: autofill.bankAddress }));
    }
  }
  async function save() {
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/account/payout-profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...profile, accountNumber: accountNumber || undefined }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) { setError(data?.error ?? "Unable to save payout information."); return; }
      setProfile({ ...emptyProfile, ...data.profile }); setAccountNumber(""); setNotice(korean ? "정산 정보가 저장되었습니다. 관리자 확인 후 정산 준비가 가능합니다." : "Payout information saved. It must be verified before a payout can be prepared.");
    } catch { setError("Unable to save payout information."); } finally { setSaving(false); }
  }
  if (loading) return <div className="flex min-h-48 items-center justify-center"><Loader2 className="size-5 animate-spin theme-muted" /></div>;
  return <section className="mx-auto grid max-w-4xl gap-5 px-4 py-8 sm:px-6"><div><p className="text-xs font-semibold uppercase tracking-[.18em] theme-success-text">Seller settings</p><h1 className="mt-2 text-2xl font-semibold theme-foreground">{title}</h1><p className="mt-2 text-sm theme-muted">{korean ? "정산 계좌 정보는 암호화되어 저장되며 기본 화면에서는 마스킹됩니다." : "Bank instructions are encrypted and only masked account details are shown by default."}</p></div>{error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}{notice ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p> : null}<div className="grid gap-5 rounded-2xl border p-5 theme-surface-elevated"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-full border theme-surface-muted"><Landmark className="size-5 theme-success-text" /></span><div><h2 className="font-semibold theme-foreground">{korean ? "수취인 정보" : "Beneficiary details"}</h2><p className="text-sm theme-muted">{profile.accountNumberMasked ? `${korean ? "저장된 계좌" : "Saved account"}: ${profile.accountNumberMasked}` : korean ? "계좌번호를 입력하세요." : "Enter the account number or IBAN."}</p></div></div><span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold theme-success-badge"><ShieldCheck className="size-3.5" />{profile.status}</span></div><div className="grid gap-4 sm:grid-cols-2"><Label label="Country / 국가"><input value={profile.country} maxLength={2} onChange={(event) => update("country", event.target.value.toUpperCase())} className="input" /></Label><Label label="Bank / 은행"><select value={profile.bankDirectoryId ?? ""} onChange={(event) => selectBank(event.target.value)} className="input"><option value="">Select a bank</option>{banks.map((bank) => <option key={bank.id} value={bank.id}>{bank.bankNameEnglish}{bank.bankNameLocal ? ` (${bank.bankNameLocal})` : ""}</option>)}</select></Label><Label label="Bank name / 은행명"><input value={profile.bankName} onChange={(event) => update("bankName", event.target.value)} className="input" /></Label><Label label="Branch name / 지점명"><input value={fieldValue(profile.branchName)} onChange={(event) => update("branchName", event.target.value || null)} className="input" /></Label><Label label="Account holder / 예금주"><input value={profile.accountHolder} onChange={(event) => update("accountHolder", event.target.value)} className="input" /></Label><Label label={profile.accountNumberMasked ? "Replace account number / 계좌번호 변경" : "Account number or IBAN / 계좌번호 또는 IBAN"}><input value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} autoComplete="off" inputMode="text" className="input" placeholder={profile.accountNumberMasked ?? ""} /></Label><Label label="Account type / 계좌 유형"><select value={profile.accountType} onChange={(event) => update("accountType", event.target.value as Profile["accountType"])} className="input"><option value="LOCAL">Local</option><option value="FOREIGN_CURRENCY">Foreign currency</option><option value="IBAN">IBAN</option><option value="OTHER">Other</option></select></Label><Label label="Payout currency / 정산 통화"><input value={profile.payoutCurrency} maxLength={3} onChange={(event) => update("payoutCurrency", event.target.value.toLowerCase())} className="input" /></Label><Label label="Supported currencies / 지원 통화 (comma-separated)"><input value={profile.supportedCurrencies.join(", ")} onChange={(event) => update("supportedCurrencies", event.target.value.split(",").map((value) => value.trim().toLowerCase()).filter(Boolean))} className="input" /></Label><Label label="SWIFT / BIC"><input value={fieldValue(profile.swiftBic)} onChange={(event) => update("swiftBic", event.target.value || null)} className="input" /></Label><Label label="Bank code / 은행 코드"><input value={fieldValue(profile.bankCode)} onChange={(event) => update("bankCode", event.target.value || null)} className="input" /></Label><Label label="Intermediary bank / 중개 은행"><input value={fieldValue(profile.intermediaryBankName)} onChange={(event) => update("intermediaryBankName", event.target.value || null)} className="input" /></Label><Label label="Intermediary SWIFT / 중개 은행 SWIFT"><input value={fieldValue(profile.intermediaryBankSwift)} onChange={(event) => update("intermediaryBankSwift", event.target.value || null)} className="input" /></Label><Label label="Intermediary address / 중개 은행 주소"><input value={fieldValue(profile.intermediaryBankAddress)} onChange={(event) => update("intermediaryBankAddress", event.target.value || null)} className="input" /></Label></div><Label label="Bank address / 은행 주소"><textarea value={fieldValue(profile.bankAddress)} onChange={(event) => update("bankAddress", event.target.value || null)} className="input min-h-20" /></Label><Label label="Beneficiary address / 수취인 주소"><textarea value={fieldValue(profile.beneficiaryAddress)} onChange={(event) => update("beneficiaryAddress", event.target.value || null)} className="input min-h-20" /></Label><Label label="Payout memo / 정산 메모"><textarea value={fieldValue(profile.payoutMemo)} onChange={(event) => update("payoutMemo", event.target.value || null)} className="input min-h-20" /></Label><label className="flex items-start gap-3 rounded-lg border p-3 text-sm theme-surface-muted"><input type="checkbox" checked={profile.accountBelongsToCompany} onChange={(event) => update("accountBelongsToCompany", event.target.checked)} className="mt-1" /><span>{korean ? "이 계좌는 셀러 회사 또는 승인된 수취인에게 속해 있음을 확인합니다." : "I confirm this account belongs to the seller company or an authorized beneficiary."}</span></label><label className="flex items-start gap-3 rounded-lg border p-3 text-sm theme-surface-muted"><input type="checkbox" checked={profile.manualBankOverride} onChange={(event) => update("manualBankOverride", event.target.checked)} className="mt-1" /><span>{korean ? "은행 디렉터리 정보와 다른 수동 입력을 요청합니다. 관리자 확인이 필요합니다." : "Request a manual bank override. It is visibly marked and requires administrator verification."}</span></label>{profile.manualBankOverride ? <Label label="Manual override reason"><textarea value={fieldValue(profile.manualOverrideReason)} onChange={(event) => update("manualOverrideReason", event.target.value || null)} className="input min-h-20" /></Label> : null}{selectedBankAutofill?.officialWebsite ? <a href={selectedBankAutofill.officialWebsite} target="_blank" rel="noopener noreferrer" className="text-sm font-medium theme-success-text">Open verified bank website</a> : null}<div className="flex items-center justify-between gap-3 border-t pt-4 theme-border"><p className="text-xs theme-muted">{profile.updatedAt ? `${korean ? "마지막 업데이트" : "Last updated"}: ${new Date(profile.updatedAt).toLocaleString()}` : ""}</p><button type="button" onClick={() => void save()} disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white disabled:opacity-60"><Save className="size-4" />{saving ? "Saving..." : korean ? "저장" : "Save"}</button></div></div></section>;
}

function Label({ label, children }: { label: string; children: ReactNode }) { return <label className="grid gap-1.5 text-sm font-medium theme-foreground"><span>{label}</span>{children}</label>; }
