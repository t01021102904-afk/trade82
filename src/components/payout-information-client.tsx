"use client";

import { Landmark, Loader2, Save, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";

import { useI18n } from "@/components/i18n-provider";
import { withLocale } from "@/lib/i18n";
import {
  formatTradeDateTime,
  payoutProfileStatusLabel,
} from "@/lib/trade-order-i18n";

type Bank = {
  id: string;
  bankNameLocal: string;
  bankNameEnglish: string;
};

type Profile = {
  bankDirectoryId: string | null;
  accountHolder: string;
  accountNumberMasked: string | null;
  accountBelongsToCompany: boolean;
  status: string;
  updatedAt: string;
};

const inputClassName =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-zinc-100";

const emptyProfile: Profile = {
  bankDirectoryId: null,
  accountHolder: "",
  accountNumberMasked: null,
  accountBelongsToCompany: false,
  status: "DRAFT",
  updatedAt: "",
};

function onlyAccountNumberCharacters(value: string) {
  return value.replace(/[^0-9-]/g, "");
}

export function PayoutInformationClient({ locale: pageLocale }: { locale?: "en" | "ko" }) {
  const { locale: contextLocale, t } = useI18n();
  const locale = pageLocale ?? contextLocale;
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [accountNumber, setAccountNumber] = useState("");
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);
  const [banksLoading, setBanksLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
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
    let active = true;
    void fetch("/api/account/payout-banks", { cache: "no-store" })
      .then(async (response) => ({ response, data: await response.json().catch(() => null) }))
      .then(({ response, data }) => {
        if (!active) return;
        if (!response.ok) {
          setError(t("payouts.bankLoadError"));
          return;
        }
        setBanks(data?.banks ?? []);
      })
      .catch(() => active && setError(t("payouts.bankLoadError")))
      .finally(() => active && setBanksLoading(false));

    return () => {
      active = false;
    };
  }, [t]);

  function update<K extends keyof Profile>(key: K, value: Profile[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
    setError("");
    setNotice("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    if (!profile.accountBelongsToCompany || !termsAccepted || !privacyAccepted) {
      setError(t("payouts.requiredConsents"));
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/account/payout-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          country: "KR",
          bankDirectoryId: profile.bankDirectoryId,
          accountHolder: profile.accountHolder,
          ...(accountNumber ? { accountNumber } : {}),
          accountType: "LOCAL",
          payoutCurrency: "krw",
          supportedCurrencies: ["krw"],
          accountBelongsToCompany: profile.accountBelongsToCompany,
          termsAccepted,
          privacyAccepted,
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

      <form className="grid gap-5 rounded-2xl border p-5 theme-surface-elevated" onSubmit={save}>
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
          <Label label={t("payouts.country")}><input value={t("payouts.korea")} readOnly className={inputClassName} aria-readonly="true" /></Label>
          <Label label={t("payouts.bank")}>
            <select value={profile.bankDirectoryId ?? ""} onChange={(event) => update("bankDirectoryId", event.target.value || null)} className={inputClassName} required disabled={saving || banksLoading || banks.length === 0}>
              <option value="">{banksLoading ? t("payouts.loadingBanks") : t("payouts.selectBank")}</option>
              {banks.map((bank) => <option key={bank.id} value={bank.id}>{bank.bankNameEnglish} ({bank.bankNameLocal})</option>)}
            </select>
            {!banksLoading && banks.length === 0 ? <span className="text-xs text-red-700">{t("payouts.noBanksAvailable")}</span> : null}
          </Label>
          <Label label={t("payouts.accountHolder")}><input value={profile.accountHolder} onChange={(event) => update("accountHolder", event.target.value)} className={inputClassName} required maxLength={240} disabled={saving} /></Label>
          <Label label={profile.accountNumberMasked ? t("payouts.replaceAccountNumber") : t("payouts.accountNumber")}><input value={accountNumber} onChange={(event) => setAccountNumber(onlyAccountNumberCharacters(event.target.value))} autoComplete="off" inputMode="numeric" pattern="[0-9-]*" className={inputClassName} placeholder={profile.accountNumberMasked ?? ""} minLength={profile.accountNumberMasked ? undefined : 4} maxLength={127} required={!profile.accountNumberMasked} disabled={saving} /></Label>
          <Label label={t("payouts.payoutCurrency")}><input value="KRW" readOnly className={inputClassName} aria-readonly="true" /></Label>
        </div>

        <ConsentCheckbox checked={profile.accountBelongsToCompany} disabled={saving} onChange={(checked) => update("accountBelongsToCompany", checked)}>{t("payouts.accountBelongsToCompany")}</ConsentCheckbox>
        <ConsentCheckbox checked={termsAccepted} disabled={saving} onChange={setTermsAccepted}>{locale === "ko" ? <><a href={withLocale("/terms", locale)} target="_blank" rel="noopener noreferrer" className="underline">이용약관</a>에 동의합니다. (필수)</> : <>I agree to the <a href={withLocale("/terms", locale)} target="_blank" rel="noopener noreferrer" className="underline">Terms of Service</a>. (Required)</>}</ConsentCheckbox>
        <ConsentCheckbox checked={privacyAccepted} disabled={saving} onChange={setPrivacyAccepted}>{locale === "ko" ? <><a href={withLocale("/privacy", locale)} target="_blank" rel="noopener noreferrer" className="underline">개인정보처리방침</a>을 확인했습니다. (필수)</> : <>I acknowledge the <a href={withLocale("/privacy", locale)} target="_blank" rel="noopener noreferrer" className="underline">Privacy Policy</a>. (Required)</>}</ConsentCheckbox>

        <div className="flex items-center justify-between gap-3 border-t pt-4 theme-border">
          <p className="text-xs theme-muted">{profile.updatedAt ? `${t("payouts.lastUpdated")}: ${formatTradeDateTime(profile.updatedAt, locale)}` : ""}</p>
          <button type="submit" disabled={saving || banksLoading || banks.length === 0} className="inline-flex h-10 items-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white disabled:opacity-60"><Save className="size-4" />{saving ? t("payouts.saving") : t("payouts.save")}</button>
        </div>
      </form>
    </section>
  );
}

function Label({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid gap-1.5 text-sm font-medium theme-foreground"><span>{label}</span>{children}</label>;
}

function ConsentCheckbox({ checked, disabled, onChange, children }: { checked: boolean; disabled: boolean; onChange: (checked: boolean) => void; children: ReactNode }) {
  return <label className="flex items-start gap-3 rounded-lg border p-3 text-sm theme-surface-muted"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1" required disabled={disabled} /><span>{children}</span></label>;
}
