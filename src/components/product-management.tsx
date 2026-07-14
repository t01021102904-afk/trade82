"use client";

import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

import { useI18n } from "@/components/i18n-provider";
import { ProductImage } from "@/components/product-image";
import {
  formFromProductRecord,
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
import type { UploadedListingImage } from "@/lib/marketplace";
import { cx } from "@/lib/utils";

export type DbProduct = {
  id: string;
  name: string;
  imageUrl: string | null;
  images: UploadedListingImage[];
  category: string;
  tags: string[];
  shortDescription: string;
  detailedDescription: string;
  priceMin: string | null;
  priceMax: string | null;
  currency: string;
  moq: string;
  leadTime: string;
  status: "active" | "inactive" | "draft";
  viewCount?: number;
  sellerCompany: { verificationStatus: string };
} & Record<string, unknown>;

export type EditableProduct = Omit<DbProduct, "sellerCompany">;
type ProductEditorErrors = RichProductFormErrors & { form?: string };

export function ProductManagement() {
  const { user } = useUser();
  const { locale, t } = useI18n();
  const userId = user?.id ?? "";
  const [products, setProducts] = useState<DbProduct[]>([]);
  const [editing, setEditing] = useState<EditableProduct | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadProducts() {
    const response = await fetch("/api/account/products");
    if (response.ok) {
      setProducts((await response.json()) as DbProduct[]);
      setError("");
    } else if (response.status === 403) {
      setError(t("settings.sellerProductsOnly"));
    }
  }

  useEffect(() => {
    if (!userId) return;
    void fetch("/api/account/products")
      .then(async (response) => ({
        ok: response.ok,
        status: response.status,
        data: response.ok ? ((await response.json()) as DbProduct[]) : [],
      }))
      .then((result) => {
        if (result.ok) {
          setProducts(result.data);
          setError("");
        } else if (result.status === 403) {
          setError(t("settings.sellerProductsOnly"));
        }
      });
  }, [t, userId]);

  if (error) {
    return (
      <div className="rounded-md border border-dashed border-zinc-300 p-4 text-sm text-zinc-600">
        {error}
      </div>
    );
  }

  async function remove(id: string) {
    if (!window.confirm(t("dashboard.deleteProductConfirm"))) return;
    const response = await fetch(`/api/account/products/${id}`, { method: "DELETE" });
    if (response.ok) {
      setNotice(t("dashboard.productDeleted"));
      await loadProducts();
    }
  }

  async function markInactive(product: DbProduct) {
    const response = await fetch(`/api/account/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "inactive" }),
    });
    if (response.ok) await loadProducts();
  }

  async function publish(product: DbProduct) {
    const response = await fetch(`/api/account/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "active" }),
    });
    if (response.ok) {
      setNotice(t("listing.productPublished"));
      await loadProducts();
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-950">{t("settings.myProducts")}</h2>
          <p className="mt-1 text-sm text-zinc-500">{t("settings.productVisibilityRule")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={withLocale("/sell", locale)}
            className="inline-flex h-8 items-center justify-center rounded-md bg-zinc-950 px-2.5 text-xs font-medium text-white"
          >
            {t("settings.addProduct")}
          </Link>
          <Link
            href={withLocale("/products/import", locale)}
            className="inline-flex h-8 items-center justify-center rounded-md border border-zinc-300 bg-white px-2.5 text-xs font-medium text-zinc-800 transition hover:bg-zinc-50"
          >
            {t("productBulkImport.button")}
          </Link>
        </div>
      </div>

      {editing ? (
        <ProductEditor
          initialProduct={editing}
          onCancel={() => setEditing(null)}
          onSaved={async (message) => {
            setEditing(null);
            setNotice(message ?? t("listing.productUpdated"));
            await loadProducts();
          }}
        />
      ) : null}

      {notice ? (
        <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {notice}
        </p>
      ) : null}

      <div className="grid gap-2">
        {products.map((product) => {
          return (
            <article
              key={product.id}
              className="grid gap-3 rounded-md border border-zinc-200 p-3 sm:grid-cols-[72px_1fr] xl:grid-cols-[72px_minmax(0,1fr)_auto] xl:items-center"
            >
              <ProductImage
                urls={[product.images[0]?.cardUrl, product.imageUrl]}
                alt={product.name}
                sizes="72px"
                className="aspect-square rounded-md sm:size-[72px]"
                imageClassName="bg-white object-contain p-1"
                placeholderClassName="p-1"
                showLabel={false}
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-zinc-950">{product.name}</h3>
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  {product.category} · {formatPrice(product)} · MOQ {product.moq}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 sm:col-start-2 xl:col-start-auto xl:justify-end">
                <ProductListStatusIndicator product={product} />
                <button
                  type="button"
                  onClick={() => setEditing({ ...product })}
                  className={productEditButtonClass}
                >
                  {t("settings.editProduct")}
                </button>
                {product.status === "active" ? (
                  <button
                    type="button"
                    onClick={() => void markInactive(product)}
                    className={productPreparingButtonClass}
                  >
                    {t("dashboard.setPreparing")}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void publish(product)}
                    className={productPublishButtonClass}
                  >
                    {t("listing.publishProduct")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void remove(product.id)}
                  className={productDeleteButtonClass}
                >
                  {t("settings.deleteProduct")}
                </button>
              </div>
            </article>
          );
        })}
        {!products.length && !editing ? (
          <div className="rounded-md border border-dashed border-zinc-300 p-4 text-sm text-zinc-600">
            {t("settings.noProducts")}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function formatPrice(product: Pick<DbProduct, "priceMin" | "priceMax" | "currency">) {
  if (!product.priceMin && !product.priceMax) return "Price on request";
  if (product.priceMin === product.priceMax || !product.priceMax) {
    return `${product.currency} ${product.priceMin}`;
  }
  return `${product.currency} ${product.priceMin}-${product.priceMax}`;
}

export function ProductListStatusIndicator({
  product,
  className,
}: {
  product: Pick<DbProduct, "status" | "sellerCompany">;
  className?: string;
}) {
  const { t } = useI18n();
  const isPublic =
    product.status === "active" &&
    product.sellerCompany.verificationStatus === "verified";

  if (isPublic) {
    const label = t("dashboard.statusPublic");
    return (
      <span
        className={cx(
          "inline-flex h-7 items-center justify-center px-1.5",
          className,
        )}
        aria-label={label}
        title={label}
      >
        <span className="size-2 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.14)]" />
      </span>
    );
  }

  const label =
    product.status === "active"
      ? t("dashboard.statusActive")
      : product.status === "draft"
        ? t("dashboard.statusDraft")
        : t("dashboard.statusPreparing");

  return (
    <span
      className={cx(
        "inline-flex h-7 items-center rounded-full border border-amber-200 bg-amber-50/70 px-2 text-[11px] font-medium text-amber-800",
        className,
      )}
    >
      {label}
    </span>
  );
}

export const productActionBase =
  "inline-flex h-7 items-center justify-center rounded-md border px-2 text-[11px] font-medium leading-none transition disabled:cursor-wait disabled:opacity-60";
export const productEditButtonClass = cx(
  productActionBase,
  "border-zinc-300 bg-white text-zinc-900 hover:border-zinc-400 hover:bg-zinc-50",
);
export const productPreparingButtonClass = cx(
  productActionBase,
  "border-amber-300 bg-amber-50/70 text-amber-800 hover:bg-amber-100",
);
export const productPublishButtonClass = cx(
  productActionBase,
  "border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50",
);
export const productDeleteButtonClass = cx(
  productActionBase,
  "border-red-200 bg-white text-red-700 hover:bg-red-50",
);

export function ProductEditor({
  initialProduct,
  onCancel,
  onSaved,
}: {
  initialProduct: EditableProduct;
  onCancel: () => void;
  onSaved: (message?: string) => void;
}) {
  const { locale, t } = useI18n();
  const [product, setProduct] = useState<RichProductFormValue>(() =>
    formFromProductRecord(initialProduct),
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<ProductEditorErrors>({});
  const [dirty, setDirty] = useState(false);
  const leaveMessage = t("settings.unsavedChangesWarning");
  const confirmLeave = useUnsavedChangesWarning(
    dirty && !saving && !uploading,
    leaveMessage,
  );
  const { draft, clearDraft, discardDraft } = useDraftBackup<RichProductFormValue>(
    `bridgemarket:product-editor-draft:${initialProduct.id}`,
    product,
    dirty && !saving,
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
  }

  function restoreDraft() {
    if (!draft) return;
    setProduct(draft);
    setDirty(true);
    setErrors({});
    discardDraft();
  }

  function validate(status?: "active" | "draft") {
    const targetStatus = status ?? product.status;
    const nextErrors: ProductEditorErrors = validateRichProductForm(product, t, {
      requireImages: targetStatus === "active",
    });
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function saveProduct(status?: "active" | "draft") {
    if (saving) return;
    if (!validate(status)) return;

    setSaving(true);
    setErrors({});
    try {
      const response = await fetch(`/api/account/products/${initialProduct.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...productPayloadFromForm(product),
          ...(status ? { status } : {}),
        }),
      });
      if (response.ok) {
        clearDraft();
        setDirty(false);
        onSaved(
          status === "draft"
            ? t("listing.productSaved")
            : status === "active"
              ? t("listing.productPublished")
              : t("listing.productUpdated"),
        );
        return;
      }
      const result = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      setErrors({ form: result?.error ?? t("settings.productSaveError") });
    } catch {
      setErrors({ form: t("settings.productSaveError") });
    } finally {
      setSaving(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void saveProduct();
  }

  const status = editorStatusMeta({
    saving,
    uploading,
    hasError: Boolean(errors.form),
    status: product.status,
    t,
  });

  return (
    <form
      onSubmit={submit}
      className="grid gap-5 rounded-[22px] border p-4 shadow-sm theme-surface-elevated sm:p-5"
      autoComplete="off"
      noValidate
    >
      <div className="flex flex-col gap-4 border-b pb-4 theme-border xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] theme-success-text">
            {t("listing.pageLabel")}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-semibold tracking-tight theme-foreground">
              {t("listing.editProduct")}
            </h2>
            <EditorStatusPill label={status.label} tone={status.tone} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => void saveProduct("draft")}
            className={editorSecondaryActionClass}
          >
            {saving ? t("settings.saving") : t("listing.saveDraft")}
          </button>
          <Link
            href={withLocale(`/products/${initialProduct.id}`, locale)}
            className={editorGhostActionClass}
          >
            {t("listing.preview")}
          </Link>
          <button
            type="button"
            disabled={saving}
            onClick={() => void saveProduct("active")}
            className={editorSecondaryActionClass}
          >
            {saving ? t("settings.saving") : t("listing.publishProduct")}
          </button>
          <button type="submit" disabled={saving} className={editorPrimaryActionClass}>
            {saving ? t("settings.saving") : t("listing.updateProduct")}
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
      {errors.form ? (
        <p className="rounded-2xl border p-3 text-sm font-medium theme-danger-badge">
          {errors.form}
        </p>
      ) : null}
      {uploading ? (
        <p role="status" className="rounded-2xl border p-3 text-sm font-medium theme-info-badge">
          {t("listing.imageUploadInProgress")}
        </p>
      ) : null}
      <RichProductFormFields
        value={product}
        errors={errors}
        onChange={update}
        onUploadingChange={setUploading}
        productId={String(initialProduct.id)}
        variant="dashboard"
      />
      <div className="flex flex-wrap justify-end gap-2 border-t pt-4 theme-border">
        <button
          type="button"
          onClick={() => {
            if (confirmLeave()) onCancel();
          }}
          className={editorGhostActionClass}
        >
          {t("common.close")}
        </button>
      </div>
    </form>
  );
}

const editorPrimaryActionClass =
  "inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold transition theme-primary-button focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 theme-focus disabled:cursor-not-allowed disabled:opacity-50";
const editorSecondaryActionClass =
  "inline-flex h-10 items-center justify-center rounded-xl border px-4 text-sm font-semibold transition theme-secondary-button focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 theme-focus disabled:cursor-not-allowed disabled:opacity-50";
const editorGhostActionClass =
  "inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold transition theme-ghost-button focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 theme-focus";

function editorStatusMeta({
  saving,
  uploading,
  hasError,
  status,
  t,
}: {
  saving: boolean;
  uploading: boolean;
  hasError: boolean;
  status: RichProductFormValue["status"];
  t: (key: string) => string;
}) {
  if (hasError) return { label: t("listing.statusSaveFailed"), tone: "red" as const };
  if (saving) return { label: t("listing.statusSaving"), tone: "blue" as const };
  if (uploading) return { label: t("listing.statusUploading"), tone: "blue" as const };
  if (status === "active") return { label: t("listing.statusPublished"), tone: "emerald" as const };
  if (status === "inactive") return { label: t("listing.statusDraft"), tone: "zinc" as const };
  return { label: t("listing.statusDraft"), tone: "zinc" as const };
}

function EditorStatusPill({
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
