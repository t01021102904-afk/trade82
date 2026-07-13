"use client";

import { CreditCard, ExternalLink, Landmark, RefreshCw, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useI18n } from "@/components/i18n-provider";

type PaymentCompany = {
  id: string;
  legalName: string;
  tradeName: string | null;
  owner?: { email: string; displayName: string };
};

type AdminPaymentRequest = {
  id: string;
  inquiryId: string;
  productName: string;
  quantity: string;
  unit: string;
  productAmount: number;
  shippingAmount: number;
  grossAmount: number;
  platformFeeAmount: number;
  sellerPayableAmount: number;
  stripeProcessingFeeAmount: number | null;
  stripeFeeSyncStatus: "PENDING" | "SYNCED" | "FAILED";
  stripeFeeSyncError: string | null;
  stripeFeeSyncedAt: string | null;
  refundAmount: number;
  currency: string;
  paymentDueDate: string;
  status: string;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  stripeChargeId: string | null;
  paidAt: string | null;
  releasedAt: string | null;
  manualPayoutReference: string | null;
  manualPayoutDate: string | null;
  manualPayoutNote: string | null;
  sellerReleasedAmount: number | null;
  requiresManualReconciliation: boolean;
  reconciliationNote: string | null;
  releasedByUser: { id: string; displayName: string; email: string } | null;
  createdAt: string;
  buyerCompany: PaymentCompany;
  sellerCompany: PaymentCompany;
  disputes: Array<{
    status: string;
    reason: string | null;
    amount: number;
    updatedAt: string;
  }>;
};

function companyName(company: PaymentCompany) {
  return company.tradeName || company.legalName;
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

function truncateStripeId(value: string | null) {
  return value && value.length > 18 ? `${value.slice(0, 9)}…${value.slice(-6)}` : value;
}

function statusTone(status: string) {
  if (status === "PAID" || status === "RELEASED") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "DISPUTED" || status.includes("REFUND")) return "border-amber-200 bg-amber-50 text-amber-900";
  if (status === "CANCELLED") return "border-zinc-200 bg-zinc-100 text-zinc-600";
  return "border-blue-200 bg-blue-50 text-blue-800";
}

function paymentStatusLabel(status: string, t: (key: string, fallback?: string) => string) {
  const keys: Record<string, string> = {
    PENDING: "payments.paymentPending",
    PAID: "payments.paymentPaid",
    RELEASED: "payments.paymentReleased",
    CANCELLED: "payments.paymentCancelled",
    PARTIALLY_REFUNDED: "payments.paymentPartiallyRefunded",
    REFUNDED: "payments.paymentRefunded",
    DISPUTED: "payments.paymentDisputed",
  };
  return t(keys[status] ?? "payments.paymentPending", status);
}

function isAdminPaymentRequest(value: unknown): value is AdminPaymentRequest {
  return Boolean(value && typeof value === "object" && "id" in value && "status" in value);
}

