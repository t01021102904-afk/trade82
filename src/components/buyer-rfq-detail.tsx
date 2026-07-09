"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { BuyerRfqForm } from "@/components/buyer-rfq-form";
import { StatusBadge } from "@/components/buyer-rfqs";
import { useI18n } from "@/components/i18n-provider";
import { withLocale } from "@/lib/i18n";
import {
  canCancelRfq,
  canEditRfq,
  isRfqRecord,
  rfqApiErrorMessage,
  type RfqRecord,
} from "@/lib/rfq";

export function BuyerRfqDetail({ id }: { id: string }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [rfq, setRfq] = useState<RfqRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionPending, setActionPending] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadRfq() {
      try {
        const response = await fetch(`/api/rfqs/${id}`, { cache: "no-store" });
        const data = (await response.json().catch(() => null)) as
          | RfqRecord
          | { error?: string }
          | null;
        if (!active) return;
        if (!response.ok || !isRfqRecord(data)) {
          setError(rfqApiErrorMessage(data, t("rfq.loadFailed")));
          return;
        }
        setRfq(data);
      } catch {
        if (active) setError(t("rfq.loadFailed"));
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadRfq();
    return () => {
      active = false;
    };
  }, [id, t]);

  async function updateStatus(action: "cancel" | "close") {
    if (action === "cancel" && !window.confirm(t("rfq.confirmCancel"))) return;
    setActionPending(true);
    setError("");
    try {
      const response = await fetch(`/api/rfqs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = (await response.json().catch(() => null)) as
        | RfqRecord
        | { error?: string }
        | null;
      if (!response.ok || !isRfqRecord(data)) {
        setError(rfqApiErrorMessage(data, t("rfq.actionFailed")));
        return;
      }
      setRfq(data);
      router.refresh();
    } catch {
      setError(t("rfq.actionFailed"));
    } finally {
      setActionPending(false);
    }
  }

  if (loading) return <p className="text-sm theme-muted">{t("common.loading")}</p>;

  if (error && !rfq) {
    return (
      <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </p>
    );
  }

  if (!rfq) return null;

  return (
    <div className="grid gap-5">
      <section className="rounded-2xl border p-5 theme-surface-elevated">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold theme-foreground">{rfq.productName}</h2>
              <StatusBadge status={rfq.status} />
            </div>
            <p className="mt-2 text-sm theme-muted">{t("rfq.reviewNotice")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={withLocale("/dashboard/rfqs", locale)}
              className="inline-flex h-9 items-center rounded-lg border px-3 text-sm font-medium theme-secondary-button"
            >
              {t("rfq.backToRfqs")}
            </Link>
            {canCancelRfq(rfq.status) ? (
              <button
                type="button"
                onClick={() => void updateStatus("cancel")}
                disabled={actionPending}
                className="inline-flex h-9 items-center rounded-lg border border-red-200 px-3 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-60"
              >
                {t("rfq.cancel")}
              </button>
            ) : null}
            {rfq.status === "MATCHING_READY" || rfq.status === "APPROVED" ? (
              <button
                type="button"
                onClick={() => void updateStatus("close")}
                disabled={actionPending}
                className="inline-flex h-9 items-center rounded-lg border px-3 text-sm font-medium theme-secondary-button disabled:opacity-60"
              >
                {t("rfq.close")}
              </button>
            ) : null}
          </div>
        </div>
        {error ? (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        {rfq.status === "REJECTED" && rfq.adminNote ? (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {rfq.adminNote}
          </p>
        ) : null}
      </section>

      {canEditRfq(rfq.status) ? (
        <BuyerRfqForm rfq={rfq} mode="edit" />
      ) : (
        <ReadOnlyRfq rfq={rfq} />
      )}
    </div>
  );
}

function ReadOnlyRfq({ rfq }: { rfq: RfqRecord }) {
  const { t } = useI18n();
  const fields = [
    [t("rfq.category"), rfq.category],
    [t("rfq.sourcingType"), rfq.sourcingType],
    [t("rfq.sourcingPurpose"), rfq.sourcingPurpose],
    [t("rfq.quantity"), rfq.quantity],
    [t("rfq.tradeTerms"), rfq.tradeTerms],
    [t("rfq.destinationCountry"), rfq.destinationCountry],
    [
      t("rfq.preferredUnitPrice"),
      rfq.preferredUnitPriceAmount
        ? `${rfq.preferredUnitPriceCurrency ?? ""} ${rfq.preferredUnitPriceAmount}`
        : "",
    ],
    [t("rfq.targetDeliveryDate"), rfq.targetDeliveryDate?.slice(0, 10)],
    [t("rfq.shape"), rfq.shape],
    [t("rfq.capacity"), rfq.capacity],
    [t("rfq.material"), rfq.material],
    [t("rfq.certification"), rfq.certification],
    [t("rfq.feature"), rfq.feature],
  ].filter(([, value]) => Boolean(value));

  return (
    <section className="grid gap-4 rounded-2xl border p-5 theme-surface-elevated">
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map(([label, value]) => (
          <div key={label} className="rounded-xl border p-3 theme-surface">
            <p className="text-xs font-semibold uppercase tracking-wide theme-muted">
              {label}
            </p>
            <p className="mt-1 text-sm theme-foreground">{value}</p>
          </div>
        ))}
      </div>
      <div className="rounded-xl border p-4 theme-surface">
        <p className="text-xs font-semibold uppercase tracking-wide theme-muted">
          {t("rfq.details")}
        </p>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 theme-foreground">
          {rfq.details}
        </p>
      </div>
    </section>
  );
}
