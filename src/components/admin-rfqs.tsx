"use client";

import { useEffect, useMemo, useState } from "react";

import { StatusBadge } from "@/components/buyer-rfqs";
import { useI18n } from "@/components/i18n-provider";
import {
  isRfqRecord,
  rfqApiErrorMessage,
  type RfqRecord,
} from "@/lib/rfq";

type ActionState = Record<string, { pending: boolean; message: string; error: string }>;

export function AdminRfqs() {
  const { locale, t } = useI18n();
  const [rfqs, setRfqs] = useState<RfqRecord[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionState, setActionState] = useState<ActionState>({});

  useEffect(() => {
    let active = true;

    async function loadRfqs() {
      try {
        const response = await fetch("/api/admin/rfqs", { cache: "no-store" });
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
        setNotes(
          Object.fromEntries(data.map((rfq) => [rfq.id, rfq.adminNote ?? ""])),
        );
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

  const pendingCount = useMemo(
    () => rfqs.filter((rfq) => rfq.adminStatus === "PENDING_REVIEW").length,
    [rfqs],
  );

  async function performAction(id: string, action: "approve" | "reject" | "note") {
    setActionState((current) => ({
      ...current,
      [id]: { pending: true, message: "", error: "" },
    }));
    try {
      const response = await fetch("/api/admin/rfqs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, adminNote: notes[id] ?? "" }),
      });
      const result = (await response.json().catch(() => null)) as
        | RfqRecord
        | { error?: string }
        | null;
      if (!response.ok || !isRfqRecord(result)) {
        setActionState((current) => ({
          ...current,
          [id]: {
            pending: false,
            message: "",
            error: rfqApiErrorMessage(result, t("rfq.actionFailed")),
          },
        }));
        return;
      }
      setRfqs((current) => current.map((rfq) => (rfq.id === id ? result : rfq)));
      setNotes((current) => ({ ...current, [id]: result.adminNote ?? "" }));
      setActionState((current) => ({
        ...current,
        [id]: {
          pending: false,
          message: action === "approve" ? t("rfq.approveDone") : t("rfq.actionDone"),
          error: "",
        },
      }));
    } catch {
      setActionState((current) => ({
        ...current,
        [id]: { pending: false, message: "", error: t("rfq.actionFailed") },
      }));
    }
  }

  return (
    <section className="grid gap-4">
      <div className="rounded-2xl border p-5 theme-surface-elevated">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold theme-foreground">
              {t("rfq.adminReviewTitle")}
            </h2>
            <p className="mt-1 text-sm theme-muted">
              {t("rfq.adminReviewDescription")}
            </p>
          </div>
          <span className="w-fit rounded-full border px-2.5 py-1 text-xs font-semibold theme-success-badge">
            {pendingCount} {t("rfq.pendingReview")}
          </span>
        </div>
      </div>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm theme-muted">{t("common.loading")}</p>
      ) : rfqs.length ? (
        <div className="grid gap-4">
          {rfqs.map((rfq) => {
            const state = actionState[rfq.id];
            return (
              <article
                key={rfq.id}
                className="grid gap-4 rounded-2xl border p-5 theme-surface-elevated"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold theme-foreground">
                        {rfq.productName}
                      </h3>
                      <StatusBadge status={rfq.status} />
                    </div>
                    <p className="mt-1 text-sm theme-muted">
                      {rfq.category} · {rfq.quantity}
                      {rfq.destinationCountry ? ` · ${rfq.destinationCountry}` : ""}
                    </p>
                    <p className="mt-1 text-xs theme-muted">
                      {rfq.buyerName || rfq.buyerEmail} · {rfq.buyerCompanyName || t("rfq.noBuyerCompany")} · {new Date(rfq.createdAt).toLocaleString(locale)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void performAction(rfq.id, "approve")}
                      disabled={state?.pending}
                      className="inline-flex h-8 items-center rounded-md px-2.5 text-xs font-semibold theme-primary-button disabled:opacity-60"
                    >
                      {t("rfq.approve")}
                    </button>
                    <button
                      type="button"
                      onClick={() => void performAction(rfq.id, "reject")}
                      disabled={state?.pending}
                      className="inline-flex h-8 items-center rounded-md border border-red-200 px-2.5 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-60"
                    >
                      {t("rfq.reject")}
                    </button>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <Info label={t("rfq.sourcingType")} value={rfq.sourcingType} />
                  <Info label={t("rfq.tradeTerms")} value={rfq.tradeTerms} />
                  <Info label={t("rfq.preferredUnitPrice")} value={rfq.preferredUnitPriceAmount ? `${rfq.preferredUnitPriceCurrency ?? ""} ${rfq.preferredUnitPriceAmount}` : "-"} />
                </div>
                <div className="rounded-xl border p-4 theme-surface">
                  <p className="text-xs font-semibold uppercase tracking-wide theme-muted">
                    {t("rfq.details")}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 theme-foreground">
                    {rfq.details}
                  </p>
                </div>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium theme-foreground">{t("rfq.adminNote")}</span>
                  <textarea
                    rows={3}
                    value={notes[rfq.id] ?? ""}
                    onChange={(event) =>
                      setNotes((current) => ({ ...current, [rfq.id]: event.target.value }))
                    }
                    className="rounded-xl border px-3 py-2 text-sm outline-none transition theme-input focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
                  />
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void performAction(rfq.id, "note")}
                    disabled={state?.pending}
                    className="inline-flex h-8 items-center rounded-md border px-2.5 text-xs font-medium theme-secondary-button disabled:opacity-60"
                  >
                    {t("rfq.saveNote")}
                  </button>
                  {state?.message ? <span className="text-xs text-emerald-700">{state.message}</span> : null}
                  {state?.error ? <span className="text-xs text-red-700">{state.error}</span> : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border p-6 text-sm theme-surface-elevated">
          <p className="font-medium theme-foreground">{t("rfq.noAdminRfqs")}</p>
        </div>
      )}
    </section>
  );
}

function Info({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-xl border p-3 theme-surface">
      <p className="text-xs font-semibold uppercase tracking-wide theme-muted">
        {label}
      </p>
      <p className="mt-1 text-sm theme-foreground">{value || "-"}</p>
    </div>
  );
}
