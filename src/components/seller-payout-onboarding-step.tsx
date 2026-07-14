"use client";

import { Landmark, Loader2, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";

import { getCountryCodeOptions } from "@/lib/company-select-options";
import { withLocale } from "@/lib/i18n";

type AccountType = "LOCAL" | "FOREIGN_CURRENCY" | "IBAN" | "OTHER";

type PayoutProfile = {
  country: string;
  bankName: string;
  branchName: string | null;
  accountHolder: string;
  accountNumberLast4: string | null;
  accountNumberMasked: string | null;
  accountType: AccountType;
  bankCode: string | null;
  swiftBic: string | null;
  bankAddress: string | null;
  beneficiaryAddress: string | null;
  payoutCurrency: string;
  intermediaryBankName: string | null;
  intermediaryBankSwift: string | null;
  intermediaryBankAddress: string | null;
  payoutMemo: string | null;
  accountBelongsToCompany: boolean;
  status: string;
};

type PayoutForm = {
  country: string;
  bankName: string;
  branchName: string;
  accountHolder: string;
  accountType: AccountType;
  bankCode: string;
  swiftBic: string;
  bankAddress: string;
  beneficiaryAddress: string;
  payoutCurrency: string;
  intermediaryBankName: string;
  intermediaryBankSwift: string;
  intermediaryBankAddress: string;
  payoutMemo: string;
  accountBelongsToCompany: boolean;
};

const initialForm: PayoutForm = {
  country: "KR",
  bankName: "",
  branchName: "",
  accountHolder: "",
  accountType: "LOCAL",
  bankCode: "",
  swiftBic: "",
  bankAddress: "",
  beneficiaryAddress: "",
  payoutCurrency: "usd",
  intermediaryBankName: "",
  intermediaryBankSwift: "",
  intermediaryBankAddress: "",
  payoutMemo: "",
  accountBelongsToCompany: false,
};

function asForm(profile: PayoutProfile): PayoutForm {
  return {
    country: profile.country,
    bankName: profile.bankName,
    branchName: profile.branchName ?? "",
    accountHolder: profile.accountHolder,
    accountType: profile.accountType,
    bankCode: profile.bankCode ?? "",
    swiftBic: profile.swiftBic ?? "",
    bankAddress: profile.bankAddress ?? "",
    beneficiaryAddress: profile.beneficiaryAddress ?? "",
    payoutCurrency: profile.payoutCurrency,
    intermediaryBankName: profile.intermediaryBankName ?? "",
    intermediaryBankSwift: profile.intermediaryBankSwift ?? "",
    intermediaryBankAddress: profile.intermediaryBankAddress ?? "",
    payoutMemo: profile.payoutMemo ?? "",
    accountBelongsToCompany: profile.accountBelongsToCompany,
  };
}

function text(value: string) {
  return value.trim() || undefined;
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
  const korean = locale === "ko";
  const copy = korean
    ? {
        label: "정산 정보",
        title: "정산 계좌 정보를 입력하세요",
        description:
          "정산 계좌 정보는 암호화되어 저장됩니다. 저장 후에는 마스킹된 계좌 정보만 표시됩니다.",
        maintenance:
          "정산 정보 기능이 현재 점검 중입니다. 점검이 끝나기 전에는 셀러 가입을 완료할 수 없습니다.",
        loadError: "정산 정보를 불러올 수 없습니다.",
        saveError: "정산 정보를 저장할 수 없습니다.",
        completeError: "정산 정보를 저장했지만 셀러 가입을 완료하지 못했습니다. 다시 시도해 주세요.",
        saved: "정산 정보가 저장되었습니다. 관리자 확인 전까지는 미확인 상태로 유지됩니다.",
        country: "국가",
        bankName: "은행명",
        accountHolder: "예금주명",
        accountNumber: "계좌번호 또는 IBAN",
        replaceAccountNumber: "계좌번호 변경",
        accountType: "계좌 유형",
        payoutCurrency: "정산 통화",
        accountConfirmation: "이 계좌가 셀러 회사 또는 승인된 수취인에게 속해 있음을 확인합니다.",
        optional: "선택 정보",
        branchName: "지점명",
        bankCode: "은행 코드",
        swift: "SWIFT / BIC",
        bankAddress: "은행 주소",
        beneficiaryAddress: "수취인 주소",
        intermediaryName: "중개 은행명",
        intermediarySwift: "중개 은행 SWIFT",
        intermediaryAddress: "중개 은행 주소",
        payoutMemo: "정산 메모",
        save: "정산 정보 저장",
        saving: "저장 중...",
        savedAccount: "저장된 계좌",
        status: "확인 대기",
        local: "일반 계좌",
        foreign: "외화 계좌",
        iban: "IBAN",
        other: "기타",
        selectCountry: "국가 선택",
      }
    : {
        label: "Payout information",
        title: "Add your payout bank information",
        description:
          "Payout instructions are encrypted at rest. Only masked account information is shown after saving.",
        maintenance:
          "Payout information is temporarily unavailable. Seller onboarding cannot be completed until maintenance ends.",
        loadError: "Unable to load payout information.",
        saveError: "Unable to save payout information.",
        completeError:
          "Payout information was saved, but seller onboarding could not be completed. Please try again.",
        saved:
          "Payout information saved. It remains unverified until an administrator reviews it.",
        country: "Country",
        bankName: "Bank name",
        accountHolder: "Account holder name",
        accountNumber: "Account number or IBAN",
        replaceAccountNumber: "Replace account number",
        accountType: "Account type",
        payoutCurrency: "Payout currency",
        accountConfirmation:
          "I confirm this account belongs to the seller company or an authorized beneficiary.",
        optional: "Optional information",
        branchName: "Branch name",
        bankCode: "Bank code",
        swift: "SWIFT / BIC",
        bankAddress: "Bank address",
        beneficiaryAddress: "Beneficiary address",
        intermediaryName: "Intermediary bank name",
        intermediarySwift: "Intermediary bank SWIFT",
        intermediaryAddress: "Intermediary bank address",
        payoutMemo: "Payout memo",
        save: "Save payout information",
        saving: "Saving...",
        savedAccount: "Saved account",
        status: "Pending verification",
        local: "Local account",
        foreign: "Foreign currency account",
        iban: "IBAN",
        other: "Other",
        selectCountry: "Select country",
      };
  const countries = useMemo(() => getCountryCodeOptions(locale), [locale]);
  const [form, setForm] = useState<PayoutForm>(initialForm);
  const [profile, setProfile] = useState<PayoutProfile | null>(null);
  const [accountNumber, setAccountNumber] = useState("");
  const [loading, setLoading] = useState(true);
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
          | { profile?: PayoutProfile | null; error?: string }
          | null,
      }))
      .then(({ response, data }) => {
        if (!active) return;
        if (!response.ok) {
          setMaintenance(response.status === 503);
          setError(
            response.status === 503
              ? copy.maintenance
              : data?.error ?? copy.loadError,
          );
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

  function update<K extends keyof PayoutForm>(key: K, value: PayoutForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
    setNotice("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || maintenance) return;

    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/account/payout-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          country: form.country,
          bankName: form.bankName,
          branchName: text(form.branchName),
          accountHolder: form.accountHolder,
          ...(accountNumber ? { accountNumber } : {}),
          accountType: form.accountType,
          bankCode: text(form.bankCode),
          swiftBic: text(form.swiftBic),
          bankAddress: text(form.bankAddress),
          beneficiaryAddress: text(form.beneficiaryAddress),
          payoutCurrency: form.payoutCurrency,
          supportedCurrencies: [form.payoutCurrency],
          intermediaryBankName: text(form.intermediaryBankName),
          intermediaryBankSwift: text(form.intermediaryBankSwift),
          intermediaryBankAddress: text(form.intermediaryBankAddress),
          payoutMemo: text(form.payoutMemo),
          accountBelongsToCompany: form.accountBelongsToCompany,
          manualBankOverride: false,
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | { profile?: PayoutProfile; error?: string }
        | null;
      if (!response.ok || !data?.profile) {
        setMaintenance(response.status === 503);
        setError(
          response.status === 503
            ? copy.maintenance
            : data?.error ?? copy.saveError,
        );
        return;
      }

      setProfile(data.profile);
      setForm(asForm(data.profile));
      setAccountNumber("");
      setNotice(copy.saved);

      if (completeOnboardingAfterSave) {
        const onboardingResponse = await fetch("/api/user/onboarding", {
          method: "POST",
        });
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
        <Loader2 className="size-5 animate-spin theme-muted" aria-label="Loading" />
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
          <p className="text-xs font-semibold uppercase tracking-[.16em] theme-success-text">
            {copy.label}
          </p>
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

      {error ? (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </p>
      ) : null}

      <form className="grid gap-4" onSubmit={submit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={copy.country}>
            <select
              value={form.country}
              onChange={(event) => update("country", event.target.value)}
              className="input"
              required
              disabled={maintenance || saving}
            >
              <option value="">{copy.selectCountry}</option>
              {countries.map((country) => (
                <option key={country.value} value={country.value}>
                  {country.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label={copy.bankName}>
            <input value={form.bankName} onChange={(event) => update("bankName", event.target.value)} className="input" required maxLength={240} disabled={maintenance || saving} />
          </Field>
          <Field label={copy.accountHolder}>
            <input value={form.accountHolder} onChange={(event) => update("accountHolder", event.target.value)} className="input" required maxLength={240} disabled={maintenance || saving} />
          </Field>
          <Field label={profile?.accountNumberMasked ? copy.replaceAccountNumber : copy.accountNumber}>
            <input value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} className="input" autoComplete="off" inputMode="text" minLength={profile?.accountNumberMasked ? undefined : 4} maxLength={64} required={!profile?.accountNumberMasked} disabled={maintenance || saving} />
          </Field>
          <Field label={copy.accountType}>
            <select value={form.accountType} onChange={(event) => update("accountType", event.target.value as AccountType)} className="input" required disabled={maintenance || saving}>
              <option value="LOCAL">{copy.local}</option>
              <option value="FOREIGN_CURRENCY">{copy.foreign}</option>
              <option value="IBAN">{copy.iban}</option>
              <option value="OTHER">{copy.other}</option>
            </select>
          </Field>
          <Field label={copy.payoutCurrency}>
            <input value={form.payoutCurrency} onChange={(event) => update("payoutCurrency", event.target.value.toLowerCase())} className="input" required minLength={3} maxLength={3} pattern="[A-Za-z]{3}" disabled={maintenance || saving} />
          </Field>
        </div>

        <label className="flex items-start gap-3 rounded-lg border p-3 text-sm theme-surface-muted">
          <input type="checkbox" checked={form.accountBelongsToCompany} onChange={(event) => update("accountBelongsToCompany", event.target.checked)} className="mt-1" required disabled={maintenance || saving} />
          <span>{copy.accountConfirmation}</span>
        </label>

        <details className="rounded-lg border p-4 theme-surface-muted">
          <summary className="cursor-pointer text-sm font-medium theme-foreground">{copy.optional}</summary>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label={copy.branchName}><input value={form.branchName} onChange={(event) => update("branchName", event.target.value)} className="input" maxLength={240} disabled={maintenance || saving} /></Field>
            <Field label={copy.bankCode}><input value={form.bankCode} onChange={(event) => update("bankCode", event.target.value)} className="input" maxLength={80} disabled={maintenance || saving} /></Field>
            <Field label={copy.swift}><input value={form.swiftBic} onChange={(event) => update("swiftBic", event.target.value)} className="input" maxLength={80} disabled={maintenance || saving} /></Field>
            <Field label={copy.bankAddress}><input value={form.bankAddress} onChange={(event) => update("bankAddress", event.target.value)} className="input" maxLength={600} disabled={maintenance || saving} /></Field>
            <Field label={copy.beneficiaryAddress}><input value={form.beneficiaryAddress} onChange={(event) => update("beneficiaryAddress", event.target.value)} className="input" maxLength={600} disabled={maintenance || saving} /></Field>
            <Field label={copy.intermediaryName}><input value={form.intermediaryBankName} onChange={(event) => update("intermediaryBankName", event.target.value)} className="input" maxLength={240} disabled={maintenance || saving} /></Field>
            <Field label={copy.intermediarySwift}><input value={form.intermediaryBankSwift} onChange={(event) => update("intermediaryBankSwift", event.target.value)} className="input" maxLength={80} disabled={maintenance || saving} /></Field>
            <Field label={copy.intermediaryAddress}><input value={form.intermediaryBankAddress} onChange={(event) => update("intermediaryBankAddress", event.target.value)} className="input" maxLength={600} disabled={maintenance || saving} /></Field>
          </div>
          <Field label={copy.payoutMemo} className="mt-4"><textarea value={form.payoutMemo} onChange={(event) => update("payoutMemo", event.target.value)} className="input min-h-20" maxLength={600} disabled={maintenance || saving} /></Field>
        </details>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4 theme-border">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium theme-muted">
            <ShieldCheck className="size-4 theme-success-text" aria-hidden="true" />
            {copy.status}
          </span>
          <button type="submit" disabled={saving || maintenance} className="inline-flex h-10 items-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
            {saving ? copy.saving : copy.save}
          </button>
        </div>
      </form>
    </section>
  );
}

function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return <label className={`grid gap-1.5 text-sm font-medium theme-foreground ${className}`}><span>{label}</span>{children}</label>;
}
