"use client";

import { useEffect, useMemo, useState } from "react";
import { getDictionary, type Locale } from "@/lib/i18n";

type Metrics = {
  readyTransferCount?: number;
  readyTransferAmount?: Record<string, number>;
  heldSettlementCount?: number;
  heldAmount?: Record<string, number>;
  retryDueTransferCount?: number;
  pendingReversalCount?: number;
  pendingReversalAmount?: Record<string, number>;
  retryDueReversalCount?: number;
  manualReviewCount?: number;
  staleExecutionCount?: number;
  successfulTransferCount?: number;
  successfulReversalCount?: number;
  failedTransferCount?: number;
  transferredAmount?: Record<string, number>;
  reversedAmount?: Record<string, number>;
};

type Preview = {
  transferCandidates?: Array<{ id: string; amount: number; currency: string }>;
  reversalCandidates?: Array<{ id: string; amount: number; currency: string }>;
  excludedRows?: Array<{ id: string; kind: string; amount: number; currency: string; reason: string }>;
  totalCandidateAmountByCurrency?: Record<string, number>;
  retryDueCount?: number;
  staleLockCount?: number;
  manualReviewCount?: number;
  oldestCandidateAgeMs?: number;
};

type Alert = { id: string; title: string; sanitizedMessage: string; severity: string; status: string };

function formatAmounts(amounts?: Record<string, number>) {
  if (!amounts || Object.keys(amounts).length === 0) return "—";
  return Object.entries(amounts).map(([currency, amount]) => `${currency.toUpperCase()} ${amount}`).join(", ");
}

