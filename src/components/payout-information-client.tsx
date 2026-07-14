"use client";

import { Landmark, Loader2, Save, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { useI18n } from "@/components/i18n-provider";
import { verifiedBankAutofill } from "@/lib/bank-directory-security";
import {
  formatTradeDateTime,
  payoutProfileStatusLabel,
} from "@/lib/trade-order-i18n";

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
  country: "KR",
  bankDirectoryId: null,
  bankName: "",
  branchName: null,
  accountHolder: "",
  accountNumberMasked: null,
  accountType: "LOCAL",
  bankCode: null,
  swiftBic: null,
  bankAddress: null,
  beneficiaryAddress: null,
  payoutCurrency: "usd",
  supportedCurrencies: ["usd"],
  intermediaryBankName: null,
  intermediaryBankSwift: null,
  intermediaryBankAddress: null,
  payoutMemo: null,
  accountBelongsToCompany: false,
  manualBankOverride: false,
  manualOverrideReason: null,
  status: "DRAFT",
  verifiedAt: null,
  updatedAt: "",
};

function fieldValue(value: string | null | undefined) {
  return value ?? "";
}

export function PayoutInformationClient({ locale: pageLocale }: { locale?: "en" | "ko" }) {
  const { locale: contextLocale, t } = useI18n();
  const locale = pageLocale ?? contextLocale;
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [accountNumber, setAccountNumber] = useState("");
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/account/payout-profile", { cache: "no-store" })
      .then(async (response) => ({ response, data: await response.json().catch(() => null) }))
      .then(({ response, data }) => {
        if (!active) return;
        if (!response.ok) {
          setError(t("payouts.loadError"));
          return;
        }
        if (data?.profile) setProfile({ ...emptyProfile, ...data.profile });
      })
      .catch(() => active && setError(t("payouts.loadError")))
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, [t]);

  useEffect(() => {
    const countryCode = profile.country.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(countryCode)) {
      queueMicrotask(() => setBanks([]));
      return;
    }

    let active = true;
    void fetch(`/api/banks?countryCode=${encodeURIComponent(countryCode)}`, { cache: "no-store" })
      .then(async (response) => ({ response, data: await response.json().catch(() => null) }))
      .then(({ response, data }) => {
        if (active && response.ok) setBanks(data?.banks ?? []);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [profile.country]);

  const selectedBank = useMemo(
    () => banks.find((bank) => bank.id === profile.bankDirectoryId) ?? null,
    [banks, profile.bankDirectoryId],
  );
  const selectedBankAutofill = useMemo(
    () => verifiedBankAutofill(selectedBank, profile.manualBankOverride),
    [profile.manualBankOverride, selectedBank],
  );

  function update<K extends keyof Profile>(key: K, value: Profile[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  function selectBank(id: string) {
    const bank = banks.find((item) => item.id === id) ?? null;
    update("bankDirectoryId", bank?.id ?? null);
    const autofill = verifiedBankAutofill(bank, profile.manualBankOverride);
    if (bank && autofill) {
      setProfile((current) => ({
        ...current,
        bankDirectoryId: bank.id,
        bankName: autofill.bankName,
        bankCode: bank.bankCode,
        swiftBic: autofill.swiftBic,
        bankAddress: autofill.bankAddress,
      }));
    }
  }

  async function save() {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/account/payout-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          country: profile.country,
          bankDirectoryId: profile.bankDirectoryId,
          bankName: profile.bankName,
          branchName: profile.branchName,
          accountHolder: profile.accountHolder,
          ...(accountNumber ? { accountNumber } : {}),
          accountType: profile.accountType,
          bankCode: profile.bankCode,
          swiftBic: profile.swiftBic,
          bankAddress: profile.bankAddress,
          beneficiaryAddress: profile.beneficiaryAddress,
          payoutCurrency: profile.payoutCurrency,
          supportedCurrencies: profile.supportedCurrencies,
          intermediaryBankName: profile.intermediaryBankName,
          intermediaryBankSwift: profile.intermediaryBankSwift,
          intermediaryBankAddress: profile.intermediaryBankAddress,
          payoutMemo: profile.payoutMemo,
          accountBelongsToCompany: profile.accountBelongsToCompany,
          manualBankOverride: profile.manualBankOverride,
          manualOverrideReason: profile.manualOverrideReason,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(t("payouts.saveError"));
        return;
      }
      setProfile({ ...emptyProfile, ...data.profile });
      setAccountNumber("");
      setNotice(t("payouts.savedNotice"));
    } catch {
      setError(t("payouts.saveError"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-48 items-center justify-center" aria-label={t("payouts.loading")}>
        <Loader2 className="size-5 animate-spin theme-muted" />
      </div>
    );
  }

  return (
    <section className="mx-auto grid max-w-4xl gap-5 px-4 py-8 sm:px-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[.18em] theme-success-text">{t("payouts.sellerSettings")}</p>
        <h1 className="mt-2 text-2xl font-semibold theme-foreground">{t("payouts.informationTitle")}</h1>
        <p className="mt-2 text-sm theme-muted">{t("payouts.informationDescription")}</p>
      </div>

      {error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      {notice ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p> : null}

      <div className="grid gap-5 rounded-2xl border p-5 theme-surface-elevated">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-full border theme-surface-muted">
              <Landmark className="size-5 theme-success-text" />
            </span>
            <div>
              <h2 className="font-semibold theme-foreground">{t("payouts.beneficiaryDetails")}</h2>
              <p className="text-sm theme-muted">
                {profile.accountNumberMasked
                  ? `${t("payouts.savedAccount")}: ${profile.accountNumberMasked}`
                  : t("payouts.enterAccountNumber")}
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold theme-success-badge">
            <ShieldCheck className="size-3.5" />
            {payoutProfileStatusLabel(profile.status, t)}
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Label label={t("payouts.country")}><input value={profile.country} maxLength={2} onChange={(event) => update("country", event.target.value.toUpperCase())} className="input" /></Label>
          <Label label={t("payouts.bank")}><select value={profile.bankDirectoryId ?? ""} onChange={(event) => selectBank(event.target.value)} className="input"><option value="">{t("payouts.selectBank")}</option>{banks.map((bank) => <option key={bank.id} value={bank.id}>{bank.bankNameEnglish}{bank.bankNameLocal ? ` (${bank.bankNameLocal})` : ""}</option>)}</select></Label>
          <Label label={t("payouts.bankName")}><input value={profile.bankName} onChange={(event) => update("bankName", event.target.value)} className="input" /></Label>
          <Label label={t("payouts.branchName")}><input value={fieldValue(profile.branchName)} onChange={(event) => update("branchName", event.target.value || null)} className="input" /></Label>
          <Label label={t("payouts.accountHolder")}><input value={profile.accountHolder} onChange={(event) => update("accountHolder", event.target.value)} className="input" /></Label>
          <Label label={profile.accountNumberMasked ? t("payouts.replaceAccountNumber") : t("payouts.accountNumber")}><input value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} autoComplete="off" inputMode="text" className="input" placeholder={profile.accountNumberMasked ?? ""} /></Label>
          <Label label={t("payouts.accountType")}><select value={profile.accountType} onChange={(event) => update("accountType", event.target.value as Profile["accountType"])} className="input"><option value="LOCAL">{t("payouts.accountType.LOCAL")}</option><option value="FOREIGN_CURRENCY">{t("payouts.accountType.FOREIGN_CURRENCY")}</option><option value="IBAN">{t("payouts.accountType.IBAN")}</option><option value="OTHER">{t("payouts.accountType.OTHER")}</option></select></Label>
          <Label label={t("payouts.payoutCurrency")}><input value={profile.payoutCurrency} maxLength={3} onChange={(event) => update("payoutCurrency", event.target.value.toLowerCase())} className="input" /></Label>
          <Label label={t("payouts.supportedCurrencies")}><input value={profile.supportedCurrencies.join(", ")} onChange={(event) => update("supportedCurrencies", event.target.value.split(",").map((value) => value.trim().toLowerCase()).filter(Boolean))} className="input" /></Label>
          <Label label="SWIFT / BIC"><input value={fieldValue(profile.swiftBic)} onChange={(event) => update("swiftBic", event.target.value || null)} className="input" /></Label>
          <Label label={t("payouts.bankCode")}><input value={fieldValue(profile.bankCode)} onChange={(event) => update("bankCode", event.target.value || null)} className="input" /></Label>
          <Label label={t("payouts.intermediaryBank")}><input value={fieldValue(profile.intermediaryBankName)} onChange={(event) => update("intermediaryBankName", event.target.value || null)} className="input" /></Label>
          <Label label={t("payouts.intermediarySwift")}><input value={fieldValue(profile.intermediaryBankSwift)} onChange={(event) => update("intermediaryBankSwift", event.target.value || null)} className="input" /></Label>
          <Label label={t("payouts.intermediaryAddress")}><input value={fieldValue(profile.intermediaryBankAddress)} onChange={(event) => update("intermediaryBankAddress", event.target.value || null)} className="input" /></Label>
        </div>

        <Label label={t("payouts.bankAddress")}><textarea value={fieldValue(profile.bankAddress)} onChange={(event) => update("bankAddress", event.target.value || null)} className="input min-h-20" /></Label>
        <Label label={t("payouts.beneficiaryAddress")}><textarea value={fieldValue(profile.beneficiaryAddress)} onChange={(event) => update("beneficiaryAddress", event.target.value || null)} className="input min-h-20" /></Label>
        <Label label={t("payouts.payoutMemo")}><textarea value={fieldValue(profile.payoutMemo)} onChange={(event) => update("payoutMemo", event.target.value || null)} className="input min-h-20" /></Label>

        <label className="flex items-start gap-3 rounded-lg border p-3 text-sm theme-surface-muted"><input type="checkbox" checked={profile.accountBelongsToCompany} onChange={(event) => update("accountBelongsToCompany", event.target.checked)} className="mt-1" /><span>{t("payouts.accountBelongsToCompany")}</span></label>
        <label className="flex items-start gap-3 rounded-lg border p-3 text-sm theme-surface-muted"><input type="checkbox" checked={profile.manualBankOverride} onChange={(event) => update("manualBankOverride", event.target.checked)} className="mt-1" /><span>{t("payouts.manualBankOverride")}</span></label>
        {profile.manualBankOverride ? <Label label={t("payouts.manualOverrideReason")}><textarea value={fieldValue(profile.manualOverrideReason)} onChange={(event) => update("manualOverrideReason", event.target.value || null)} className="input min-h-20" /></Label> : null}
        {selectedBankAutofill?.officialWebsite ? <a href={selectedBankAutofill.officialWebsite} target="_blank" rel="noopener noreferrer" className="text-sm font-medium theme-success-text">{t("payouts.openVerifiedBankWebsite")}</a> : null}

        <div className="flex items-center justify-between gap-3 border-t pt-4 theme-border">
          <p className="text-xs theme-muted">{profile.updatedAt ? `${t("payouts.lastUpdated")}: ${formatTradeDateTime(profile.updatedAt, locale)}` : ""}</p>
          <button type="button" onClick={() => void save()} disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white disabled:opacity-60"><Save className="size-4" />{saving ? t("payouts.saving") : t("payouts.save")}</button>
        </div>
      </div>
    </section>
  );
}

function Label({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid gap-1.5 text-sm font-medium theme-foreground"><span>{label}</span>{children}</label>;
}
