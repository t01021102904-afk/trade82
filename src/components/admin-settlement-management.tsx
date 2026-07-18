"use client";

import { useCallback, useEffect, useState } from "react";
import { isStaleTransferPending } from "@/lib/stripe-connect-transfer-recovery";
import { isStaleSettlementReversal } from "@/lib/stripe-connect-transfer-reversal-recovery";

type SettlementCopy = {
  loading: string;
  loadError: string;
  noSettlements: string;
  approve: string;
  hold: string;
  reevaluate: string;
  executeTransfer: string;
  recoverTransfer: string;
  holdReason: string;
  holdReasonPlaceholder: string;
  saveHold: string;
  markReconciliation: string;
  reconciliationReason: string;
  reconciliationReasonPlaceholder: string;
  saveReconciliation: string;
  cancel: string;
  actionError: string;
  transferActionError: string;
  transferCompleted: string;
  transferRetryScheduled: string;
  transferFailed: string;
  transferClaimLost: string;
  transferFinalizationFailed: string;
  recoveryUnavailable: string;
  runtimeConfigurationInvalid: string;
  executeReversal: string;
  recoverReversal: string;
  reversalCompleted: string;
  reversalRetryScheduled: string;
  reversalFailed: string;
  reversalClaimLost: string;
  reversalFinalizationFailed: string;
  reversalRecoveryUnavailable: string;
  originalTransfer: string;
  requestedReversal: string;
  reversedAmount: string;
  remainingAmount: string;
  reversalSource: string;
  reversalAttempts: string;
  nextReversalAttempt: string;
  reversalLastError: string;
  approved: string;
  notApproved: string;
  holdUntil: string;
  holdReasonLabel: string;
  order: string;
  buyer: string;
  seller: string;
  gross: string;
  sellerPayable: string;
  partnerReferral: string;
  trade82Retained: string;
  legs: string;
  refundsAndDisputes: string;
  manualReconciliation: string;
  none: string;
};

type Settlement = {
  id: string;
  status: string;
  currency: string;
  grossAmount: number;
  sellerPayableAmount: number;
  partnerReferralAmount: number;
  trade82RetainedAmountBeforeStripeFees: number;
  holdUntil: string;
  holdReason: string | null;
  approvedAt: string | null;
  approvedByUser: { displayName: string; email: string } | null;
  paymentRequest: {
    status: string;
    requiresManualReconciliation: boolean;
    refundAmount: number;
    disputes: Array<{ id: string; status: string; amount: number }>;
  };
  tradeOrder: { orderNumber: string; buyerCompanyName: string; sellerCompanyName: string };
  legs: Array<{
    id: string;
    type: string;
    amount: number;
    currency: string;
    status: string;
    holdUntil: string;
    transferredAt: string | null;
    transferAttemptCount: number;
    nextTransferAttemptAt: string | null;
    transferLastError: string | null;
    transferLockedAt: string | null;
    recipientCompany: { legalName: string; tradeName: string | null } | null;
    partnerProfile: { referralCode: string } | null;
  }>;
  reversals: Array<{
    id: string;
    settlementLegId: string;
    amount: number;
    currency: string;
    reason: string;
    status: string;
    stripeRefundId: string | null;
    stripeDisputeId: string | null;
    requestedAmount: number | null;
    successfullyReversedAmount: number;
    sourceType: string | null;
    stripeSourceObjectId: string | null;
    originalStripeTransferId: string | null;
    reversalAttemptCount: number;
    nextReversalAttemptAt: string | null;
    reversalLockedAt: string | null;
    reversalLastError: string | null;
    stripeTransferReversalId: string | null;
    completedAt: string | null;
  }>;
};

function hasTransferPendingLeg(settlement: Settlement) {
  return settlement.legs.some((leg) => (
    (leg.type === "SELLER_PAYABLE" || leg.type === "PARTNER_REFERRAL")
    && leg.status === "TRANSFER_PENDING"
  ));
}

function money(amount: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amount / 100);
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

type TransferResponse = {
  ok?: boolean;
  status?: string;
  errorCode?: string;
  nextTransferAttemptAt?: string | null;
};

