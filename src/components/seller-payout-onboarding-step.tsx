"use client";

import { Landmark, Loader2, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";

import { useI18n } from "@/components/i18n-provider";
import { withLocale } from "@/lib/i18n";
import { payoutProfileStatusLabel } from "@/lib/trade-order-i18n";

type Bank = {
  id: string;
  bankNameLocal: string;
  bankNameEnglish: string;
};

type PayoutProfile = {
  bankDirectoryId: string | null;
  accountHolder: string;
  accountNumberLast4: string | null;
  accountNumberMasked: string | null;
  accountBelongsToCompany: boolean;
  status: string;
};

type PayoutForm = {
  bankDirectoryId: string;
  accountHolder: string;
  accountBelongsToCompany: boolean;
  termsAccepted: boolean;
  privacyAccepted: boolean;
};

const inputClassName =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-zinc-100";

const initialForm: PayoutForm = {
  bankDirectoryId: "",
  accountHolder: "",
  accountBelongsToCompany: false,
  termsAccepted: false,
  privacyAccepted: false,
};

function asForm(profile: PayoutProfile): PayoutForm {
  return {
    ...initialForm,
    bankDirectoryId: profile.bankDirectoryId ?? "",
    accountHolder: profile.accountHolder,
    accountBelongsToCompany: profile.accountBelongsToCompany,
  };
}

function onlyAccountNumberCharacters(value: string) {
  return value.replace(/[^0-9-]/g, "");
}

export function SellerPayoutOnboardingStep({
  locale,
  completeOnboardingAfterSave = false,
  onSaved,
}: {
  locale: "en" | "ko";
  completeOnboardingAfterSave?: boolean;
  onSaved?: () => void | Promise<void>;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const copy = {
    label: t("payouts.informationTitle"),
    title: t("payouts.onboardingTitle"),
    description: t("payouts.onboardingDescription"),
    maintenance: t("payouts.onboardingMaintenance"),
    loadError: t("payouts.loadError"),
    bankLoadError: t("payouts.bankLoadError"),
    noBanksAvailable: t("payouts.noBanksAvailable"),
    loadingBanks: t("payouts.loadingBanks"),
    saveError: t("payouts.saveError"),
    requiredConsents: t("payouts.requiredConsents"),
    completeError: t("payouts.onboardingCompleteError"),
    saved: t("payouts.onboardingSaved"),
    country: t("payouts.country"),
    korea: t("payouts.korea"),
    bank: t("payouts.bank"),
    selectBank: t("payouts.selectBank"),
    accountHolder: t("payouts.accountHolder"),
    accountNumber: t("payouts.accountNumber"),
    replaceAccountNumber: t("payouts.replaceAccountNumber"),
    payoutCurrency: t("payouts.payoutCurrency"),
    accountConfirmation: t("payouts.accountBelongsToCompany"),
    save: t("payouts.saveInformation"),
    saving: t("payouts.saving"),
    savedAccount: t("payouts.savedAccount"),
  };
  const [form, setForm] = useState<PayoutForm>(initialForm);
  const [profile, setProfile] = useState<PayoutProfile | null>(null);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [accountNumber, setAccountNumber] = useState("");
  const [loading, setLoading] = useState(true);
  const [banksLoading, setBanksLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [maintenance, setMaintenance] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;

    void fetch("/api/account/payout-profile", { cache: "no-store" })
      .then(async (response) => ({
        response,
        data: (await response.json().catch(() => null)) as
          | { profile?: PayoutProfile | null }
          | null,
      }))
      .then(({ response, data }) => {
        if (!active) return;
        if (!response.ok) {
          setMaintenance(response.status === 503);
          setError(response.status === 503 ? copy.maintenance : copy.loadError);
          return;
        }
        if (data?.profile) {
          setProfile(data.profile);
          setForm(asForm(data.profile));
        }
      })
      .catch(() => active && setError(copy.loadError))
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, [copy.loadError, copy.maintenance]);

  useEffect(() => {
    let active = true;
    void fetch("/api/account/payout-banks", { cache: "no-store" })
      .then(async (response) => ({ response, data: await response.json().catch(() => null) }))
      .then(({ response, data }) => {
        if (!active) return;
        if (!response.ok) {
          setError(copy.bankLoadError);
          return;
        }
        setBanks(data?.banks ?? []);
      })
      .catch(() => active && setError(copy.bankLoadError))
      .finally(() => active && setBanksLoading(false));

    return () => {
      active = false;
    };
  }, [copy.bankLoadError]);

  function update<K extends keyof PayoutForm>(key: K, value: PayoutForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
    setNotice("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || maintenance) return;
    if (!form.accountBelongsToCompany || !form.termsAccepted || !form.privacyAccepted) {
      setError(copy.requiredConsents);
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
          bankDirectoryId: form.bankDirectoryId,
          accountHolder: form.accountHolder,
          ...(accountNumber ? { accountNumber } : {}),
          accountType: "LOCAL",
          payoutCurrency: "krw",
          supportedCurrencies: ["krw"],
          accountBelongsToCompany: form.accountBelongsToCompany,
          termsAccepted: form.termsAccepted,
          privacyAccepted: form.privacyAccepted,
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | { profile?: PayoutProfile }
        | null;
      if (!response.ok || !data?.profile) {
        setMaintenance(response.status === 503);
        setError(response.status === 503 ? copy.maintenance : copy.saveError);
        return;
      }

      setProfile(data.profile);
      setForm(asForm(data.profile));
      setAccountNumber("");
      setNotice(copy.saved);

      if (completeOnboardingAfterSave) {
        const onboardingResponse = await fetch("/api/user/onboarding", { method: "POST" });
        if (!onboardingResponse.ok) {
          const onboardingData = (await onboardingResponse.json().catch(() => null)) as
            | { error?: string }
            | null;
          setError(onboardingData?.error ?? copy.completeError);
          return;
        }
        router.push(withLocale("/dashboard/seller", locale));
        return;
      }

      await onSaved?.();
    } catch {
      setError(copy.saveError);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-56 items-center justify-center">
        <Loader2 className="size-5 animate-spin theme-muted" aria-label={t("payouts.loading")} />
      </div>
    );
  }

  return (
    <section className="grid gap-5 rounded-2xl border p-5 theme-surface-elevated">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full border theme-surface-muted">
          <Landmark className="size-5 theme-success-text" aria-hidden="true" />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.16em] theme-success-text">{copy.label}</p>
          <h2 className="mt-1 text-xl font-semibold theme-foreground">{copy.title}</h2>
          <p className="mt-2 text-sm leading-6 theme-muted">{copy.description}</p>
          {profile?.accountNumberMasked ? (
            <p className="mt-2 text-sm font-medium theme-foreground">
              {copy.savedAccount}: {profile.accountNumberMasked}
              {profile.accountNumberLast4 ? ` (${profile.accountNumberLast4})` : ""}
            </p>
          ) : null}
        </div>
      </div>

      {error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      {notice ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p> : null}

      <form className="grid gap-4" onSubmit={submit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={copy.country}>
            <input value={copy.korea} readOnly className={inputClassName} aria-readonly="true" />
          </Field>
          <Field label={copy.bank}>
            <select
              value={form.bankDirectoryId}
              onChange={(event) => update("bankDirectoryId", event.target.value)}
              className={inputClassName}
              required
              disabled={maintenance || saving || banksLoading || banks.length === 0}
            >
              <option value="">{banksLoading ? copy.loadingBanks : copy.selectBank}</option>
              {banks.map((bank) => (
                <option key={bank.id} value={bank.id}>
                  {bank.bankNameEnglish} ({bank.bankNameLocal})
                </option>
              ))}
            </select>
            {!banksLoading && banks.length === 0 ? <span className="text-xs text-red-700">{copy.noBanksAvailable}</span> : null}
          </Field>
          <Field label={copy.accountHolder}>
            <input value={form.accountHolder} onChange={(event) => update("accountHolder", event.target.value)} className={inputClassName} required maxLength={240} disabled={maintenance || saving} />
          </Field>
          <Field label={profile?.accountNumberMasked ? copy.replaceAccountNumber : copy.accountNumber}>
            <input
              value={accountNumber}
              onChange={(event) => setAccountNumber(onlyAccountNumberCharacters(event.target.value))}
              className={inputClassName}
              autoComplete="off"
              inputMode="numeric"
              pattern="[0-9-]*"
              minLength={profile?.accountNumberMasked ? undefined : 4}
              maxLength={127}
              required={!profile?.accountNumberMasked}
              disabled={maintenance || saving}
            />
          </Field>
          <Field label={copy.payoutCurrency}>
            <input value="KRW" readOnly className={inputClassName} aria-readonly="true" />
          </Field>
        </div>

        <ConsentCheckbox
          checked={form.accountBelongsToCompany}
          disabled={maintenance || saving}
          onChange={(checked) => update("accountBelongsToCompany", checked)}
        >
          {copy.accountConfirmation}
        </ConsentCheckbox>
        <ConsentCheckbox checked={form.termsAccepted} disabled={maintenance || saving} onChange={(checked) => update("termsAccepted", checked)}>
          {locale === "ko" ? <><a href={withLocale("/terms", locale)} target="_blank" rel="noopener noreferrer" className="underline">이용약관</a>에 동의합니다. (필수)</> : <>I agree to the <a href={withLocale("/terms", locale)} target="_blank" rel="noopener noreferrer" className="underline">Terms of Service</a>. (Required)</>}
        </ConsentCheckbox>
        <ConsentCheckbox checked={form.privacyAccepted} disabled={maintenance || saving} onChange={(checked) => update("privacyAccepted", checked)}>
          {locale === "ko" ? <><a href={withLocale("/privacy", locale)} target="_blank" rel="noopener noreferrer" className="underline">개인정보처리방침</a>을 확인했습니다. (필수)</> : <>I acknowledge the <a href={withLocale("/privacy", locale)} target="_blank" rel="noopener noreferrer" className="underline">Privacy Policy</a>. (Required)</>}
        </ConsentCheckbox>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4 theme-border">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium theme-muted">
            <ShieldCheck className="size-4 theme-success-text" aria-hidden="true" />
            {payoutProfileStatusLabel(profile?.status ?? "PENDING_VERIFICATION", t)}
          </span>
          <button type="submit" disabled={saving || maintenance || banksLoading || banks.length === 0} className="inline-flex h-10 items-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
            {saving ? copy.saving : copy.save}
          </button>
        </div>
      </form>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid gap-1.5 text-sm font-medium theme-foreground"><span>{label}</span>{children}</label>;
}

function ConsentCheckbox({ checked, disabled, onChange, children }: { checked: boolean; disabled: boolean; onChange: (checked: boolean) => void; children: ReactNode }) {
  return <label className="flex items-start gap-3 rounded-lg border p-3 text-sm theme-surface-muted"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1" required disabled={disabled} /><span>{children}</span></label>;
}
