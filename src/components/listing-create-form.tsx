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
import {
  getLeadTimeOptions,
  getSalesChannelOptions,
} from "@/lib/company-select-options";
import { withLocale } from "@/lib/i18n";
import {
  normalizeProductFieldVisibility,
  type ProductFieldVisibilityKey,
} from "@/lib/product-field-visibility";
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

  function validate() {
    const nextErrors: ListingErrors = validateRichProductForm(product, t);
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function saveProduct(status: "active" | "draft") {
    if (submitting) return;
    if (!validate()) return;

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
      className="mx-auto grid w-full max-w-7xl gap-5 rounded-[24px] border p-4 theme-surface-elevated sm:p-5 lg:p-6"
      noValidate
    >
      <div className="flex flex-col gap-4 border-b theme-border pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300/80">
            {t("listing.pageLabel")}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight theme-foreground">
              {t("listing.createProduct")}
            </h1>
            <StatusPill label={statusMeta.label} tone={statusMeta.tone} />
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 theme-muted">
            {t("listing.builderHelp")}
          </p>
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
          <a href="#buyer-preview" className={ghostActionClass}>
            {t("listing.preview")}
          </a>
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
        <div className="rounded-2xl border border-amber-300/25 bg-amber-300/10 p-4 text-sm text-amber-100">
          <p>{t("settings.draftAvailable")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={restoreDraft}
              className="h-8 rounded-lg bg-amber-300 px-3 text-xs font-semibold text-zinc-950"
            >
              {t("settings.restoreDraft")}
            </button>
            <button
              type="button"
              onClick={discardDraft}
              className="h-8 rounded-lg border border-amber-300/30 px-3 text-xs font-semibold text-amber-100"
            >
              {t("settings.discardDraft")}
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)_320px] lg:items-start">
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

        <BuyerPreviewPanel product={product} />
      </div>

      {errors.form ? (
        <p className="rounded-2xl border border-red-400/25 bg-red-400/10 p-4 text-sm font-medium text-red-200">
          {errors.form}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="rounded-2xl border border-emerald-300/25 bg-emerald-300/10 p-4 text-sm font-medium text-[var(--accent-foreground)]">
          {notice}
        </p>
      ) : null}
      {uploading ? (
        <p role="status" className="rounded-2xl border border-blue-300/25 bg-blue-300/10 p-4 text-sm font-medium text-blue-300">
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
const ghostActionClass =
  "inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 theme-focus theme-ghost-button";

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
        tone === "blue" && "border-blue-300/30 bg-blue-300/10 text-blue-100",
        tone === "emerald" &&
          "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
        tone === "red" && "border-red-300/30 bg-red-300/10 text-red-100",
        tone === "zinc" && "theme-surface-muted theme-muted",
      )}
    >
      {label}
    </span>
  );
}

function BuyerPreviewPanel({ product }: { product: RichProductFormValue }) {
  const { locale, t } = useI18n();
  const image =
    product.images[0]?.mainUrl ||
    product.images[0]?.cardUrl ||
    product.images[0]?.originalUrl ||
    "";
  const leadTimeLabel =
    getLeadTimeOptions(locale).find((option) => option.value === product.leadTime)
      ?.label ?? product.leadTime;
  const channelOptions = getSalesChannelOptions(locale);
  const channelLabels = product.suggestedUsChannels
    .map(
      (channel) =>
        channelOptions.find((option) => option.value === channel)?.label ?? channel,
    )
    .slice(0, 3);

  return (
    <aside
      id="buyer-preview"
      className="rounded-2xl border p-4 theme-surface lg:sticky lg:top-24"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] theme-muted">
            {t("listing.buyerPreview")}
          </p>
          <h2 className="mt-1 text-base font-semibold theme-foreground">
            {product.name || t("listing.previewUntitled")}
          </h2>
        </div>
        <StatusPill label={t("listing.statusDraft")} tone="zinc" />
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border theme-surface-elevated">
        {image ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={image} alt="" className="aspect-[4/3] w-full object-cover" />
        ) : (
          <div className="flex aspect-[4/3] items-center justify-center text-sm theme-muted">
            {t("listing.previewImagePlaceholder")}
          </div>
        )}
      </div>

      <dl className="mt-4 grid gap-3 text-sm">
        <PreviewRow label={t("listing.category")} value={product.category || t("productDetail.notProvided")} />
        <PreviewRow
          label={t("settings.priceMin")}
          value={fieldPreviewValue(
            product,
            "minimumUnitPrice",
            product.priceMin
              ? `${product.currency} ${product.priceMin}${product.priceMax ? `-${product.priceMax}` : ""} / ${product.priceUnit}`
              : "",
            t,
          )}
        />
        <PreviewRow
          label={t("marketplace.moq")}
          value={fieldPreviewValue(
            product,
            "moq",
            product.moqQuantity
              ? `${product.moqQuantity} ${product.moqUnit}`
              : "",
            t,
          )}
        />
        <PreviewRow
          label={t("settings.leadTime")}
          value={fieldPreviewValue(product, "leadTime", leadTimeLabel, t)}
        />
        <PreviewRow
          label={t("productForm.countryOfOrigin")}
          value={product.shippingOriginRegion || product.countryOfOrigin}
        />
      </dl>

      <div className="mt-4 border-t theme-border pt-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] theme-muted">
          {t("productForm.suggestedUsChannels")}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {channelLabels.length ? (
            channelLabels.map((channel) => (
              <span
                key={channel}
                className="rounded-full border px-2.5 py-1 text-xs font-medium theme-surface-muted theme-muted"
              >
                {channel}
              </span>
            ))
          ) : (
            <span className="text-sm theme-muted">{t("productDetail.notProvided")}</span>
          )}
        </div>
      </div>
    </aside>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 rounded-xl border p-3 theme-surface-muted">
      <dt className="text-xs font-medium theme-muted">{label}</dt>
      <dd className="break-words text-sm font-medium theme-foreground">{value}</dd>
    </div>
  );
}

function fieldPreviewValue(
  product: RichProductFormValue,
  key: ProductFieldVisibilityKey,
  value: string,
  t: (key: string) => string,
) {
  const visibility = normalizeProductFieldVisibility(product.fieldVisibility)[key];
  if (visibility === "private") return t("listing.previewContactSeller");
  if (visibility === "inquiry_required") return t("listing.previewInquiryRequired");
  return value || t("productDetail.notProvided");
}
