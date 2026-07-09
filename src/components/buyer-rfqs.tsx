"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { useI18n } from "@/components/i18n-provider";
import { withLocale } from "@/lib/i18n";
import {
  canCancelRfq,
  canEditRfq,
  isRfqRecord,
  rfqApiErrorMessage,
  rfqStatusLabel,
  type RfqRecord,
} from "@/lib/rfq";

export function BuyerRfqs() {
  const { locale, t } = useI18n();
  const [rfqs, setRfqs] = useState<RfqRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionId, setActionId] = useState("");

  useEffect(() => {
    let active = true;

    async function loadRfqs() {
      try {
        const response = await fetch("/api/rfqs", { cache: "no-store" });
        const data = (await response.json().catch(() => null)) as
          | RfqRecord[]
          | { error?: string }
          | null;
        if (!active) return;
        if (!response.ok || !Array.isArray(data)) {
          setError(
            !Array.isArray(data)
              ? data?.error ?? t("rfq.loadFailed")
              : t("rfq.loadFailed"),
          );
          return;
        }
        setRfqs(data);
      } catch {
        if (active) setError(t("rfq.loadFailed"));
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadRfqs();
    return () => {
      active = false;
    };
  }, [t]);

  async function cancelRfq(id: string) {
    if (!window.confirm(t("rfq.confirmCancel"))) return;
    setActionId(id);
    setError("");
    try {
      const response = await fetch(`/api/rfqs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      const result = (await response.json().catch(() => null)) as
        | RfqRecord
        | { error?: string }
        | null;
      if (!response.ok || !isRfqRecord(result)) {
        setError(rfqApiErrorMessage(result, t("rfq.actionFailed")));
        return;
      }
      setRfqs((current) => current.map((rfq) => (rfq.id === id ? result : rfq)));
    } catch {
      setError(t("rfq.actionFailed"));
    } finally {
      setActionId("");
    }
  }

  const hasRfqs = rfqs.length > 0;
  const sortedRfqs = useMemo(
    () => [...rfqs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [rfqs],
  );

  return (
    <section className="grid gap-4">
      <div className="flex flex-col gap-3 rounded-2xl border p-5 theme-surface-elevated sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold theme-foreground">
            {t("rfq.myRfqs")}
          </h2>
          <p className="mt-1 text-sm theme-muted">{t("rfq.reviewNotice")}</p>
        </div>
        <Link
          href={withLocale("/dashboard/rfqs/new", locale)}
          className="inline-flex h-9 items-center justify-center rounded-lg px-3 text-sm font-semibold theme-primary-button"
        >
          {t("rfq.createRfq")}
        </Link>
      </div>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm theme-muted">{t("common.loading")}</p>
      ) : hasRfqs ? (
        <div className="grid gap-3">
          {sortedRfqs.map((rfq) => (
            <article
              key={rfq.id}
              className="grid gap-3 rounded-2xl border p-4 theme-surface-elevated md:grid-cols-[1fr_auto]"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-base font-semibold theme-foreground">
                    {rfq.productName}
                  </h3>
                  <StatusBadge status={rfq.status} />
                </div>
                <p className="mt-1 text-sm theme-muted">
                  {rfq.category} · {rfq.quantity}
                  {rfq.destinationCountry ? ` · ${rfq.destinationCountry}` : ""}
                </p>
                <p className="mt-2 text-xs theme-muted">
                  {new Date(rfq.createdAt).toLocaleDateString(locale)}
                </p>
                {rfq.status === "REJECTED" && rfq.adminNote ? (
                  <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {rfq.adminNote}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2 md:justify-end">
                <Link
                  href={withLocale(`/dashboard/rfqs/${rfq.id}`, locale)}
                  className="inline-flex h-8 items-center rounded-md border px-2.5 text-xs font-medium theme-secondary-button"
                >
                  {t("rfq.view")}
                </Link>
                {canEditRfq(rfq.status) ? (
                  <Link
                    href={withLocale(`/dashboard/rfqs/${rfq.id}`, locale)}
                    className="inline-flex h-8 items-center rounded-md border px-2.5 text-xs font-medium theme-secondary-button"
                  >
                    {t("rfq.edit")}
                  </Link>
                ) : null}
                {canCancelRfq(rfq.status) ? (
                  <button
                    type="button"
                    onClick={() => void cancelRfq(rfq.id)}
                    disabled={actionId === rfq.id}
                    className="inline-flex h-8 items-center rounded-md border border-red-200 px-2.5 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-60"
                  >
                    {t("rfq.cancel")}
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border p-6 text-sm theme-surface-elevated">
          <p className="font-medium theme-foreground">{t("rfq.noRfqs")}</p>
          <p className="mt-1 theme-muted">{t("rfq.noRfqsDescription")}</p>
        </div>
      )}
    </section>
  );
}

export function StatusBadge({ status }: { status: RfqRecord["status"] }) {
  const { locale } = useI18n();
  const tone =
    status === "MATCHING_READY" || status === "APPROVED"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "REJECTED" || status === "CANCELLED"
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-zinc-200 bg-zinc-50 text-zinc-600";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tone}`}>
      {rfqStatusLabel(status, locale)}
    </span>
  );
}