export function AdminSettlementOperationsSummary({ locale }: { locale: Locale }) {
  const copy = getDictionary(locale).settlements;
  const [metrics, setMetrics] = useState<Metrics>({});
  const [preview, setPreview] = useState<Preview>({});
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [flow, setFlow] = useState("SCT");
  const [legType, setLegType] = useState("");
  const [status, setStatus] = useState("");
  const [currency, setCurrency] = useState("");
  const [seller, setSeller] = useState("");
  const [partner, setPartner] = useState("");
  const [disputeStatus, setDisputeStatus] = useState("");
  const [refundStatus, setRefundStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [retryDue, setRetryDue] = useState("");
  const [stale, setStale] = useState("");
  const [manualReview, setManualReview] = useState("");
  const [error, setError] = useState(false);

  const query = useMemo(() => {
    const params = new URLSearchParams({ paymentFlow: flow });
    if (legType) params.set("legType", legType);
    if (status) params.set("status", status);
    if (currency) params.set("currency", currency);
    if (seller) params.set("seller", seller);
    if (partner) params.set("partner", partner);
    if (disputeStatus) params.set("disputeStatus", disputeStatus);
    if (refundStatus) params.set("refundStatus", refundStatus);
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    if (retryDue) params.set("retryDue", retryDue);
    if (stale) params.set("stale", stale);
    if (manualReview) params.set("manualReview", manualReview);
    return params.toString();
  }, [flow, legType, status, currency, seller, partner, disputeStatus, refundStatus, dateFrom, dateTo, retryDue, stale, manualReview]);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch("/api/admin/settlements/operations/metrics", { signal: controller.signal }).then((response) => response.json()),
      fetch(`/api/admin/settlements/operations/preview?${query}`, { signal: controller.signal }).then((response) => response.json()),
      fetch("/api/admin/settlements/operations/alerts", { signal: controller.signal }).then((response) => response.json()),
    ]).then(([metricsPayload, previewPayload, alertsPayload]) => {
      if (!metricsPayload.ok || !previewPayload.ok || !alertsPayload.ok) throw new Error("operations unavailable");
      setMetrics(metricsPayload);
      setPreview(previewPayload);
      setAlerts(alertsPayload.alerts ?? []);
      setError(false);
    }).catch(() => {
      if (!controller.signal.aborted) setError(true);
    });
    return () => controller.abort();
  }, [query]);

  async function updateAlert(alertId: string, action: "acknowledge" | "resolve") {
    const response = await fetch(`/api/admin/settlements/operations/alerts/${encodeURIComponent(alertId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const payload = await response.json();
    if (!response.ok || payload.ok !== true) return;
    setAlerts((current) => current.map((alert) => alert.id === alertId ? { ...alert, status: action === "resolve" ? "RESOLVED" : "ACKNOWLEDGED" } : alert));
  }

  const cards = [
    [copy.readyTransferCount, `${metrics.readyTransferCount ?? "—"} · ${formatAmounts(metrics.readyTransferAmount)}`],
    [copy.heldSettlementCount, `${metrics.heldSettlementCount ?? "—"} · ${formatAmounts(metrics.heldAmount)}`],
    [copy.retryDueTransferCount, preview.retryDueCount ?? metrics.retryDueTransferCount],
    [copy.failedTransferCount, metrics.failedTransferCount],
    [copy.pendingReversalCount, `${metrics.pendingReversalCount ?? "—"} · ${formatAmounts(metrics.pendingReversalAmount)}`],
    [copy.retryDueReversalCount, metrics.retryDueReversalCount],
    [copy.manualReviewCount, metrics.manualReviewCount],
    [copy.staleExecutionCount, preview.staleLockCount ?? metrics.staleExecutionCount],
    [copy.successfulTransferCount, metrics.successfulTransferCount],
    [copy.successfulReversalCount, metrics.successfulReversalCount],
  ];

  return (
    <section className="grid gap-3" aria-labelledby="settlement-operations-summary">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="settlement-operations-summary" className="text-sm font-semibold theme-foreground">{copy.operationsSummary}</h2>
          <p className="mt-1 text-xs theme-muted">{copy.legacySct} · {copy.directCharge}: {locale === "ko" ? "현재 Direct Charge 정산 경로 없음" : "Direct Charge settlement route unavailable"}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <label className="grid gap-1"><span className="theme-muted">{copy.paymentFlow}</span><select value={flow} onChange={(event) => setFlow(event.target.value)} className="rounded border border-zinc-300 bg-white px-2 py-1 theme-foreground"><option value="SCT">{copy.legacySct}</option><option value="DIRECT_CHARGE">{copy.directCharge}</option></select></label>
          <label className="grid gap-1"><span className="theme-muted">{copy.legType}</span><select value={legType} onChange={(event) => setLegType(event.target.value)} className="rounded border border-zinc-300 bg-white px-2 py-1 theme-foreground"><option value="">{copy.all}</option><option value="SELLER_PAYABLE">{copy.sellerPayableShort}</option><option value="PARTNER_REFERRAL">{copy.partnerReferralShort}</option></select></label>
          <label className="grid gap-1"><span className="theme-muted">{copy.status}</span><select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded border border-zinc-300 bg-white px-2 py-1 theme-foreground"><option value="">{copy.all}</option><option value="READY">READY</option><option value="HOLD">HOLD</option><option value="TRANSFER_PENDING">TRANSFER_PENDING</option><option value="TRANSFERRED">TRANSFERRED</option></select></label>
          <label className="grid gap-1"><span className="theme-muted">{copy.currency}</span><input value={currency} onChange={(event) => setCurrency(event.target.value)} className="w-20 rounded border border-zinc-300 bg-white px-2 py-1 theme-foreground" placeholder="usd" /></label>
          <label className="grid gap-1"><span className="theme-muted">{copy.seller}</span><input value={seller} onChange={(event) => setSeller(event.target.value)} className="w-28 rounded border border-zinc-300 bg-white px-2 py-1 theme-foreground" /></label>
          <label className="grid gap-1"><span className="theme-muted">{copy.partner}</span><input value={partner} onChange={(event) => setPartner(event.target.value)} className="w-28 rounded border border-zinc-300 bg-white px-2 py-1 theme-foreground" /></label>
          <label className="grid gap-1"><span className="theme-muted">{copy.disputeStatus}</span><select value={disputeStatus} onChange={(event) => setDisputeStatus(event.target.value)} className="rounded border border-zinc-300 bg-white px-2 py-1 theme-foreground"><option value="">{copy.filterNone}</option><option value="none">{copy.noDispute}</option><option value="open">OPEN</option><option value="won">WON</option><option value="lost">LOST</option></select></label>
          <label className="grid gap-1"><span className="theme-muted">{copy.refundStatus}</span><select value={refundStatus} onChange={(event) => setRefundStatus(event.target.value)} className="rounded border border-zinc-300 bg-white px-2 py-1 theme-foreground"><option value="">{copy.filterNone}</option><option value="none">{copy.notRefunded}</option><option value="partial">{copy.partialRefund}</option><option value="full">{copy.fullRefund}</option></select></label>
          <label className="grid gap-1"><span className="theme-muted">{copy.dateFrom}</span><input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="rounded border border-zinc-300 bg-white px-2 py-1 theme-foreground" /></label>
          <label className="grid gap-1"><span className="theme-muted">{copy.dateTo}</span><input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="rounded border border-zinc-300 bg-white px-2 py-1 theme-foreground" /></label>
          <label className="grid gap-1"><span className="theme-muted">{copy.retryDue}</span><select value={retryDue} onChange={(event) => setRetryDue(event.target.value)} className="rounded border border-zinc-300 bg-white px-2 py-1 theme-foreground"><option value="">{copy.filterNone}</option><option value="true">{copy.retryDue}</option></select></label>
          <label className="grid gap-1"><span className="theme-muted">{copy.stale}</span><select value={stale} onChange={(event) => setStale(event.target.value)} className="rounded border border-zinc-300 bg-white px-2 py-1 theme-foreground"><option value="">{copy.filterNone}</option><option value="true">{copy.stale}</option></select></label>
          <label className="grid gap-1"><span className="theme-muted">{copy.manualReview}</span><select value={manualReview} onChange={(event) => setManualReview(event.target.value)} className="rounded border border-zinc-300 bg-white px-2 py-1 theme-foreground"><option value="">{copy.filterNone}</option><option value="true">{copy.manualReview}</option><option value="false">{copy.all}</option></select></label>
        </div>
      </div>
      {error ? <p className="text-sm theme-danger-text" role="status">{copy.loadOperationsError}</p> : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map(([label, value]) => <div key={label} className="rounded-lg border theme-border bg-white/70 p-3"><p className="text-xs theme-muted">{label}</p><p className="mt-1 text-xl font-semibold theme-foreground">{value ?? "—"}</p></div>)}
      </div>
      <p className="text-xs theme-muted">{copy.dryRun}: {preview.transferCandidates?.length ?? 0}</p>
      <p className="text-xs theme-muted">{copy.candidateAmount}: {formatAmounts(preview.totalCandidateAmountByCurrency)}</p>
      <p className="text-xs theme-muted">{copy.oldestCandidateAge}: {preview.oldestCandidateAgeMs ? `${Math.round(preview.oldestCandidateAgeMs / 60000)} min` : "—"}</p>
      <div className="grid gap-2 text-xs">
        <p className="font-medium theme-foreground">{copy.excludedRows}: {preview.excludedRows?.length ?? 0}</p>
        {preview.excludedRows?.slice(0, 10).map((row) => <p key={`${row.kind}:${row.id}`} className="theme-muted">{row.kind} · {row.id} · {row.reason}</p>)}
      </div>
      <div className="grid gap-2">
        <h3 className="text-sm font-semibold theme-foreground">{copy.operationalAlerts}</h3>
        {alerts.length === 0 ? <p className="text-xs theme-muted">{copy.noAlerts}</p> : alerts.slice(0, 20).map((alert) => (
          <div key={alert.id} className="flex flex-wrap items-center justify-between gap-2 border theme-border bg-white/70 p-2 text-xs">
            <div><p className="font-medium theme-foreground">{alert.title}</p><p className="theme-muted">{alert.sanitizedMessage}</p></div>
            <div className="flex items-center gap-2"><span className="theme-muted">{alert.severity} · {alert.status}</span>{alert.status !== "RESOLVED" ? <button type="button" className="border theme-border px-2 py-1 theme-foreground" onClick={() => void updateAlert(alert.id, alert.status === "OPEN" ? "acknowledge" : "resolve")}>{alert.status === "OPEN" ? copy.acknowledge : copy.resolve}</button> : null}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
