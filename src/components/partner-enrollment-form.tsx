"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { useI18n } from "@/components/i18n-provider";
import { withLocale } from "@/lib/i18n";

type PartnerBank = {
  id: string;
  bankNameLocal: string;
  bankNameEnglish: string;
};

type PartnerEnrollmentFormProps = {
  initial: {
    fullName: string;
    email: string;
    phone: string;
    preferredLanguage: "en" | "ko";
    banks: PartnerBank[];
    bankDirectoryId: string;
    accountHolder: string;
  };
};

const fieldClassName = "mt-1 h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200";

export function PartnerEnrollmentForm({ initial }: PartnerEnrollmentFormProps) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const body = {
      fullName: form.get("fullName"),
      phone: form.get("phone"),
      preferredLanguage: form.get("preferredLanguage"),
      country: "KR",
      bankDirectoryId: form.get("bankDirectoryId"),
      accountHolder: form.get("accountHolder"),
      accountNumber: form.get("accountNumber"),
      accountType: "LOCAL",
      payoutCurrency: "krw",
      supportedCurrencies: ["krw"],
      accountBelongsToPartner: form.get("accountBelongsToPartner") === "on",
      agreeToTerms: form.get("agreeToTerms") === "on",
      acknowledgePayoutTerms: form.get("acknowledgePayoutTerms") === "on",
      acknowledgePrivacy: form.get("acknowledgePrivacy") === "on",
    };

    try {
      const response = await fetch("/api/partner/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(payload?.error ?? t("partnerProgram.enrollError"));
        return;
      }
      router.replace(withLocale("/partner/dashboard?joined=1", locale));
      router.refresh();
    } catch {
      setError(t("partnerProgram.enrollError"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="grid gap-5">
      <div className="rounded-md border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-700">
        {t("partnerProgram.koreanPayoutNotice")}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium theme-foreground">
          {t("partnerProgram.fullName")}
          <input className={fieldClassName} name="fullName" defaultValue={initial.fullName} required maxLength={160} autoComplete="name" />
        </label>
        <label className="text-sm font-medium theme-foreground">
          {t("partnerProgram.email")}
          <input className={`${fieldClassName} cursor-not-allowed`} type="email" value={initial.email} readOnly aria-readonly="true" />
          <span className="mt-1 block text-xs theme-muted">{t("partnerProgram.emailFromAccount")}</span>
        </label>
        <label className="text-sm font-medium theme-foreground">
          {t("partnerProgram.phone")}
          <input className={fieldClassName} type="tel" name="phone" defaultValue={initial.phone} required maxLength={50} autoComplete="tel" />
        </label>
        <label className="text-sm font-medium theme-foreground">
          {t("partnerProgram.preferredLanguage")}
          <select className={fieldClassName} name="preferredLanguage" defaultValue={initial.preferredLanguage}>
            <option value="en">English</option>
            <option value="ko">한국어</option>
          </select>
        </label>
      </div>

      <fieldset className="grid gap-4 border-t pt-5 theme-border">
        <legend className="text-base font-semibold theme-foreground">{t("partnerProgram.payoutInformationTitle")}</legend>
        <label className="text-sm font-medium theme-foreground">
          {t("partnerProgram.country")}
          <input className={`${fieldClassName} cursor-not-allowed`} value={locale === "ko" ? "대한민국" : "South Korea"} readOnly aria-readonly="true" />
        </label>
        <label className="text-sm font-medium theme-foreground">
          {t("partnerProgram.bankName")}
          <select className={fieldClassName} name="bankDirectoryId" defaultValue={initial.bankDirectoryId} required>
            <option value="">{t("partnerProgram.selectBank")}</option>
            {initial.banks.map((bank) => (
              <option key={bank.id} value={bank.id}>{bank.bankNameLocal} · {bank.bankNameEnglish}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium theme-foreground">
          {t("partnerProgram.accountHolder")}
          <input className={fieldClassName} name="accountHolder" defaultValue={initial.accountHolder} required maxLength={240} autoComplete="name" />
        </label>
        <label className="text-sm font-medium theme-foreground">
          {t("partnerProgram.accountNumber")}
          <input className={fieldClassName} name="accountNumber" required maxLength={128} inputMode="numeric" pattern="[0-9\\s-]{4,128}" autoComplete="off" />
        </label>
      </fieldset>

      <fieldset className="grid gap-3 border-t pt-5 theme-border">
        <legend className="text-base font-semibold theme-foreground">{t("partnerProgram.requiredAcknowledgements")}</legend>
        <label className="flex items-start gap-3 text-sm theme-foreground">
          <input className="mt-1 size-4" type="checkbox" name="accountBelongsToPartner" required />
          <span>{t("partnerProgram.accountBelongsToPartner")} <span className="theme-muted">({t("partnerProgram.required")})</span></span>
        </label>
        <label className="flex items-start gap-3 text-sm theme-foreground">
          <input className="mt-1 size-4" type="checkbox" name="agreeToTerms" required />
          <span>{t("partnerProgram.agreeTermsPrefix")} <Link className="font-semibold text-[#25825f] underline" href={withLocale("/terms", locale)} target="_blank" rel="noopener noreferrer">{t("partnerProgram.partnerTerms")}</Link> <span className="theme-muted">({t("partnerProgram.required")})</span></span>
        </label>
        <label className="flex items-start gap-3 text-sm theme-foreground">
          <input className="mt-1 size-4" type="checkbox" name="acknowledgePayoutTerms" required />
          <span>{t("partnerProgram.payoutTermsAcknowledgement")} <Link className="font-semibold text-[#25825f] underline" href={withLocale("/payment-refund-policy", locale)} target="_blank" rel="noopener noreferrer">{t("partnerProgram.payoutTerms")}</Link> <span className="theme-muted">({t("partnerProgram.required")})</span></span>
        </label>
        <label className="flex items-start gap-3 text-sm theme-foreground">
          <input className="mt-1 size-4" type="checkbox" name="acknowledgePrivacy" required />
          <span>{t("partnerProgram.acknowledgePrivacyPrefix")} <Link className="font-semibold text-[#25825f] underline" href={withLocale("/privacy", locale)} target="_blank" rel="noopener noreferrer">{t("partnerProgram.privacyPolicy")}</Link> <span className="theme-muted">({t("partnerProgram.required")})</span></span>
        </label>
      </fieldset>

      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      <button type="submit" disabled={submitting} className="h-10 w-fit rounded-md px-4 text-sm font-semibold theme-primary-button disabled:cursor-wait disabled:opacity-60">
        {submitting ? t("partnerProgram.creatingProfile") : t("partnerProgram.createProfile")}
      </button>
    </form>
  );
}
