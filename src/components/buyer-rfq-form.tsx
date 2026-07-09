"use client";

import { FormEvent, type ReactNode, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useI18n } from "@/components/i18n-provider";
import {
  getBuyerCategoryOptions,
  getCountryOptions,
} from "@/lib/company-select-options";
import { withLocale } from "@/lib/i18n";
import {
  currencyOptions,
  emptyRfqFormValue,
  rfqFormValueFromRecord,
  sourcingPurposeOptions,
  sourcingTypeOptions,
  tradeTermOptions,
  type RfqFormValue,
  type RfqRecord,
} from "@/lib/rfq";

type BuyerRfqFormProps = {
  rfq?: RfqRecord;
  mode?: "create" | "edit";
};

type ApiResult = { id?: string; error?: string };

export function BuyerRfqForm({ rfq, mode = "create" }: BuyerRfqFormProps) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [form, setForm] = useState<RfqFormValue>(() =>
    rfq ? rfqFormValueFromRecord(rfq) : emptyRfqFormValue,
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const detailsLength = form.details.length;
  const categoryOptions = useMemo(() => getBuyerCategoryOptions(locale), [locale]);
  const countryOptions = useMemo(() => getCountryOptions(locale), [locale]);

  function update<K extends keyof RfqFormValue>(key: K, value: RfqFormValue[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setSaved(false);
    setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setSaved(false);
    try {
      const response = await fetch(mode === "edit" && rfq ? `/api/rfqs/${rfq.id}` : "/api/rfqs", {
        method: mode === "edit" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = (await response.json().catch(() => null)) as ApiResult | null;
      if (!response.ok || !result) {
        setError(result?.error ?? t("rfq.saveFailed"));
        return;
      }
      setSaved(true);
      router.push(withLocale(`/dashboard/rfqs/${result.id}`, locale));
      router.refresh();
    } catch {
      setError(t("rfq.saveFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-5" noValidate>
      <FormSection title={t("rfq.basicRequest")}>
        <Field
          label={t("rfq.productName")}
          value={form.productName}
          onChange={(value) => update("productName", value)}
          required
        />
        <SelectField
          label={t("rfq.category")}
          value={form.category}
          onChange={(value) => update("category", value)}
          options={categoryOptions}
          placeholder={t("onboarding.select")}
          required
        />
        <SelectField
          label={t("rfq.sourcingType")}
          value={form.sourcingType}
          onChange={(value) => update("sourcingType", value)}
          options={sourcingTypeOptions(locale)}
          placeholder={t("onboarding.select")}
          required
        />
        <SelectField
          label={t("rfq.sourcingPurpose")}
          value={form.sourcingPurpose}
          onChange={(value) => update("sourcingPurpose", value)}
          options={sourcingPurposeOptions(locale)}
          placeholder={t("onboarding.select")}
        />
      </FormSection>

      <FormSection title={t("rfq.tradeConditions")}>
        <Field
          label={t("rfq.quantity")}
          value={form.quantity}
          onChange={(value) => update("quantity", value)}
          required
        />
        <SelectField
          label={t("rfq.tradeTerms")}
          value={form.tradeTerms}
          onChange={(value) => update("tradeTerms", value)}
          options={tradeTermOptions(locale)}
          placeholder={t("onboarding.select")}
          required
        />
        <SelectField
          label={t("rfq.destinationCountry")}
          value={form.destinationCountry}
          onChange={(value) => update("destinationCountry", value)}
          options={countryOptions}
          placeholder={t("onboarding.select")}
        />
        <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
          <Field
            label={t("rfq.preferredUnitPrice")}
            value={form.preferredUnitPriceAmount}
            onChange={(value) => update("preferredUnitPriceAmount", value)}
            inputMode="decimal"
          />
          <SelectField
            label={t("rfq.currency")}
            value={form.preferredUnitPriceCurrency}
            onChange={(value) =>
              update("preferredUnitPriceCurrency", value as "USD" | "KRW")
            }
            options={currencyOptions()}
          />
        </div>
        <Field
          label={t("rfq.targetDeliveryDate")}
          type="date"
          value={form.targetDeliveryDate}
          onChange={(value) => update("targetDeliveryDate", value)}
        />
      </FormSection>

      <FormSection title={t("rfq.productSpecifications")}>
        <Field label={t("rfq.shape")} value={form.shape} onChange={(value) => update("shape", value)} />
        <Field label={t("rfq.capacity")} value={form.capacity} onChange={(value) => update("capacity", value)} />
        <Field label={t("rfq.material")} value={form.material} onChange={(value) => update("material", value)} />
        <Field label={t("rfq.certification")} value={form.certification} onChange={(value) => update("certification", value)} />
        <Field label={t("rfq.feature")} value={form.feature} onChange={(value) => update("feature", value)} className="sm:col-span-2" />
      </FormSection>

      <section className="grid gap-4 rounded-2xl border p-5 theme-surface-elevated sm:grid-cols-2">
        <div className="sm:col-span-2">
          <h2 className="text-base font-semibold theme-foreground">
            {t("rfq.detailsAndAttachments")}
          </h2>
        </div>
        <label className="grid gap-1 text-sm sm:col-span-2">
          <span className="font-medium theme-foreground">
            {t("rfq.details")} <span className="text-red-600">*</span>
          </span>
          <textarea
            rows={6}
            maxLength={8000}
            value={form.details}
            onChange={(event) => update("details", event.target.value)}
            className="rounded-xl border px-3 py-2 text-sm outline-none transition theme-input focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
          />
          <span className="text-xs theme-muted">{detailsLength}/8000</span>
        </label>
        <div className="rounded-xl border border-dashed p-4 text-sm theme-surface sm:col-span-2">
          <p className="font-medium theme-foreground">{t("rfq.attachments")}</p>
          <p className="mt-1 text-xs leading-5 theme-muted">
            {t("rfq.attachmentsTodo")}
          </p>
        </div>
      </section>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex h-10 items-center rounded-lg px-4 text-sm font-semibold theme-primary-button disabled:opacity-60"
        >
          {submitting
            ? t("rfq.submitting")
            : mode === "edit"
              ? t("rfq.updateRfq")
              : t("rfq.submitRfq")}
        </button>
        {saved ? <span className="text-sm text-emerald-700">{t("settings.saved")}</span> : null}
      </div>
    </form>
  );
}

function FormSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-4 rounded-2xl border p-5 theme-surface-elevated sm:grid-cols-2">
      <div className="sm:col-span-2">
        <h2 className="text-base font-semibold theme-foreground">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  className,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "date";
  required?: boolean;
  className?: string;
  inputMode?: "decimal";
}) {
  return (
    <label className={`grid gap-1 text-sm ${className ?? ""}`}>
      <span className="font-medium theme-foreground">
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </span>
      <input
        type={type}
        value={value}
        required={required}
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-xl border px-3 text-sm outline-none transition theme-input focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium theme-foreground">
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </span>
      <select
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-xl border px-3 text-sm outline-none transition theme-input focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