function transferOperatorMessage(payload: TransferResponse | null, copy: SettlementCopy) {
  if (payload?.status === "retry_scheduled") {
    const retryAt = payload.nextTransferAttemptAt;
    if (retryAt && Number.isFinite(Date.parse(retryAt))) {
      return `${copy.transferRetryScheduled} ${dateTime(retryAt)}`;
    }
    return copy.transferRetryScheduled;
  }
  if (payload?.status === "claim_lost") return copy.transferClaimLost;
  if (payload?.status === "finalization_failed") return copy.transferFinalizationFailed;
  if (payload?.errorCode === "runtime_configuration_invalid") return copy.runtimeConfigurationInvalid;
  if (payload?.errorCode === "transfer_locked" || payload?.errorCode === "not_claimable") {
    return copy.recoveryUnavailable;
  }
  return copy.transferFailed;
}

type ReversalResponse = {
  ok?: boolean;
  status?: string;
  errorCode?: string;
  nextReversalAttemptAt?: string | null;
};

function reversalOperatorMessage(payload: ReversalResponse | null, copy: SettlementCopy) {
  if (payload?.status === "retry_scheduled") {
    const retryAt = payload.nextReversalAttemptAt;
    if (retryAt && Number.isFinite(Date.parse(retryAt))) {
      return `${copy.reversalRetryScheduled} ${dateTime(retryAt)}`;
    }
    return copy.reversalRetryScheduled;
  }
  if (payload?.status === "claim_lost") return copy.reversalClaimLost;
  if (payload?.status === "finalization_failed") return copy.reversalFinalizationFailed;
  if (payload?.errorCode === "reversal_locked" || payload?.errorCode === "reversal_retry_not_due") {
    return copy.reversalRecoveryUnavailable;
  }
  return copy.reversalFailed;
}

