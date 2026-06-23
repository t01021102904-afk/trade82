"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { ListingImageUploader } from "@/components/image-uploader";
import { useI18n } from "@/components/i18n-provider";
import {
  marketplaceCategories,
  type UploadedListingImage,
} from "@/lib/marketplace";
import { withLocale } from "@/lib/i18n";

type FormErrors = Partial<
  Record<"images" | "name" | "category" | "price" | "description" | "form", string>
>;

export function ListingCreateForm() {
  const router = useRouter();
  const { locale, t } = useI18n();
  const [images, setImages] = useState<UploadedListingImage[]>([]);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: FormErrors = {};

    if (!images.length) nextErrors.images = t("listing.errors.images");
    if (!name.trim()) nextErrors.name = t("listing.errors.name");
    if (!category) nextErrors.category = t("listing.errors.category");
    if (!price || Number(price) <= 0) nextErrors.price = t("listing.errors.price");
    if (!description.trim()) {
      nextErrors.description = t("listing.errors.description");
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    const response = await fetch("/api/account/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        images,
        name,
        category,
        tags: tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        priceMin: price,
        currency: "USD",
        shortDescription: description.slice(0, 240),
        detailedDescription: description,
        status: "active",
      }),
    });
    const result = (await response.json().catch(() => null)) as {
      id?: string;
      error?: string;
    } | null;

    if (response.ok && result?.id) {
      router.push(withLocale(`/products/${result.id}`, locale));
      router.refresh();
      return;
    }

    setErrors({ form: result?.error ?? t("listing.errors.form") });
    setSubmitting(false);
  }

  return (
    <form
      onSubmit={submit}
      className="mx-auto grid w-full max-w-3xl gap-8"
      noValidate
    >
      <section className="rounded-lg border border-zinc-200 bg-white p-4 sm:p-6">
        <ListingImageUploader
          value={images}
          onChange={setImages}
          onUploadingChange={setUploading}
        />
        {errors.images ? (
          <p className="mt-2 text-sm text-red-700">{errors.images}</p>
        ) : null}
      </section>

      <section className="grid gap-5 rounded-lg border border-zinc-200 bg-white p-4 sm:p-6">
        <FormField
          label={t("listing.productName")}
          value={name}
          onChange={setName}
          error={errors.name}
          maxLength={120}
          required
        />
        <label className="grid gap-2 text-sm">
          <span className="font-semibold text-zinc-900">
            {t("listing.category")}
          </span>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="h-12 rounded-md border border-zinc-200 bg-white px-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            aria-invalid={Boolean(errors.category)}
          >
            <option value="">{t("listing.selectCategory")}</option>
            {marketplaceCategories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          {errors.category ? (
            <span className="text-sm text-red-700">{errors.category}</span>
          ) : null}
        </label>
        <FormField
          label={t("listing.tags")}
          value={tags}
          onChange={setTags}
          placeholder={t("listing.tagsPlaceholder")}
          maxLength={300}
        />
        <FormField
          label={t("listing.price")}
          value={price}
          onChange={setPrice}
          error={errors.price}
          type="number"
          min="0"
          inputMode="decimal"
          required
        />
        <label className="grid gap-2 text-sm">
          <span className="font-semibold text-zinc-900">
            {t("listing.description")}
          </span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={9}
            maxLength={5000}
            placeholder={t("listing.descriptionPlaceholder")}
            className="rounded-md border border-zinc-200 px-3 py-3 leading-6 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            aria-invalid={Boolean(errors.description)}
          />
          <span className="flex items-center justify-between gap-2">
            {errors.description ? (
              <span className="text-sm text-red-700">{errors.description}</span>
            ) : (
              <span />
            )}
            <span className="text-xs text-zinc-500">{description.length}/5000</span>
          </span>
        </label>
      </section>

      {errors.form ? (
        <p className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errors.form}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={uploading || submitting}
        className="min-h-12 rounded-md bg-zinc-950 px-5 py-3 text-base font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
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

function FormField({
  label,
  value,
  onChange,
  error,
  type = "text",
  ...inputProps
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: "text" | "number";
} & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type"
>) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="font-semibold text-zinc-900">{label}</span>
      <input
        {...inputProps}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 rounded-md border border-zinc-200 px-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        aria-invalid={Boolean(error)}
      />
      {error ? <span className="text-sm text-red-700">{error}</span> : null}
    </label>
  );
}
