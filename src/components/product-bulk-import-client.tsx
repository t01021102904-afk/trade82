"use client";

import {
  CheckCircle2,
  CircleAlert,
  Download,
  FileSpreadsheet,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { ChangeEvent, FormEvent, useMemo, useState } from "react";

import { useI18n } from "@/components/i18n-provider";
import { withLocale } from "@/lib/i18n";
import { cx } from "@/lib/utils";

type PreviewRow = {
  id: string;
  rowNumber: number;
  sellerSku: string;
  productName: string;
  category: string;
  status: "VALID" | "ERROR" | "CREATED" | "UPDATED" | "SKIPPED";
  errorMessages: string[];
};

type ImportPreview = {
  importId: string;
  duplicateMode: "skip" | "update";
  rows: PreviewRow[];
  validCount: number;
  errorCount: number;
  existingSkus: string[];
};

type CommitResult = {
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  errorCount: number;
  draftCount: number;
};

const maxBytes = 5 * 1024 * 1024;

function apiMessage(payload: unknown, fallback: string) {
  return payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
    ? payload.error
    : fallback;
}

function translateCount(template: string, count: number) {
  return template.replace("{count}", String(count));
}

export function ProductBulkImportClient() {
  const { locale, t } = useI18n();
  const [file, setFile] = useState<File | null>(null);
  const [duplicateMode, setDuplicateMode] = useState<"skip" | "update">("skip");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CommitResult | null>(null);

  const selectedValidRows = useMemo(
    () => preview?.rows.filter((row) => row.status === "VALID" && selectedRowIds.includes(row.id)) ?? [],
    [preview, selectedRowIds],
  );
  const existingSkuSet = useMemo(() => new Set(preview?.existingSkus ?? []), [preview]);
  const effectiveDuplicateMode = preview?.duplicateMode ?? duplicateMode;

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    setError("");
    setPreview(null);
    setSelectedRowIds([]);
    setResult(null);
    if (!nextFile) {
      setFile(null);
      return;
    }
    const extension = nextFile.name.split(".").pop()?.toLowerCase();
    if (extension !== "xlsx" && extension !== "csv") {
      setFile(null);
      setError(t("productBulkImport.invalidFileType"));
      event.target.value = "";
      return;
    }
    if (nextFile.size > maxBytes) {
      setFile(null);
      setError(t("productBulkImport.fileTooLarge"));
      event.target.value = "";
      return;
    }
    setFile(nextFile);
  }

  async function previewImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || uploading) return;
    setUploading(true);
    setError("");
    setResult(null);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("duplicateMode", duplicateMode);
      const response = await fetch("/api/account/products/import/preview", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json().catch(() => null)) as ImportPreview | { error?: string } | null;
      if (!response.ok || !payload || !("importId" in payload)) {
        setError(apiMessage(payload, t("productBulkImport.previewFailed")));
        return;
      }
      setPreview(payload);
      setSelectedRowIds(payload.rows.filter((row) => row.status === "VALID").map((row) => row.id));
    } catch {
      setError(t("productBulkImport.previewFailed"));
    } finally {
      setUploading(false);
    }
  }

  function toggleRow(row: PreviewRow) {
    if (row.status !== "VALID") return;
    setSelectedRowIds((current) =>
      current.includes(row.id) ? current.filter((id) => id !== row.id) : [...current, row.id],
    );
  }

  function toggleAllValid() {
    if (!preview) return;
    const validIds = preview.rows.filter((row) => row.status === "VALID").map((row) => row.id);
    setSelectedRowIds((current) => (current.length === validIds.length ? [] : validIds));
  }

  function downloadFile(path: string) {
    window.location.assign(path);
  }

  async function commitImport() {
    if (!preview || !selectedRowIds.length || committing) return;
    setCommitting(true);
    setError("");
    try {
      const response = await fetch(
        `/api/account/products/import/${encodeURIComponent(preview.importId)}/commit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rowIds: selectedRowIds }),
        },
      );
      const payload = (await response.json().catch(() => null)) as CommitResult | { error?: string } | null;
      if (!response.ok || !payload || !("draftCount" in payload)) {
        setError(apiMessage(payload, t("productBulkImport.commitFailed")));
        return;
      }
      setResult(payload);
      setSelectedRowIds([]);
    } catch {
      setError(t("productBulkImport.commitFailed"));
    } finally {
      setCommitting(false);
    }
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-2xl border p-5 theme-surface-elevated sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] theme-success-text">
          {t("productBulkImport.eyebrow")}
        </p>
        <h1 className="mt-2 text-2xl font-semibold theme-foreground sm:text-3xl">
          {t("productBulkImport.title")}
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 theme-muted">
          {t("productBulkImport.description")}
        </p>
      </section>

      <section className="grid gap-5 rounded-2xl border p-5 theme-surface sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold theme-foreground">{t("productBulkImport.stepTemplate")}</h2>
            <p className="mt-1 text-sm theme-muted">{t("productBulkImport.templateDescription")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => downloadFile("/api/account/products/import/template?format=xlsx")}
              className={secondaryButtonClass}
            >
              <FileSpreadsheet className="size-4" aria-hidden="true" />
              {t("productBulkImport.downloadXlsx")}
            </button>
            <button
              type="button"
              onClick={() => downloadFile("/api/account/products/import/template?format=csv")}
              className={secondaryButtonClass}
            >
              <Download className="size-4" aria-hidden="true" />
              {t("productBulkImport.downloadCsv")}
            </button>
          </div>
        </div>
        <p className="rounded-lg border px-3 py-2 text-xs leading-5 theme-surface-muted theme-muted">
          {t("productBulkImport.requiredColumns")}
        </p>
      </section>

      <form onSubmit={previewImport} className="grid gap-5 rounded-2xl border p-5 theme-surface sm:p-6">
        <div>
          <h2 className="text-base font-semibold theme-foreground">{t("productBulkImport.stepUpload")}</h2>
          <p className="mt-1 text-sm theme-muted">{t("productBulkImport.uploadDescription")}</p>
        </div>
        <label className="grid cursor-pointer gap-2 rounded-xl border border-dashed p-5 transition hover:theme-surface-muted">
          <span className="flex items-center gap-2 text-sm font-medium theme-foreground">
            <Upload className="size-4" aria-hidden="true" />
            {file ? file.name : t("productBulkImport.chooseFile")}
          </span>
          <span className="text-xs theme-muted">{t("productBulkImport.fileHint")}</span>
          <input
            type="file"
            accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={onFileChange}
            className="sr-only"
          />
        </label>
        <label className="grid max-w-sm gap-1 text-sm theme-foreground">
          <span className="font-medium">{t("productBulkImport.duplicateLabel")}</span>
          <select
            value={duplicateMode}
            onChange={(event) => setDuplicateMode(event.target.value === "update" ? "update" : "skip")}
            disabled={Boolean(preview)}
            className="h-10 rounded-lg border bg-white px-3 text-sm text-zinc-900"
          >
            <option value="skip">{t("productBulkImport.skipDuplicates")}</option>
            <option value="update">{t("productBulkImport.updateDuplicates")}</option>
          </select>
        </label>
        <div className="flex justify-end">
          <button type="submit" disabled={!file || uploading} className={primaryButtonClass}>
            {uploading ? t("productBulkImport.previewing") : t("productBulkImport.preview")}
          </button>
        </div>
      </form>

      {error ? (
        <p role="alert" className="flex items-start gap-2 rounded-xl border p-4 text-sm theme-danger-badge">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : null}

      {preview ? (
        <section className="grid gap-4 rounded-2xl border p-5 theme-surface sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold theme-foreground">{t("productBulkImport.stepPreview")}</h2>
              <p className="mt-1 text-sm theme-muted">
                {translateCount(t("productBulkImport.previewSummary"), preview.validCount)} · {translateCount(t("productBulkImport.errorSummary"), preview.errorCount)}
              </p>
            </div>
            {preview.errorCount ? (
              <button
                type="button"
                onClick={() =>
                  downloadFile(`/api/account/products/import/${encodeURIComponent(preview.importId)}/errors.csv`)
                }
                className={secondaryButtonClass}
              >
                <Download className="size-4" aria-hidden="true" />
                {t("productBulkImport.downloadErrors")}
              </button>
            ) : null}
          </div>

          <div className="overflow-x-auto rounded-xl border">
            <table className="min-w-[760px] w-full text-left text-sm">
              <thead className="border-b theme-surface-muted">
                <tr className="theme-muted">
                  <th className="w-10 px-3 py-3">
                    <input
                      type="checkbox"
                      aria-label={t("productBulkImport.selectAll")}
                      checked={preview.validCount > 0 && selectedRowIds.length === preview.validCount}
                      onChange={toggleAllValid}
                    />
                  </th>
                  <th className="px-3 py-3 font-medium">{t("productBulkImport.rowNumber")}</th>
                  <th className="px-3 py-3 font-medium">SKU</th>
                  <th className="px-3 py-3 font-medium">{t("productBulkImport.productName")}</th>
                  <th className="px-3 py-3 font-medium">{t("productBulkImport.category")}</th>
                  <th className="px-3 py-3 font-medium">{t("productBulkImport.status")}</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => {
                  const valid = row.status === "VALID";
                  const existing = existingSkuSet.has(row.sellerSku);
                  return (
                    <tr key={row.id} className="border-b last:border-0 theme-border">
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          disabled={!valid || committing || Boolean(result)}
                          checked={valid && selectedRowIds.includes(row.id)}
                          onChange={() => toggleRow(row)}
                          aria-label={`${t("productBulkImport.selectRow")} ${row.rowNumber}`}
                        />
                      </td>
                      <td className="px-3 py-3 theme-muted">{row.rowNumber}</td>
                      <td className="px-3 py-3 font-medium theme-foreground">{row.sellerSku || "-"}</td>
                      <td className="max-w-56 truncate px-3 py-3 theme-foreground">{row.productName || "-"}</td>
                      <td className="px-3 py-3 theme-muted">{row.category || "-"}</td>
                      <td className="px-3 py-3">
                        {valid ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                            <CheckCircle2 className="size-3.5" aria-hidden="true" />
                            {existing
                              ? effectiveDuplicateMode === "update"
                                ? t("productBulkImport.updateAsDraft")
                                : t("productBulkImport.skipExisting")
                              : t("productBulkImport.valid")}
                          </span>
                        ) : (
                          <span className="grid gap-1 text-xs text-red-700">
                            <span className="inline-flex items-center gap-1.5 font-medium">
                              <CircleAlert className="size-3.5" aria-hidden="true" />
                              {t("productBulkImport.error")}
                            </span>
                            <span>{row.errorMessages.join(" ")}</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!result ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4 theme-border">
              <p className="text-sm theme-muted">
                {translateCount(t("productBulkImport.selectedCount"), selectedValidRows.length)}
              </p>
              <button
                type="button"
                disabled={!selectedValidRows.length || committing}
                onClick={() => void commitImport()}
                className={primaryButtonClass}
              >
                {committing ? t("productBulkImport.registering") : t("productBulkImport.registerDrafts")}
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {result ? (
        <section role="status" className="grid gap-3 rounded-2xl border p-5 theme-success-badge">
          <p className="font-semibold">
            {translateCount(t("productBulkImport.success"), result.draftCount)}
          </p>
          {result.skippedCount || result.errorCount ? (
            <p className="text-sm">
              {translateCount(t("productBulkImport.commitDetails"), result.skippedCount + result.errorCount)}
            </p>
          ) : null}
          <div>
            <Link href={withLocale("/dashboard/seller", locale)} className={secondaryButtonClass}>
              {t("productBulkImport.goToProducts")}
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}

const primaryButtonClass =
  "inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold transition theme-primary-button disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButtonClass = cx(
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium transition",
  "theme-secondary-button",
);
