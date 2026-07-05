"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { useI18n } from "@/components/i18n-provider";
import {
  emptyRichProductForm,
  productPayloadFromForm,
  RichProductFormFields,
  type RichProductFormErrors,
  type RichProductFormValue,
  validateRichProductForm,
} from "@/components/rich-product-form-fields";
import {
  useDraftBackup,
  useUnsavedChangesWarning,
} from "@/hooks/use-form-reliability";
import { withLocale } from "@/lib/i18n";
import { cx } from "@/lib/utils";

type ListingErrors = RichProductFormErrors & { form?: string };

export function ListingCreateForm() {
  const router = useRouter();
  const { locale, t } = useI18n();
  const [product, setProduct] = useState<RichProductFormValue>(emptyRichProductForm);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<ListingErrors>({});
  const [notice, setNotice] = useState("");
  const leaveMessage = t("settings.unsavedChangesWarning");
  useUnsavedChangesWarning(dirty && !submitting && !uploading, leaveMessage);
  const { draft, clearDraft, discardDraft } = useDraftBackup<RichProductFormValue>(
    `bridgemarket:listing-create-draft:${locale}`,
    product,
    dirty && !submitting,
  );

  function update<K extends keyof RichProductFormValue>(
    key: K,
    value: RichProductFormValue[K],
  ) {
    setProduct((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setErrors((current) =>
      key === "fieldVisibility"
        ? { form: current.form }
        : { ...current, [key]: undefined, form: undefined },
    );
    setNotice("");
  }

  function restoreDraft() {
    if (!draft) return;
    setProduct(draft);
    setDirty(true);
    setErrors({});
    discardDraft();
  }

  function validate(status: "active" | "draft") {
    const nextErrors: ListingErrors = validateRichProductForm(product, t, {
      requireImages: status === "active",
    });
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function saveProduct(status: "active" | "draft") {
    if (submitting) return;
    if (!validate(status)) return;

    setSubmitting(true);
    setNotice("");
    try {
      const response = await fetch("/api/account/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...productPayloadFromForm(product),
          status,
        }),
      });
      const result = (await response.json().catch(() => null)) as {
        id?: string;
        error?: string;
      } | null;

      if (response.ok && result?.id) {
        clearDraft();
        setDirty(false);
        setNotice(
          status === "draft"
            ? t("listing.productSaved")
            : t("listing.productPublished"),
        );
        router.push(withLocale(`/products/${result.id}`, locale));
        router.refresh();
        return;
      }

      setErrors({ form: result?.error ?? t("listing.errors.form") });
    } catch {
      setErrors({ form: t("listing.errors.form") });
    } finally {
      setSubmitting(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void saveProduct("active");
  }

  const statusMeta = productBuilderStatus({
    submitting,
    uploading,
    hasError: Boolean(errors.form),
    dirty,
    t,
  });
  const sectionLinks = [
    ["product-images", t("productForm.productImages")],
    ["basic-information", t("productForm.basicInfo")],
    ["pricing-order-terms", t("productForm.pricingTerms")],
    ["origin-shipping", t("productForm.originShipping")],
    ["compliance", t("productForm.complianceDocuments")],
    ["packaging-logistics", t("productForm.packagingLogistics")],
  ] as const;

  return (
    <form
      onSubmit={submit}
      className="mx-auto grid w-full max-w-[1500px] gap-5 rounded-[24px] border p-4 theme-surface-elevated sm:p-5 lg:p-6"
      noValidate
    >
      <div className="flex flex-col gap-4 border-b theme-border pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] theme-success-text">
            {t("listing.pageLabel")}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight theme-foreground">
              {t("listing.createProduct")}
            </h1>
            <StatusPill label={statusMeta.label} tone={statusMeta.tone} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={submitting}
            onClick={() => void saveProduct("draft")}
            className={secondaryActionClass}
          >
            {submitting ? t("listing.statusSaving") : t("listing.saveDraft")}
          </button>
          <button
            type="submit"
            disabled={submitting}
            className={primaryActionClass}
          >
            {submitting ? t("listing.statusSaving") : t("listing.publishProduct")}
          </button>
        </div>
      </div>

      {draft ? (
        <div className="rounded-xl border p-3 text-sm theme-surface">
          <p className="theme-muted">{t("settings.draftAvailable")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={restoreDraft}
              className="inline-flex h-8 items-center rounded-md border px-2.5 text-xs font-medium theme-secondary-button"
            >
              {t("settings.restoreDraft")}
            </button>
            <button
              type="button"
              onClick={discardDraft}
              className="inline-flex h-8 items-center rounded-md px-2.5 text-xs font-medium theme-ghost-button"
            >
              {t("settings.discardDraft")}
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start xl:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="hidden rounded-2xl border p-3 theme-surface lg:sticky lg:top-24 lg:block">
          <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] theme-muted">
            {t("listing.sections")}
          </p>
          <nav className="grid gap-1" aria-label={t("listing.sections")}>
            {sectionLinks.map(([href, label]) => (
              <a
                key={href}
                href={`#${href}`}
                className="rounded-xl px-2 py-2 text-sm font-medium transition theme-ghost-button"
              >
                {label}
              </a>
            ))}
          </nav>
        </aside>

        <div className="min-w-0">
          <RichProductFormFields
            value={product}
            errors={errors}
            onChange={update}
            onUploadingChange={setUploading}
            variant="dashboard"
          />
        </div>
      </div>

      {errors.form ? (
        <p className="rounded-2xl border p-4 text-sm font-medium theme-danger-badge">
          {errors.form}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="rounded-2xl border p-4 text-sm font-medium theme-success-badge">
          {notice}
        </p>
      ) : null}
      {uploading ? (
        <p role="status" className="rounded-2xl border p-4 text-sm font-medium theme-info-badge">
          {t("listing.imageUploadInProgress")}
        </p>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2 border-t theme-border pt-5">
        <button
          type="button"
          disabled={submitting}
          onClick={() => void saveProduct("draft")}
          className={secondaryActionClass}
        >
          {submitting ? t("listing.statusSaving") : t("listing.saveDraft")}
        </button>
        <button
          type="submit"
          disabled={submitting}
          className={primaryActionClass}
        >
          {submitting ? t("listing.statusSaving") : t("listing.publishProduct")}
        </button>
      </div>
    </form>
  );
}

const primaryActionClass =
  "inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 theme-focus theme-primary-button disabled:cursor-not-allowed disabled:opacity-50";
const secondaryActionClass =
  "inline-flex h-10 items-center justify-center rounded-xl border px-4 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 theme-focus theme-secondary-button disabled:cursor-not-allowed disabled:opacity-50";

function productBuilderStatus({
  submitting,
  uploading,
  hasError,
  dirty,
  t,
}: {
  submitting: boolean;
  uploading: boolean;
  hasError: boolean;
  dirty: boolean;
  t: (key: string) => string;
}) {
  if (hasError) return { label: t("listing.statusSaveFailed"), tone: "red" as const };
  if (submitting) return { label: t("listing.statusSaving"), tone: "blue" as const };
  if (uploading) return { label: t("listing.statusUploading"), tone: "blue" as const };
  if (dirty) return { label: t("listing.statusReady"), tone: "emerald" as const };
  return { label: t("listing.statusDraft"), tone: "zinc" as const };
}

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: "zinc" | "blue" | "emerald" | "red";
}) {
  return (
    <span
      className={cx(
        "inline-flex h-7 items-center rounded-full border px-3 text-xs font-semibold",
        tone === "blue" && "theme-info-badge",
        tone === "emerald" && "theme-success-badge",
        tone === "red" && "theme-danger-badge",
        tone === "zinc" && "theme-surface-muted theme-muted",
      )}
    >
      {label}
    </span>
  );
}