export function AdminPaymentRequests() {
  const { t } = useI18n();
  const [paymentRequests, setPaymentRequests] = useState<AdminPaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [payoutReference, setPayoutReference] = useState("");
  const [payoutDate, setPayoutDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [payoutNote, setPayoutNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [refreshingFeeId, setRefreshingFeeId] = useState<string | null>(null);

  const selected = useMemo(
    () => paymentRequests.find((paymentRequest) => paymentRequest.id === selectedId) ?? null,
    [paymentRequests, selectedId],
  );

  useEffect(() => {
    if (!selected || saving) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedId(null);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [saving, selected]);

  useEffect(() => {
    let active = true;
    void fetch("/api/admin/payment-requests", { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json().catch(() => null)) as
          | AdminPaymentRequest[]
          | { error?: string }
          | null;
        if (!active) return;
        if (!response.ok || !Array.isArray(result)) {
          setError(!Array.isArray(result) ? result?.error ?? "Unable to load payment requests." : "Unable to load payment requests.");
          return;
        }
        setPaymentRequests(result);
      })
      .catch(() => {
        if (active) setError("Unable to load payment requests.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  function openPayoutDialog(paymentRequest: AdminPaymentRequest) {
    setSelectedId(paymentRequest.id);
    setPayoutReference(paymentRequest.manualPayoutReference ?? "");
    setPayoutDate(
      paymentRequest.manualPayoutDate
        ? paymentRequest.manualPayoutDate.slice(0, 10)
        : new Date().toISOString().slice(0, 10),
    );
    setPayoutNote(paymentRequest.manualPayoutNote ?? "");
    setError("");
  }

  async function submitPayout() {
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/payment-requests/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "record_manual_payout",
          payoutReference,
          payoutDate,
          payoutNote,
        }),
      });
      const result = (await response.json().catch(() => null)) as AdminPaymentRequest | { error?: string } | null;
      if (!response.ok || !isAdminPaymentRequest(result)) {
        setError(result && !isAdminPaymentRequest(result) ? result.error ?? "Unable to record the payout." : "Unable to record the payout.");
        return;
      }
      setPaymentRequests((current) =>
        current.map((paymentRequest) =>
          paymentRequest.id === result.id
            ? { ...paymentRequest, ...result, buyerCompany: { ...paymentRequest.buyerCompany, ...result.buyerCompany }, sellerCompany: { ...paymentRequest.sellerCompany, ...result.sellerCompany } }
            : paymentRequest,
        ),
      );
      setSelectedId(null);
    } catch {
      setError("Unable to record the payout.");
    } finally {
      setSaving(false);
    }
  }

  async function refreshStripeFee(paymentRequestId: string) {
    setRefreshingFeeId(paymentRequestId);
    setError("");
    try {
      const response = await fetch(
        `/api/admin/payment-requests/${paymentRequestId}/refresh-stripe-fee`,
        { method: "POST" },
      );
      const result = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;
      if (!response.ok) {
        setError(result?.error ?? "Unable to refresh the Stripe fee.");
        return;
      }
      const refreshed = await fetch("/api/admin/payment-requests", { cache: "no-store" });
      const requests = (await refreshed.json().catch(() => null)) as AdminPaymentRequest[] | null;
      if (refreshed.ok && Array.isArray(requests)) setPaymentRequests(requests);
    } catch {
      setError("Unable to refresh the Stripe fee.");
    } finally {
      setRefreshingFeeId(null);
    }
  }

  if (loading) return <p className="text-sm theme-muted">{t("payments.loadingPayments")}</p>;

  return (
    <section className="grid gap-4">
      {error && !selected ? <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      {paymentRequests.length ? (
        paymentRequests.map((paymentRequest) => {
          const dispute = paymentRequest.disputes[0] ?? null;
          const activeDispute = Boolean(
            dispute && !["won", "lost", "prevented", "warning_closed", "charge_refunded"].includes(dispute.status),
          );
          const canRelease =
            paymentRequest.status === "PAID" &&
            paymentRequest.refundAmount === 0 &&
            !paymentRequest.requiresManualReconciliation &&
            !activeDispute;
          return (
            <article key={paymentRequest.id} className="rounded-lg border p-5 theme-surface-elevated">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide theme-muted">{t("payments.paymentRequest")}</p>
                  <h2 className="mt-1 truncate text-lg font-semibold theme-foreground">{paymentRequest.productName}</h2>
                  <p className="mt-1 text-sm theme-muted">{paymentRequest.quantity} {paymentRequest.unit} · {new Date(paymentRequest.createdAt).toLocaleDateString()}</p>
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusTone(paymentRequest.status)}`}>
                  {paymentStatusLabel(paymentRequest.status, t)}
                </span>
              </div>

              <div className="mt-5 grid gap-4 border-t pt-4 text-sm sm:grid-cols-2 lg:grid-cols-4 theme-border">
                <PaymentMetric label={t("payments.buyer")} value={companyName(paymentRequest.buyerCompany)} detail={paymentRequest.buyerCompany.owner?.email} />
                <PaymentMetric label={t("payments.seller")} value={companyName(paymentRequest.sellerCompany)} detail={paymentRequest.sellerCompany.owner?.email} />
                <PaymentMetric label={t("payments.productAmount")} value={formatMoney(paymentRequest.productAmount, paymentRequest.currency)} />
                <PaymentMetric label={t("payments.shippingAmount")} value={formatMoney(paymentRequest.shippingAmount, paymentRequest.currency)} />
                <PaymentMetric label={t("payments.grossAmount")} value={formatMoney(paymentRequest.grossAmount, paymentRequest.currency)} />
                <PaymentMetric label={t("payments.platformFee")} value={formatMoney(paymentRequest.platformFeeAmount, paymentRequest.currency)} />
                <PaymentMetric label={t("payments.sellerPayable")} value={formatMoney(paymentRequest.sellerPayableAmount, paymentRequest.currency)} />
                <PaymentMetric label={t("payments.stripeProcessingFee")} value={paymentRequest.stripeProcessingFeeAmount === null ? "—" : formatMoney(paymentRequest.stripeProcessingFeeAmount, paymentRequest.currency)} detail={paymentRequest.stripeFeeSyncStatus === "FAILED" ? paymentRequest.stripeFeeSyncError ?? undefined : paymentRequest.stripeFeeSyncStatus} />
                <PaymentMetric label={t("payments.refundAmount")} value={formatMoney(paymentRequest.refundAmount, paymentRequest.currency)} />
                <PaymentMetric label={t("payments.disputeAmount")} value={dispute ? formatMoney(dispute.amount, paymentRequest.currency) : "—"} />
                <PaymentMetric label={t("payments.disputeStatus")} value={dispute?.status ?? "—"} detail={dispute?.reason ?? undefined} />
                <PaymentMetric label={t("payments.payoutStatus")} value={paymentRequest.status === "RELEASED" ? t("payments.paymentReleased") : t("payments.payoutPending")} detail={paymentRequest.manualPayoutReference ?? undefined} />
                <PaymentMetric label={t("payments.sellerReleasedAmount")} value={paymentRequest.sellerReleasedAmount === null ? "—" : formatMoney(paymentRequest.sellerReleasedAmount, paymentRequest.currency)} detail={paymentRequest.releasedByUser?.displayName} />
                <PaymentMetric label={t("payments.payoutDate")} value={paymentRequest.manualPayoutDate ? new Date(paymentRequest.manualPayoutDate).toLocaleDateString() : "—"} detail={paymentRequest.manualPayoutNote ?? undefined} />
                <PaymentMetric label={t("payments.reconciliation")} value={paymentRequest.requiresManualReconciliation ? t("payments.reconciliationRequired") : t("payments.reconciliationClear")} detail={paymentRequest.reconciliationNote ?? undefined} />
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4 theme-border">
                <div className="grid gap-1 text-xs theme-muted">
                  <span title={paymentRequest.stripeCheckoutSessionId ?? undefined}>Checkout: {truncateStripeId(paymentRequest.stripeCheckoutSessionId) ?? "pending"}</span>
                  <span title={paymentRequest.stripePaymentIntentId ?? undefined}>Payment intent: {truncateStripeId(paymentRequest.stripePaymentIntentId) ?? "pending"}</span>
                  <span title={paymentRequest.stripeChargeId ?? undefined}>Charge: {truncateStripeId(paymentRequest.stripeChargeId) ?? "pending"}</span>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => void refreshStripeFee(paymentRequest.id)}
                    disabled={refreshingFeeId === paymentRequest.id || !paymentRequest.stripePaymentIntentId}
                    className="inline-flex h-9 items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-800 transition hover:border-zinc-950 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <RefreshCw className={`size-4 ${refreshingFeeId === paymentRequest.id ? "animate-spin" : ""}`} />
                    {t("payments.refreshStripeFee")}
                  </button>
                  {canRelease ? (
                    <button
                      type="button"
                      onClick={() => openPayoutDialog(paymentRequest)}
                      className="inline-flex h-9 items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-800 transition hover:border-zinc-950 hover:text-zinc-950"
                    >
                      <Landmark className="size-4" />
                      {t("payments.recordManualPayout")}
                    </button>
                  ) : paymentRequest.status === "RELEASED" ? (
                    <span className="inline-flex items-center gap-2 text-xs font-medium text-emerald-700">
                      <CreditCard className="size-4" />
                      {paymentRequest.manualPayoutReference}
                    </span>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })
      ) : (
        <div className="rounded-lg border border-dashed p-6 text-sm theme-muted">{t("payments.noPaymentRequests")}</div>
      )}

      {selected ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) setSelectedId(null);
          }}
        >
          <form
            className="w-full max-w-lg rounded-xl border bg-white p-5 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="manual-payout-title"
            onSubmit={(event) => {
              event.preventDefault();
              void submitPayout();
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="manual-payout-title" className="text-lg font-semibold text-zinc-950">{t("payments.manualPayoutTitle")}</h2>
                <p className="mt-1 text-sm leading-6 text-zinc-600">{t("payments.manualPayoutDescription")}</p>
              </div>
              <button type="button" onClick={() => setSelectedId(null)} disabled={saving} className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100" aria-label={t("payments.cancel")}>
                <X className="size-5" />
              </button>
            </div>
            <p className="mt-4 rounded-md bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-900">
              {companyName(selected.sellerCompany)} · {formatMoney(selected.sellerPayableAmount, selected.currency)}
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label={t("payments.payoutReference")} value={payoutReference} onChange={setPayoutReference} required />
              <label className="grid gap-1.5 text-sm font-medium text-zinc-800">
                {t("payments.payoutDate")}
                <input type="date" value={payoutDate} onChange={(event) => setPayoutDate(event.target.value)} required className="h-10 rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-950" />
              </label>
            </div>
            <label className="mt-4 grid gap-1.5 text-sm font-medium text-zinc-800">
              {t("payments.payoutNote")}
              <textarea value={payoutNote} onChange={(event) => setPayoutNote(event.target.value)} required rows={4} className="rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-950" />
            </label>
            {error ? <p className="mt-3 text-sm font-medium text-red-700">{error}</p> : null}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" disabled={saving} onClick={() => setSelectedId(null)} className="h-10 rounded-md border border-zinc-200 px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50">{t("payments.cancel")}</button>
              <button type="submit" disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-md bg-zinc-950 px-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60">
                <ExternalLink className="size-4" />
                {t("payments.releasePayment")}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}

function PaymentMetric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs theme-muted">{label}</p>
      <p className="mt-1 truncate font-semibold theme-foreground">{value}</p>
      {detail ? <p className="mt-1 truncate text-xs theme-muted">{detail}</p> : null}
    </div>
  );
}

function Field({ label, value, onChange, required }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-zinc-800">
      {label}
      <input value={value} onChange={(event) => onChange(event.target.value)} required={required} className="h-10 rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-950" />
    </label>
  );
}
