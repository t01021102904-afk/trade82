"use client";

import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

import { Badge } from "@/components/badge";
import { useI18n } from "@/components/i18n-provider";
import {
  formFromProductRecord,
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
import type { UploadedListingImage } from "@/lib/marketplace";
import { safeImageUrl } from "@/lib/url-security";

type DbProduct = {
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
  sellerCompany: { verificationStatus: string };
} & Record<string, unknown>;

type EditableProduct = Omit<DbProduct, "sellerCompany">;
type ProductEditorErrors = RichProductFormErrors & { form?: string };

export function ProductManagement() {
  const { user } = useUser();
  const { locale, t } = useI18n();
  const userId = user?.id ?? "";
  const [products, setProducts] = useState<DbProduct[]>([]);
  const [editing, setEditing] = useState<EditableProduct | null>(null);
  const [error, setError] = useState("");

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
      <div className="rounded-lg border border-dashed border-zinc-300 p-6 text-sm text-zinc-600">
        {error}
      </div>
    );
  }

  async function remove(id: string) {
    const response = await fetch(`/api/account/products/${id}`, { method: "DELETE" });
    if (response.ok) await loadProducts();
  }

  async function markInactive(product: DbProduct) {
    const response = await fetch(`/api/account/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "inactive" }),
    });
    if (response.ok) await loadProducts();
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-zinc-950">{t("settings.myProducts")}</h2>
          <p className="mt-1 text-sm text-zinc-500">{t("settings.productVisibilityRule")}</p>
        </div>
        <Link
          href={withLocale("/sell", locale)}
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white"
        >
          {t("settings.addProduct")}
        </Link>
      </div>

      {editing ? (
        <ProductEditor
          initialProduct={editing}
          onCancel={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await loadProducts();
          }}
        />
      ) : null}

      <div className="grid gap-3">
        {products.map((product) => {
          const isPublic =
            product.status === "active" &&
            product.sellerCompany.verificationStatus === "verified";
          return (
            <article
              key={product.id}
              className="grid gap-4 rounded-lg border border-zinc-200 p-4 sm:grid-cols-[72px_1fr_auto]"
            >
              <div
                className="aspect-square rounded-md bg-zinc-100 bg-cover bg-center"
                style={{
                  backgroundImage: `url("${safeImageUrl(product.images[0]?.cardUrl || product.imageUrl)}")`,
                }}
                aria-label={product.name}
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-zinc-950">{product.name}</h3>
                  <Badge tone={product.status === "active" ? "green" : "amber"}>
                    {product.status === "active" ? t("settings.active") : t("settings.inactive")}
                  </Badge>
                  <Badge tone={isPublic ? "blue" : "amber"}>
                    {isPublic ? t("settings.public") : t("settings.notPublic")}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-zinc-500">
                  {product.category} · {formatPrice(product)} · MOQ {product.moq}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 sm:justify-end">
                <button
                  type="button"
                  onClick={() => setEditing({ ...product })}
                  className="rounded-md border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700"
                >
                  {t("settings.editProduct")}
                </button>
                {product.status === "active" ? (
                  <button
                    type="button"
                    onClick={() => void markInactive(product)}
                    className="rounded-md border border-amber-200 px-3 py-2 text-sm font-medium text-amber-800"
                  >
                    {t("settings.markInactive")}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void remove(product.id)}
                  className="rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-700"
                >
                  {t("settings.deleteProduct")}
                </button>
              </div>
            </article>
          );
        })}
        {!products.length && !editing ? (
          <div className="rounded-lg border border-dashed border-zinc-300 p-6 text-sm text-zinc-600">
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

function ProductEditor({
  initialProduct,
  onCancel,
  onSaved,
}: {
  initialProduct: EditableProduct;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
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
    dirty && !saving && !uploading,
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
    const nextErrors: ProductEditorErrors = {};
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
    if (saving || uploading) return;
    if (!validate()) return;

    setSaving(true);
    setErrors({});
    try {
      const response = await fetch(`/api/account/products/${initialProduct.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(productPayloadFromForm(product)),
      });
      if (response.ok) {
        clearDraft();
        setDirty(false);
        onSaved();
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

  return (
    <form
      onSubmit={submit}
      className="grid gap-4 rounded-lg border border-blue-200 bg-blue-50/40 p-4"
      autoComplete="off"
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
      {errors.form ? <p className="text-sm text-red-700">{errors.form}</p> : null}
      <RichProductFormFields
        value={product}
        errors={errors}
        onChange={update}
        onUploadingChange={setUploading}
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={uploading || saving}
          className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {saving ? t("settings.saving") : t("settings.saveProductChanges")}
        </button>
        <button
          type="button"
          onClick={() => {
            if (confirmLeave()) onCancel();
          }}
          className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700"
        >
          {t("common.close")}
        </button>
      </div>
    </form>
  );
}