export function AdminSettlementManagement({ copy }: { copy: SettlementCopy }) {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transferNotice, setTransferNotice] = useState<string | null>(null);
  const [reversalNotice, setReversalNotice] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [transferActionId, setTransferActionId] = useState<string | null>(null);
  const [reversalActionId, setReversalActionId] = useState<string | null>(null);
  const [holdTarget, setHoldTarget] = useState<string | null>(null);
  const [holdReason, setHoldReason] = useState("");
  const [reconciliationTarget, setReconciliationTarget] = useState<string | null>(null);
  const [reconciliationReason, setReconciliationReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/settlements", { cache: "no-store" });
      const payload = await response.json().catch(() => null) as { settlements?: Settlement[]; error?: string } | null;
      if (!response.ok || !payload?.settlements) throw new Error(payload?.error || copy.loadError);
      setSettlements(payload.settlements);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : copy.loadError);
    } finally {
      setLoading(false);
    }
  }, [copy.loadError]);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/admin/settlements", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json().catch(() => null) as { settlements?: Settlement[]; error?: string } | null;
        if (!response.ok || !payload?.settlements) throw new Error(payload?.error || copy.loadError);
        setSettlements(payload.settlements);
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : copy.loadError);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [copy.loadError]);

  async function runAction(id: string, action: "approve" | "hold" | "reevaluate") {
    if (action === "hold" && holdReason.trim().length < 3) return;
    setActionId(id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/settlements/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...(action === "hold" ? { reason: holdReason.trim() } : {}) }),
      });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error || copy.actionError);
      setHoldTarget(null);
      setHoldReason("");
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : copy.actionError);
    } finally {
      setActionId(null);
    }
  }

  async function runReconciliation(id: string) {
    if (reconciliationReason.trim().length < 3) return;
    setActionId(id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/settlements/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_reconciliation", reason: reconciliationReason.trim() }),
      });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error || copy.actionError);
      setReconciliationTarget(null);
      setReconciliationReason("");
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : copy.actionError);
    } finally {
      setActionId(null);
    }
  }

  async function runTransfer(legId: string) {
    setTransferActionId(legId);
    setError(null);
    setTransferNotice(null);
    setReversalNotice(null);
    try {
      const response = await fetch(`/api/admin/settlements/legs/${legId}/transfer`, {
        method: "POST",
      });
      const payload = await response.json().catch(() => null) as TransferResponse | null;
      if (response.ok && payload?.ok === true && payload.status === "transferred") {
        await load();
        setTransferNotice(copy.transferCompleted);
        return;
      }
      const message = transferOperatorMessage(payload, copy);
      await load();
      setError(message);
    } catch {
      setError(copy.transferActionError);
    } finally {
      setTransferActionId(null);
    }
  }

  async function runReversal(reversalId: string) {
    setReversalActionId(reversalId);
    setError(null);
    setReversalNotice(null);
    try {
      const response = await fetch(`/api/admin/settlements/reversals/${reversalId}/execute`, { method: "POST" });
      const payload = await response.json().catch(() => null) as ReversalResponse | null;
      if (response.ok && payload?.ok === true && payload.status === "reversed") {
        await load();
        setReversalNotice(copy.reversalCompleted);
        return;
      }
      const message = reversalOperatorMessage(payload, copy);
      await load();
      setError(message);
    } catch {
      setError(copy.reversalFailed);
    } finally {
      setReversalActionId(null);
    }
  }

  if (loading) return <p className="text-sm theme-muted">{copy.loading}</p>;
  if (error && settlements.length === 0) return <p className="text-sm text-red-700">{error}</p>;

  return (
    <section className="grid gap-4" aria-live="polite">
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {transferNotice ? <p className="text-sm text-emerald-700">{transferNotice}</p> : null}
      {reversalNotice ? <p className="text-sm text-emerald-700">{reversalNotice}</p> : null}
      {settlements.length === 0 ? <p className="text-sm theme-muted">{copy.noSettlements}</p> : null}
      {settlements.map((settlement) => {
        const transferPending = hasTransferPendingLeg(settlement);
        return (
        <article key={settlement.id} className="border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold theme-foreground">{copy.order} {settlement.tradeOrder.orderNumber}</p>
              <p className="mt-1 text-sm theme-muted">{copy.buyer}: {settlement.tradeOrder.buyerCompanyName} · {copy.seller}: {settlement.tradeOrder.sellerCompanyName}</p>
            </div>
            <span className="border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700">{settlement.status}</span>
          </div>

          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div><dt className="theme-muted">{copy.gross}</dt><dd className="mt-1 font-medium">{money(settlement.grossAmount, settlement.currency)}</dd></div>
            <div><dt className="theme-muted">{copy.sellerPayable}</dt><dd className="mt-1 font-medium">{money(settlement.sellerPayableAmount, settlement.currency)}</dd></div>
            <div><dt className="theme-muted">{copy.partnerReferral}</dt><dd className="mt-1 font-medium">{money(settlement.partnerReferralAmount, settlement.currency)}</dd></div>
            <div><dt className="theme-muted">{copy.trade82Retained}</dt><dd className="mt-1 font-medium">{money(settlement.trade82RetainedAmountBeforeStripeFees, settlement.currency)}</dd></div>
          </dl>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs theme-muted">
            <span>{copy.holdUntil}: {dateTime(settlement.holdUntil)}</span>
            <span>{settlement.approvedAt ? `${copy.approved}: ${dateTime(settlement.approvedAt)}` : copy.notApproved}</span>
            {settlement.paymentRequest.requiresManualReconciliation ? <span className="text-amber-700">{copy.manualReconciliation}</span> : null}
          </div>
          {settlement.holdReason ? <p className="mt-2 text-sm text-amber-800">{copy.holdReasonLabel}: {settlement.holdReason}</p> : null}

          <div className="mt-4 border-t border-zinc-100 pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide theme-muted">{copy.legs}</p>
            <div className="mt-2 grid gap-2">
              {settlement.legs.map((leg) => (
                <div key={leg.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>{leg.type} · {money(leg.amount, leg.currency)}</span>
                  <span className="inline-flex items-center gap-2 text-xs theme-muted">
                    <span>{leg.status}</span>
                    {(leg.type === "SELLER_PAYABLE" || leg.type === "PARTNER_REFERRAL")
                      && (leg.status === "READY" || isStaleTransferPending(leg, new Date())) ? (
                      <button
                        type="button"
                        className="h-7 border border-zinc-300 px-2 text-xs text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
                        disabled={transferActionId === leg.id}
                        onClick={() => void runTransfer(leg.id)}
                      >
                        {leg.status === "READY" ? copy.executeTransfer : copy.recoverTransfer}
                      </button>
                    ) : null}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 border-t border-zinc-100 pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide theme-muted">{copy.refundsAndDisputes}</p>
            {settlement.reversals.length === 0 ? <p className="mt-2 text-sm theme-muted">{copy.none}</p> : (
              <div className="mt-2 grid gap-2">
                {settlement.reversals.map((reversal) => {
                  const requested = reversal.requestedAmount ?? reversal.amount;
                  const remaining = Math.max(0, requested - reversal.successfullyReversedAmount);
                  const stale = isStaleSettlementReversal(reversal, new Date());
                  const retryDue = !reversal.nextReversalAttemptAt || Date.parse(reversal.nextReversalAttemptAt) <= Date.now();
                  const lockActive = Boolean(reversal.reversalLockedAt && Date.parse(reversal.reversalLockedAt) > Date.now() - 10 * 60 * 1000);
                  const canExecute = reversal.status === "PENDING" && remaining > 0 && retryDue && !lockActive;
                  return (
                    <div key={reversal.id} className="grid gap-1 text-xs theme-muted sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                      <div>
                        <p>{reversal.reason} · {reversal.status}</p>
                        <p>{copy.originalTransfer}: {reversal.originalStripeTransferId ?? copy.none}</p>
                        <p>{copy.requestedReversal}: {money(requested, reversal.currency)} · {copy.reversedAmount}: {money(reversal.successfullyReversedAmount, reversal.currency)} · {copy.remainingAmount}: {money(remaining, reversal.currency)}</p>
                        <p>{copy.reversalSource}: {reversal.sourceType ?? reversal.reason} · {copy.reversalAttempts}: {reversal.reversalAttemptCount}</p>
                        {reversal.nextReversalAttemptAt ? <p>{copy.nextReversalAttempt}: {dateTime(reversal.nextReversalAttemptAt)}</p> : null}
                        {reversal.reversalLastError ? <p>{copy.reversalLastError}: {reversal.reversalLastError}</p> : null}
                      </div>
                      {canExecute ? (
                        <button
                          type="button"
                          className="h-7 border border-zinc-300 px-2 text-xs text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
                          disabled={reversalActionId === reversal.id}
                          onClick={() => void runReversal(reversal.id)}
                        >
                          {stale ? copy.recoverReversal : copy.executeReversal}
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="h-8 border border-zinc-300 px-3 text-sm hover:bg-zinc-50 disabled:opacity-50" disabled={actionId === settlement.id || transferPending} onClick={() => void runAction(settlement.id, "approve")}>{copy.approve}</button>
            <button type="button" className="h-8 border border-zinc-300 px-3 text-sm hover:bg-zinc-50 disabled:opacity-50" disabled={actionId === settlement.id || transferPending} onClick={() => void runAction(settlement.id, "reevaluate")}>{copy.reevaluate}</button>
            <button type="button" className="h-8 border border-amber-300 px-3 text-sm text-amber-800 hover:bg-amber-50 disabled:opacity-50" disabled={actionId === settlement.id || transferPending} onClick={() => { setHoldTarget(settlement.id); setHoldReason(settlement.holdReason ?? ""); }}>{copy.hold}</button>
            {!settlement.paymentRequest.requiresManualReconciliation ? <button type="button" className="h-8 border border-amber-300 px-3 text-sm text-amber-800 hover:bg-amber-50 disabled:opacity-50" disabled={actionId === settlement.id || transferPending} onClick={() => { setReconciliationTarget(settlement.id); setReconciliationReason(""); }}>{copy.markReconciliation}</button> : null}
          </div>
          {holdTarget === settlement.id ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
              <input aria-label={copy.holdReason} className="h-9 border border-zinc-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={holdReason} onChange={(event) => setHoldReason(event.target.value)} placeholder={copy.holdReasonPlaceholder} maxLength={1000} />
              <button type="button" className="h-9 border border-amber-300 px-3 text-sm text-amber-800 disabled:opacity-50" disabled={actionId === settlement.id || holdReason.trim().length < 3} onClick={() => void runAction(settlement.id, "hold")}>{copy.saveHold}</button>
              <button type="button" className="h-9 border border-zinc-300 px-3 text-sm" disabled={actionId === settlement.id} onClick={() => setHoldTarget(null)}>{copy.cancel}</button>
            </div>
          ) : null}
          {reconciliationTarget === settlement.id ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
              <input aria-label={copy.reconciliationReason} className="h-9 border border-zinc-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={reconciliationReason} onChange={(event) => setReconciliationReason(event.target.value)} placeholder={copy.reconciliationReasonPlaceholder} maxLength={1000} />
              <button type="button" className="h-9 border border-amber-300 px-3 text-sm text-amber-800 disabled:opacity-50" disabled={actionId === settlement.id || reconciliationReason.trim().length < 3} onClick={() => void runReconciliation(settlement.id)}>{copy.saveReconciliation}</button>
              <button type="button" className="h-9 border border-zinc-300 px-3 text-sm" disabled={actionId === settlement.id} onClick={() => setReconciliationTarget(null)}>{copy.cancel}</button>
            </div>
          ) : null}
        </article>
        );
      })}
    </section>
  );
}
