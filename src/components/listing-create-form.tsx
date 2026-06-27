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
} from "@/components/rich-product-form-fields";
import {
  useDraftBackup,
  useUnsavedChangesWarning,
} from "@/hooks/use-form-reliability";
import { withLocale } from "@/lib/i18n";

type ListingErrors = RichProductFormErrors & { form?: string };

export function ListingCreateForm() {
  const router = useRouter();
  const { locale, t } = useI18n();
  const [product, setProduct] = useState<RichProductFormValue>(emptyRichProductForm);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<ListingErrors>({});
  const leaveMessage = t("settings.unsavedChangesWarning");
  useUnsavedChangesWarning(dirty && !submitting && !uploading, leaveMessage);
  const { draft, clearDraft, discardDraft } = useDraftBackup<RichProductFormValue>(
    `bridgemarket:listing-create-draft:${locale}`,
    product,
    dirty && !submitting && !uploading,
  );

  function update<K extends keyof RichProductFormValue>(
    key: K,
    value: RichProductFormValue[K],
  ) {
    setProduct((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setErrors((current) => ({ ...current, [key]: undefined, form: undefined }));
  }

  function restoreDraft() {
    if (!draft) return;
    setProduct(draft);
    setDirty(true);
    setErrors({});
    discardDraft();
  }

  function validate() {
    const nextErrors: ListingErrors = {};
    if (!product.images.length) nextErrors.images = t("listing.errors.images");
    if (!product.name.trim()) nextErrors.name = t("listing.errors.name");
    if (!product.category) nextErrors.category = t("listing.errors.category");
    if (!product.priceMin || Number(product.priceMin) <= 0) {
      nextErrors.price = t("listing.errors.price");
    }
    if (
      product.moqUnit !== "Not fixed" &&
      (!product.moqQuantity || Number(product.moqQuantity) <= 0)
    ) {
      nextErrors.moq = t("listing.errors.moq");
    }
    if (!product.leadTime) nextErrors.leadTime = t("listing.errors.leadTime");
    if (!product.detailedDescription.trim()) {
      nextErrors.description = t("listing.errors.description");
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || uploading) return;
    if (!validate()) return;

    setSubmitting(true);
    try {
      const response = await fetch("/api/account/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(productPayloadFromForm(product)),
      });
      const result = (await response.json().catch(() => null)) as {
        id?: string;
        error?: string;
      } | null;

      if (response.ok && result?.id) {
        clearDraft();
        setDirty(false);
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

  return (
    <form
      onSubmit={submit}
      className="mx-auto grid w-full max-w-5xl gap-6"
      noValidate
    >
      {draft ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p>{t("settings.draftAvailable")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={restoreDraft}
              className="rounded-md bg-amber-900 px-3 py-2 font-medium text-white"
            >
              {t("settings.restoreDraft")}
            </button>
            <button
              type="button"
              onClick={discardDraft}
              className="rounded-md border border-amber-300 bg-white px-3 py-2 font-medium text-amber-900"
            >
              {t("settings.discardDraft")}
            </button>
          </div>
        </div>
      ) : null}

      <RichProductFormFields
        value={product}
        errors={errors}
        onChange={update}
        onUploadingChange={setUploading}
      />

      {errors.form ? (
        <p className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errors.form}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={uploading || submitting}
        className="min-h-12 rounded-md bg-zinc-950 px-5 py-3 text-base font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-fit"
      >
        {uploading
          ? t("listing.uploading")
          : submitting
            ? t("listing.submitting")
            : t("listing.submit")}
      </button>
    </form>
  );
}
