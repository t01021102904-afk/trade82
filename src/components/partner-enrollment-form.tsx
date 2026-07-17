"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { useI18n } from "@/components/i18n-provider";
import { withLocale } from "@/lib/i18n";

type PartnerEnrollmentFormProps = {
  initial: {
    legalName: string;
    displayName: string;
    email: string;
    phone: string;
    country: string;
    preferredLanguage: "en" | "ko";
    organizationName: string;
    websiteOrSocialUrl: string;
    promotionDescription: string;
  };
};

const fieldClassName = "mt-1 h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200";

export function PartnerEnrollmentForm({ initial }: PartnerEnrollmentFormProps) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const body = {
      legalName: form.get("legalName"),
      displayName: form.get("displayName"),
      email: form.get("email"),
      phone: form.get("phone"),
      country: form.get("country"),
      preferredLanguage: form.get("preferredLanguage"),
      organizationName: form.get("organizationName"),
      websiteOrSocialUrl: form.get("websiteOrSocialUrl"),
      promotionDescription: form.get("promotionDescription"),
      agreeToTerms: form.get("agreeToTerms") === "on",
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
      setSuccess(true);
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
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium theme-foreground">
          {t("partnerProgram.legalName")}
          <input className={fieldClassName} name="legalName" defaultValue={initial.legalName} required maxLength={160} autoComplete="name" />
        </label>
        <label className="text-sm font-medium theme-foreground">
          {t("partnerProgram.displayName")} <span className="theme-muted">({t("partnerProgram.optional")})</span>
          <input className={fieldClassName} name="displayName" defaultValue={initial.displayName} maxLength={120} />
        </label>
        <label className="text-sm font-medium theme-foreground">
          {t("partnerProgram.email")}
          <input className={fieldClassName} type="email" name="email" defaultValue={initial.email} required maxLength={320} autoComplete="email" />
        </label>
        <label className="text-sm font-medium theme-foreground">
          {t("partnerProgram.phone")}
          <input className={fieldClassName} type="tel" name="phone" defaultValue={initial.phone} required maxLength={50} autoComplete="tel" />
        </label>
        <label className="text-sm font-medium theme-foreground">
          {t("partnerProgram.country")}
          <input className={fieldClassName} name="country" defaultValue={initial.country} required maxLength={100} autoComplete="country-name" />
        </label>
        <label className="text-sm font-medium theme-foreground">
          {t("partnerProgram.preferredLanguage")}
          <select className={fieldClassName} name="preferredLanguage" defaultValue={initial.preferredLanguage}>
            <option value="en">English</option>
            <option value="ko">한국어</option>
          </select>
        </label>
      </div>

      <div className="grid gap-4 border-t pt-5 theme-border sm:grid-cols-2">
        <label className="text-sm font-medium theme-foreground">
          {t("partnerProgram.organizationName")} <span className="theme-muted">({t("partnerProgram.optional")})</span>
          <input className={fieldClassName} name="organizationName" defaultValue={initial.organizationName} maxLength={160} autoComplete="organization" />
        </label>
        <label className="text-sm font-medium theme-foreground">
          {t("partnerProgram.websiteOrSocialUrl")} <span className="theme-muted">({t("partnerProgram.optional")})</span>
          <input className={fieldClassName} type="url" name="websiteOrSocialUrl" defaultValue={initial.websiteOrSocialUrl} maxLength={500} placeholder="https://" />
        </label>
        <label className="text-sm font-medium theme-foreground sm:col-span-2">
          {t("partnerProgram.promotionDescription")} <span className="theme-muted">({t("partnerProgram.optional")})</span>
          <textarea className="mt-1 min-h-28 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" name="promotionDescription" defaultValue={initial.promotionDescription} maxLength={1500} />
        </label>
      </div>

      <fieldset className="grid gap-3 border-t pt-5 theme-border">
        <label className="flex items-start gap-3 text-sm theme-foreground">
          <input className="mt-1 size-4" type="checkbox" name="agreeToTerms" required />
          <span>{t("partnerProgram.agreeTermsPrefix")} <Link className="font-semibold text-[#25825f] underline" href={withLocale("/terms", locale)} target="_blank" rel="noopener noreferrer">{t("partnerProgram.partnerTerms")}</Link> <span className="theme-muted">({t("partnerProgram.required")})</span></span>
        </label>
        <label className="flex items-start gap-3 text-sm theme-foreground">
          <input className="mt-1 size-4" type="checkbox" name="acknowledgePrivacy" required />
          <span>{t("partnerProgram.acknowledgePrivacyPrefix")} <Link className="font-semibold text-[#25825f] underline" href={withLocale("/privacy", locale)} target="_blank" rel="noopener noreferrer">{t("partnerProgram.privacyPolicy")}</Link> <span className="theme-muted">({t("partnerProgram.required")})</span></span>
        </label>
      </fieldset>

      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      {success ? <p role="status" className="text-sm text-emerald-700">{t("partnerProgram.joinSuccess")}</p> : null}
      <div>
        <button type="submit" disabled={submitting} className="h-10 rounded-md px-4 text-sm font-semibold theme-primary-button disabled:cursor-wait disabled:opacity-60">
          {submitting ? t("partnerProgram.creatingProfile") : t("partnerProgram.createProfile")}
        </button>
      </div>
    </form>
  );
}
