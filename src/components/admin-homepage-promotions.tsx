"use client";

import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";

import { getDictionary, type Locale, withLocale } from "@/lib/i18n";

type Promotion = {
  id: string;
  adminTitle: string;
  altTextEn: string;
  altTextKo: string;
  mediaType: "IMAGE" | "PDF";
  thumbnailUrl: string;
  pdfUrl: string | null;
  destinationUrl: string | null;
  openInNewTab: boolean;
  displayOrder: number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type Draft = {
  adminTitle: string;
  altTextEn: string;
  altTextKo: string;
  mediaType: "IMAGE" | "PDF";
  destinationUrl: string;
  openInNewTab: boolean;
  isActive: boolean;
  startsAt: string;
  endsAt: string;
  usePdfAsDestination: boolean;
  thumbnailFile: File | null;
  pdfFile: File | null;
};

const emptyDraft: Draft = {
  adminTitle: "",
  altTextEn: "",
  altTextKo: "",
  mediaType: "IMAGE",
  destinationUrl: "",
  openInNewTab: false,
  isActive: true,
  startsAt: "",
  endsAt: "",
  usePdfAsDestination: false,
  thumbnailFile: null,
  pdfFile: null,
};

function dateTimeInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function promotionDraft(promotion: Promotion): Draft {
  return {
    adminTitle: promotion.adminTitle,
    altTextEn: promotion.altTextEn,
    altTextKo: promotion.altTextKo,
    mediaType: promotion.mediaType,
    destinationUrl: promotion.destinationUrl ?? "",
    openInNewTab: promotion.openInNewTab,
    isActive: promotion.isActive,
    startsAt: dateTimeInput(promotion.startsAt),
    endsAt: dateTimeInput(promotion.endsAt),
    usePdfAsDestination:
      Boolean(promotion.pdfUrl) &&
      promotion.destinationUrl === promotion.pdfUrl,
    thumbnailFile: null,
    pdfFile: null,
  };
}

function appendDraft(form: FormData, draft: Draft) {
  form.set("adminTitle", draft.adminTitle);
  form.set("altTextEn", draft.altTextEn);
  form.set("altTextKo", draft.altTextKo);
  form.set("mediaType", draft.mediaType);
  form.set("destinationUrl", draft.destinationUrl);
  form.set("openInNewTab", String(draft.openInNewTab));
  form.set("isActive", String(draft.isActive));
  form.set(
    "startsAt",
    draft.startsAt ? new Date(draft.startsAt).toISOString() : "",
  );
  form.set("endsAt", draft.endsAt ? new Date(draft.endsAt).toISOString() : "");
  form.set("usePdfAsDestination", String(draft.usePdfAsDestination));
  if (draft.thumbnailFile) form.set("thumbnailFile", draft.thumbnailFile);
  if (draft.pdfFile) form.set("pdfFile", draft.pdfFile);
}

export function AdminHomepagePromotions({ locale }: { locale: Locale }) {
  const copy = getDictionary(locale).admin.homepagePromotions;
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const selectedPromotion = promotions.find(({ id }) => id === editingId);
  const selectedThumbnailUrl = useObjectUrl(draft.thumbnailFile);
  const previewUrl =
    selectedThumbnailUrl ?? selectedPromotion?.thumbnailUrl ?? null;

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch("/api/admin/homepage-promotions", {
      cache: "no-store",
    });
    const result = (await response.json().catch(() => null)) as
      | Promotion[]
      | null;
    if (!response.ok || !Array.isArray(result)) {
      setMessage(copy.loadError);
    } else {
      setPromotions(result);
      setMessage(null);
    }
    setLoading(false);
  }, [copy.loadError]);

  useEffect(() => {
    void load();
  }, [load]);

  const openNew = () => {
    setEditingId(null);
    setDraft(emptyDraft);
    setFormOpen(true);
    setMessage(null);
  };

  const openEdit = (promotion: Promotion) => {
    setEditingId(promotion.id);
    setDraft(promotionDraft(promotion));
    setFormOpen(true);
    setMessage(null);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    const form = new FormData();
    appendDraft(form, draft);
    const response = await fetch(
      editingId
        ? `/api/admin/homepage-promotions/${editingId}`
        : "/api/admin/homepage-promotions",
      { method: editingId ? "PATCH" : "POST", body: form },
    );
    if (!response.ok) {
      const result = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setMessage(result?.error ?? copy.saveError);
      setSaving(false);
      return;
    }
    setFormOpen(false);
    setEditingId(null);
    setDraft(emptyDraft);
    setSaving(false);
    await load();
  };

  const saveExisting = async (
    promotion: Promotion,
    updates: Partial<Draft>,
  ) => {
    const form = new FormData();
    appendDraft(form, { ...promotionDraft(promotion), ...updates });
    const response = await fetch(
      `/api/admin/homepage-promotions/${promotion.id}`,
      { method: "PATCH", body: form },
    );
    if (!response.ok) setMessage(copy.saveError);
    await load();
  };

  const remove = async (promotion: Promotion) => {
    if (!window.confirm(copy.deleteConfirm)) return;
    const response = await fetch(
      `/api/admin/homepage-promotions/${promotion.id}`,
      { method: "DELETE" },
    );
    if (!response.ok) {
      setMessage(copy.deleteError);
      return;
    }
    const result = (await response.json()) as { cleanupPending?: boolean };
    setMessage(result.cleanupPending ? copy.cleanupPending : null);
    await load();
  };

  const move = async (index: number, offset: -1 | 1) => {
    const nextIndex = index + offset;
    if (nextIndex < 0 || nextIndex >= promotions.length) return;
    const next = [...promotions];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    setPromotions(next);
    const response = await fetch("/api/admin/homepage-promotions/order", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: next.map(({ id }) => id) }),
    });
    if (!response.ok) {
      setMessage(copy.orderError);
      await load();
    }
  };

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-200 pb-5">
          <div>
            <Link
              href={withLocale("/admin", locale)}
              className="text-sm font-medium text-zinc-600 hover:text-zinc-950"
            >
              ← {copy.back}
            </Link>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">
              {copy.title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-600">
              {copy.description}
            </p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {copy.count.replace("{count}", String(promotions.length))}
            </p>
          </div>
          <button
            type="button"
            onClick={openNew}
            disabled={promotions.length >= 10}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#34B386]/50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus className="size-4" aria-hidden="true" />
            {copy.new}
          </button>
        </header>

        {message ? (
          <p role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
            {message}
          </p>
        ) : null}

        {formOpen ? (
          <form
            onSubmit={submit}
            className="grid gap-5 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm lg:grid-cols-[1fr_360px] lg:p-6"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <h2 className="sm:col-span-2 text-lg font-semibold">
                {editingId ? copy.edit : copy.new}
              </h2>
              <TextInput
                label={copy.adminTitle}
                value={draft.adminTitle}
                onChange={(adminTitle) => setDraft({ ...draft, adminTitle })}
                required
              />
              <label className="grid gap-1.5 text-sm">
                <span className="font-semibold">{copy.mediaType}</span>
                <select
                  value={draft.mediaType}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      mediaType: event.target.value as "IMAGE" | "PDF",
                      usePdfAsDestination:
                        event.target.value === "PDF"
                          ? draft.usePdfAsDestination
                          : false,
                    })
                  }
                  className="h-10 rounded-md border border-zinc-300 bg-white px-3"
                >
                  <option value="IMAGE">{copy.image}</option>
                  <option value="PDF">{copy.pdf}</option>
                </select>
              </label>
              <TextInput
                label={copy.altEn}
                value={draft.altTextEn}
                onChange={(altTextEn) => setDraft({ ...draft, altTextEn })}
                required
              />
              <TextInput
                label={copy.altKo}
                value={draft.altTextKo}
                onChange={(altTextKo) => setDraft({ ...draft, altTextKo })}
                required
              />
              <FileInput
                label={copy.thumbnail}
                accept="image/jpeg,image/png,image/webp"
                required={!editingId}
                help={editingId ? copy.replaceHelp : undefined}
                onChange={(thumbnailFile) =>
                  setDraft({ ...draft, thumbnailFile })
                }
              />
              {draft.mediaType === "PDF" ? (
                <FileInput
                  label={copy.pdfFile}
                  accept="application/pdf"
                  required={!editingId || !selectedPromotion?.pdfUrl}
                  help={editingId ? copy.replaceHelp : undefined}
                  onChange={(pdfFile) => setDraft({ ...draft, pdfFile })}
                />
              ) : null}
              <div className="sm:col-span-2">
                <TextInput
                  label={copy.destination}
                  value={draft.destinationUrl}
                  onChange={(destinationUrl) =>
                    setDraft({ ...draft, destinationUrl })
                  }
                  placeholder="/events/example or https://…"
                  help={copy.destinationHelp}
                  disabled={draft.usePdfAsDestination}
                />
              </div>
              {draft.mediaType === "PDF" ? (
                <CheckInput
                  label={copy.usePdfDestination}
                  checked={draft.usePdfAsDestination}
                  onChange={(usePdfAsDestination) =>
                    setDraft({ ...draft, usePdfAsDestination })
                  }
                />
              ) : null}
              <CheckInput
                label={copy.newTab}
                checked={draft.openInNewTab}
                onChange={(openInNewTab) =>
                  setDraft({ ...draft, openInNewTab })
                }
              />
              <CheckInput
                label={copy.active}
                checked={draft.isActive}
                onChange={(isActive) => setDraft({ ...draft, isActive })}
              />
              <TextInput
                label={copy.startsAt}
                type="datetime-local"
                value={draft.startsAt}
                onChange={(startsAt) => setDraft({ ...draft, startsAt })}
              />
              <TextInput
                label={copy.endsAt}
                type="datetime-local"
                value={draft.endsAt}
                onChange={(endsAt) => setDraft({ ...draft, endsAt })}
              />
              <div className="flex gap-2 sm:col-span-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="h-10 rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {saving ? copy.saving : copy.save}
                </button>
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="h-10 rounded-md border border-zinc-300 px-4 text-sm font-semibold"
                >
                  {copy.cancel}
                </button>
              </div>
            </div>
            <PromotionPreview
              title={copy.preview}
              url={previewUrl}
              alt={draft.altTextEn || draft.altTextKo || draft.adminTitle}
              mediaType={draft.mediaType}
              destinationUrl={
                draft.usePdfAsDestination
                  ? selectedPromotion?.pdfUrl ?? null
                  : draft.destinationUrl || null
              }
            />
          </form>
        ) : null}

        <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
          {loading ? (
            <div className="h-48 animate-pulse bg-zinc-100" />
          ) : promotions.length ? (
            <div className="divide-y divide-zinc-200">
              {promotions.map((promotion, index) => (
                <article
                  key={promotion.id}
                  className="grid gap-4 p-4 md:grid-cols-[112px_1fr_auto] md:items-center"
                >
                  <div className="relative aspect-[16/10] overflow-hidden rounded-md border border-zinc-200 bg-zinc-50">
                    <Image
                      src={promotion.thumbnailUrl}
                      alt=""
                      fill
                      unoptimized
                      sizes="112px"
                      className={
                        promotion.mediaType === "PDF"
                          ? "object-contain"
                          : "object-cover"
                      }
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate font-semibold">
                        {promotion.adminTitle}
                      </h2>
                      <span className="rounded-full border border-zinc-200 px-2 py-0.5 text-xs font-semibold">
                        {promotion.mediaType}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          promotion.isActive
                            ? "bg-emerald-50 text-emerald-800"
                            : "bg-zinc-100 text-zinc-600"
                        }`}
                      >
                        {promotion.isActive ? copy.active : copy.disable}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-sm text-zinc-600">
                      {promotion.destinationUrl ?? "—"}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {copy.order}: {index + 1} · {copy.schedule}:{" "}
                      {formatSchedule(promotion, locale)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <IconButton
                      label={copy.moveUp}
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUp className="size-4" />
                    </IconButton>
                    <IconButton
                      label={copy.moveDown}
                      disabled={index === promotions.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDown className="size-4" />
                    </IconButton>
                    <IconButton
                      label={copy.edit}
                      onClick={() => openEdit(promotion)}
                    >
                      <Pencil className="size-4" />
                    </IconButton>
                    <button
                      type="button"
                      onClick={() =>
                        saveExisting(promotion, {
                          isActive: !promotion.isActive,
                        })
                      }
                      className="h-9 rounded-md border border-zinc-300 px-2.5 text-xs font-semibold"
                    >
                      {promotion.isActive ? copy.disable : copy.enable}
                    </button>
                    <IconButton
                      label={copy.delete}
                      onClick={() => remove(promotion)}
                      destructive
                    >
                      <Trash2 className="size-4" />
                    </IconButton>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="p-8 text-center text-sm text-zinc-600">{copy.empty}</p>
          )}
        </section>
      </div>
    </main>
  );
}

function useObjectUrl(file: File | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    const nextUrl = URL.createObjectURL(file);
    setUrl(nextUrl);
    return () => {
      URL.revokeObjectURL(nextUrl);
    };
  }, [file]);
  return url;
}

function PromotionPreview({
  title,
  url,
  alt,
  mediaType,
  destinationUrl,
}: {
  title: string;
  url: string | null;
  alt: string;
  mediaType: "IMAGE" | "PDF";
  destinationUrl: string | null;
}) {
  return (
    <aside>
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="relative mt-2 aspect-[16/10] overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
        {url ? (
          <Image
            src={url}
            alt={alt}
            fill
            unoptimized
            sizes="360px"
            className={mediaType === "PDF" ? "object-contain" : "object-cover"}
          />
        ) : (
          <div className="grid size-full place-items-center text-sm text-zinc-400">
            {title}
          </div>
        )}
      </div>
      <p className="mt-2 flex min-w-0 items-center gap-1 truncate text-xs text-zinc-500">
        <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
        {destinationUrl ?? "—"}
      </p>
    </aside>
  );
}

function TextInput({
  label,
  value,
  onChange,
  required,
  type = "text",
  placeholder,
  help,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  placeholder?: string;
  help?: string;
  disabled?: boolean;
}) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-semibold">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        placeholder={placeholder}
        disabled={disabled}
        className="h-10 min-w-0 rounded-md border border-zinc-300 px-3 outline-none focus:border-[#34B386] focus:ring-2 focus:ring-[#34B386]/20 disabled:bg-zinc-100"
      />
      {help ? <span className="text-xs text-zinc-500">{help}</span> : null}
    </label>
  );
}

function FileInput({
  label,
  accept,
  required,
  help,
  onChange,
}: {
  label: string;
  accept: string;
  required?: boolean;
  help?: string;
  onChange: (file: File | null) => void;
}) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-semibold">{label}</span>
      <input
        type="file"
        accept={accept}
        required={required}
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
        className="min-h-10 min-w-0 rounded-md border border-zinc-300 p-2 text-xs file:mr-2 file:rounded file:border-0 file:bg-zinc-100 file:px-2 file:py-1"
      />
      {help ? <span className="text-xs text-zinc-500">{help}</span> : null}
    </label>
  );
}

function CheckInput({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-10 items-center gap-2 text-sm font-medium">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 accent-[#34B386]"
      />
      {label}
    </label>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  destructive,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex size-9 items-center justify-center rounded-md border disabled:opacity-30 ${
        destructive
          ? "border-red-200 text-red-700 hover:bg-red-50"
          : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"
      }`}
    >
      {children}
    </button>
  );
}

function formatSchedule(promotion: Promotion, locale: Locale) {
  if (!promotion.startsAt && !promotion.endsAt) return "—";
  const formatter = new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
    timeStyle: "short",
  });
  return [
    promotion.startsAt ? formatter.format(new Date(promotion.startsAt)) : "…",
    promotion.endsAt ? formatter.format(new Date(promotion.endsAt)) : "…",
  ].join(" – ");
}
