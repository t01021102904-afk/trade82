"use client";

import {
  ClipboardCopy,
  Download,
  ExternalLink,
  Loader2,
  Send,
  ShieldAlert,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { useI18n } from "@/components/i18n-provider";
import { isSafeOfficialBankWebsite } from "@/lib/bank-directory-security";
import { formatTradeDateTime, formatTradeMoney, payoutAdjustmentTypeLabel, payoutStatusLabel } from "@/lib/trade-order-i18n";

type Payout = {
  id: string;
  payoutNumber: string;
  status: string;
  currency: string;
  grossAmount: number;
  platformFeeAmount: number;
  sellerPayableAmount: number;
  refundAdjustmentAmount: number;
  manualAdjustmentAmount: number;
  finalPayoutAmount: number;
  processingFeeAmount?: number | null;
  legalCompanyName: string;
  tradeName: string | null;
  accountCountry: string;
  accountHolder: string;
  payoutCurrency: string;
  bankNameSnapshot?: string | null;
  accountNumberLast4?: string | null;
  swiftBicSnapshot?: string | null;
  officialBankWebsiteSnapshot?: string | null;
  sentAt: string | null;
  failedAt?: string | null;
  externalTransferReference?: string | null;
  externalBankReference?: string | null;
  approvedAt?: string | null;
  preparedAt?: string | null;
  adjustments: Array<{
    id: string;
    adjustmentType: "CREDIT" | "DEBIT" | "REFUND_RECOVERY" | "BANK_FEE" | "FX_ADJUSTMENT" | "OTHER";
    amount: number;
    currency: string;
    reason: string;
    internalNote: string | null;
    requiresManualReconciliation: boolean;
    createdAt: string;
    createdByUser: { displayName: string; email: string };
  }>;
};

type PartnerPayout = {
  id: string;
  payoutNumber: string;
  status: string;
  currency: string;
  originalCommissionAmount: number;
  reversalAdjustmentAmount: number;
  finalPayoutAmount: number;
  holdUntil: string;
  accountCountrySnapshot: string | null;
  bankNameSnapshot: string | null;
  accountHolderSnapshot: string | null;
  accountNumberLast4: string | null;
  accountNumberMasked: string | null;
  partnerLegalNameSnapshot: string | null;
  partnerDisplayNameSnapshot: string | null;
  partnerOrganizationSnapshot: string | null;
  partnerEmailSnapshot: string | null;
  partnerPhoneSnapshot: string | null;
  partnerResidenceCountrySnapshot: string | null;
  payoutCurrencySnapshot: string | null;
  snapshotCapturedAt: string | null;
  requiresManualReconciliation: boolean;
  sentAt: string | null;
  failedAt: string | null;
  failureReason: string | null;
  externalTransferReference: string | null;
  externalBankReference: string | null;
  partnerProfile: {
    status: string;
  } | null;
  payoutProfile: { status: string } | null;
  partnerStatus: string;
  payoutProfileStatus: string | null;
  attributionId: string | null;
  settlementLeg?: { id: string; type: string; status: string; amount: number; currency: string; holdUntil: string };
};

type RevealedInstructions = {
  payoutId: string;
  scope: string | null;
  instructions: Record<string, unknown>;
};

type AdminPayoutReviewTransaction = {
  orderId: string;
  orderNumber: string;
  transaction: {
    paymentRequestId: string;
    orderStatus: string;
    paymentStatus: string;
    paymentFlow: string;
    paidAt: string | null;
    paymentDate: string | null;
    currency: string;
    grossAmount: number;
    merchandiseAmount: number;
    totalBuyerCharge: number;
    buyerServiceFee: number | null;
    stripeProcessingFee: number | null;
    refundAmount: number;
    disputes: Array<{ id: string; status: string; amount: number }>;
    holdUntil: string;
    productName: string | null;
  };
  payment: {
    status: string;
    grossAmount: number;
    platformFeeAmount: number;
    sellerPayableAmount: number;
    stripeProcessingFeeAmount: number | null;
    refundAmount: number;
    disputes: Array<{ id: string; status: string; amount: number }>;
  };
  buyer: {
    company: string;
    contactName: string | null;
    email: string;
    phone: string | null;
    country: string;
  };
  seller: {
    company: string;
    contactName: string | null;
    email: string;
    phone: string | null;
    country: string;
  };
  sellerPayout: Payout | null;
  partnerPayout: PartnerPayout | null;
  reconciliation: {
    buyerTotalCharge: number;
    merchandiseAmount: number;
    buyerServiceFee: number | null;
    sellerPayout: number | null;
    partnerCommission: number;
    trade82Retained: number | null;
    stripeProcessingFee: number | null;
    refundAdjustment: number;
    grossAllocationDifference: number | null;
    platformFeeAllocationDifference: number | null;
    grossAllocationBalanced: boolean;
    platformFeeAllocationBalanced: boolean;
    currencyMismatch: boolean;
    unexplainedDifference: number | null;
    balanced: boolean;
  };
  warnings: string[];
  auditEvents: Array<{ id: string; eventType: string; message: string | null; createdAt: string }>;
};

function isActionableStatus(status: string) {
  return status === "READY" || status === "PROCESSING";
}

export function AdminPayoutManagement({ selectedId }: { selectedId?: string }) {
  const { locale, t } = useI18n();
  const [transactions, setTransactions] = useState<AdminPayoutReviewTransaction[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [partnerFilter, setPartnerFilter] = useState("all");
  const [warningFilter, setWarningFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [filterNow] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revealed, setRevealed] = useState<RevealedInstructions | null>(null);
  const [revealReason, setRevealReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [reference, setReference] = useState("");
  const [bankReference, setBankReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [adjustmentType, setAdjustmentType] = useState<Payout["adjustments"][number]["adjustmentType"]>("CREDIT");
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [adjustmentNote, setAdjustmentNote] = useState("");
  const [adjustmentConfirmation, setAdjustmentConfirmation] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = selectedId ? `?id=${encodeURIComponent(selectedId)}` : "";
      const response = await fetch(`/api/admin/payouts${query}`, { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(t("payouts.loadPayoutsError"));
      const nextTransactions = Array.isArray(data?.transactions) ? data.transactions : [];
      setTransactions(nextTransactions);
      setSelectedOrderId((current) => {
        if (current && nextTransactions.some((item: AdminPayoutReviewTransaction) => item.orderId === current)) return current;
        const requested = nextTransactions.find((item: AdminPayoutReviewTransaction) =>
          item.orderId === selectedId || item.sellerPayout?.id === selectedId || item.partnerPayout?.id === selectedId,
        );
        return requested?.orderId ?? nextTransactions[0]?.orderId ?? null;
      });
    } catch {
      setError(t("payouts.loadPayoutsError"));
    } finally {
      setLoading(false);
    }
  }, [selectedId, t]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!revealed || revealed.scope !== (selectedOrderId ?? selectedId ?? null)) return;
    const timer = window.setTimeout(() => setRevealed(null), 60_000);
    return () => window.clearTimeout(timer);
  }, [revealed, selectedId, selectedOrderId]);

  // A reveal belongs to the route where it was requested. Navigating to a
  // different payout immediately removes it from the rendered browser state.
  const scopeKey = selectedOrderId ?? selectedId ?? null;
  const activeReveal = revealed?.scope === scopeKey ? revealed : null;

  const filteredTransactions = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return transactions.filter((item) => {
      const status = item.sellerPayout?.status ?? item.partnerPayout?.status ?? item.transaction.paymentStatus;
      const hasPartner = Boolean(item.partnerPayout);
      const hasWarning = item.warnings.length > 0;
      const paidAt = item.transaction.paidAt ? new Date(item.transaction.paidAt).getTime() : 0;
      const matchesSearch = !normalizedSearch || [
        item.orderNumber,
        item.buyer.company,
        item.buyer.email,
        item.sellerPayout?.payoutNumber,
        item.partnerPayout?.payoutNumber,
      ].some((value) => value?.toLowerCase().includes(normalizedSearch));
      const matchesDate = dateFilter === "all"
        || (dateFilter === "7d" && paidAt >= filterNow - 7 * 86_400_000)
        || (dateFilter === "30d" && paidAt >= filterNow - 30 * 86_400_000);
      return (statusFilter === "all" || status === statusFilter)
        && (partnerFilter === "all" || (partnerFilter === "with" ? hasPartner : !hasPartner))
        && (warningFilter === "all" || (warningFilter === "warning" ? hasWarning : !hasWarning))
        && matchesDate
        && matchesSearch;
    });
  }, [dateFilter, filterNow, partnerFilter, search, statusFilter, transactions, warningFilter]);

  const selectedTransaction = filteredTransactions.find((item) => item.orderId === selectedOrderId)
    ?? transactions.find((item) => item.orderId === selectedOrderId)
    ?? filteredTransactions[0]
    ?? null;

  async function action(
    payout: Payout,
    nextAction: "hold" | "processing" | "failed" | "mark_sent",
  ) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/payouts/${payout.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          nextAction === "mark_sent"
            ? {
                action: nextAction,
                externalTransferReference: reference,
                externalBankReference: bankReference || undefined,
                confirmation,
              }
            : { action: nextAction },
        ),
      });
      await response.json().catch(() => null);
      if (!response.ok) throw new Error(t("payouts.updatePayoutError"));
      setConfirmation("");
      setReference("");
      setBankReference("");
      setRevealed(null);
      await load();
    } catch {
      setError(t("payouts.updatePayoutError"));
    } finally {
      setBusy(false);
    }
  }

  async function addAdjustment(payout: Payout) {
    const amount = Number(adjustmentAmount);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      setError(t("payouts.positiveMinorAmountError"));
      return;
    }
    if (adjustmentReason.trim().length < 3) {
      setError(t("payouts.adjustmentReasonError"));
      return;
    }
    if (!adjustmentConfirmation.trim()) {
      setError(t("payouts.adjustmentConfirmationError"));
      return;
    }
    setAdjusting(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/payouts/${payout.id}/adjustments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adjustmentType,
          amount,
          currency: payout.currency,
          reason: adjustmentReason.trim(),
          internalNote: adjustmentNote.trim() || undefined,
          confirmation: adjustmentConfirmation.trim(),
        }),
      });
      await response.json().catch(() => null);
      if (!response.ok) throw new Error(t("payouts.addAdjustmentError"));
      setAdjustmentAmount("");
      setAdjustmentReason("");
      setAdjustmentNote("");
      setAdjustmentConfirmation("");
      await load();
    } catch {
      setError(t("payouts.addAdjustmentError"));
    } finally {
      setAdjusting(false);
    }
  }

  async function reveal(payout: Payout) {
    if (revealReason.trim().length < 3) {
      setError(t("payouts.revealReasonError"));
      return;
    }
    setError("");
    try {
      const response = await fetch(`/api/admin/payouts/${payout.id}/reveal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: revealReason.trim() }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.instructions || typeof data.instructions !== "object") {
        throw new Error(t("payouts.revealError"));
      }
      setRevealed({ payoutId: payout.id, scope: scopeKey, instructions: data.instructions });
    } catch {
      setError(t("payouts.revealError"));
    }
  }

  async function partnerAction(
    payout: PartnerPayout,
    nextAction: "hold" | "processing" | "failed" | "returned" | "mark_sent",
  ) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/partner-payouts/${payout.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          nextAction === "mark_sent"
            ? {
                action: nextAction,
                externalTransferReference: reference,
                externalBankReference: bankReference || undefined,
                confirmation,
              }
            : { action: nextAction },
        ),
      });
      await response.json().catch(() => null);
      if (!response.ok) throw new Error(t("payouts.updatePayoutError"));
      setConfirmation("");
      setReference("");
      setBankReference("");
      setRevealed(null);
      await load();
    } catch {
      setError(t("payouts.updatePayoutError"));
    } finally {
      setBusy(false);
    }
  }

  async function revealPartner(payout: PartnerPayout) {
    if (revealReason.trim().length < 3) {
      setError(t("payouts.revealReasonError"));
      return;
    }
    setError("");
    try {
      const response = await fetch(`/api/admin/partner-payouts/${payout.id}/reveal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: revealReason.trim() }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.instructions || typeof data.instructions !== "object") {
        throw new Error(t("payouts.revealError"));
      }
      setRevealed({ payoutId: payout.id, scope: scopeKey, instructions: data.instructions });
    } catch {
      setError(t("payouts.revealError"));
    }
  }

  async function recordInstructionExport(payoutId: string, actionName: "copied" | "downloaded") {
    const response = await fetch(`/api/admin/payouts/${payoutId}/instructions-exported`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: actionName }),
    });
    if (!response.ok) {
      await response.json().catch(() => null);
      throw new Error(t("payouts.exportRecordError"));
    }
  }

  async function copyInstructions(payout: Payout) {
    if (activeReveal?.payoutId !== payout.id) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(activeReveal.instructions, null, 2));
      await recordInstructionExport(payout.id, "copied");
    } catch {
      setError(t("payouts.copyError"));
    }
  }

  async function downloadInstructions(payout: Payout) {
    if (activeReveal?.payoutId !== payout.id) return;
    try {
      const content = JSON.stringify(activeReveal.instructions, null, 2);
      const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `${payout.payoutNumber}-instructions.txt`;
      link.click();
      URL.revokeObjectURL(url);
      await recordInstructionExport(payout.id, "downloaded");
    } catch {
      setError(t("payouts.downloadError"));
    }
  }

  async function copyPartnerInstructions(payoutId: string) {
    if (activeReveal?.payoutId !== payoutId) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(activeReveal.instructions, null, 2));
    } catch {
      setError(t("payouts.copyError"));
    }
  }

  if (loading) return <Loader2 className="size-5 animate-spin theme-muted" />;

  const renderSellerActions = (payout: Payout) => {
    const instructionsAreRevealed = activeReveal?.payoutId === payout.id;
    const bankPortalUrl = isSafeOfficialBankWebsite(payout.officialBankWebsiteSnapshot ?? null)
      ? payout.officialBankWebsiteSnapshot
      : null;
    const canMarkSent = isActionableStatus(payout.status);
    return (
      <div className="grid gap-3 border-t pt-4 theme-border">
        {payout.status === "SENT" ? <p className="text-sm font-medium text-emerald-700">{t("payouts.externalPayoutSent").replace("{date}", formatTradeDateTime(payout.sentAt, locale))}</p> : <>
          <label className="grid gap-1 text-xs font-medium theme-muted">{t("payouts.revealReason")}<input value={revealReason} onChange={(event) => setRevealReason(event.target.value)} maxLength={500} className="input h-9" placeholder={t("payouts.revealReasonPlaceholder")} /></label>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => void reveal(payout)} className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-xs font-semibold"><ShieldAlert className="size-4" />{t("payouts.revealBankDetails")}</button>
            <button onClick={() => void copyInstructions(payout)} disabled={!instructionsAreRevealed} className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-xs font-semibold disabled:opacity-50"><ClipboardCopy className="size-4" />{t("payouts.copyInstructions")}</button>
            <button onClick={() => void downloadInstructions(payout)} disabled={!instructionsAreRevealed} className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-xs font-semibold disabled:opacity-50"><Download className="size-4" />{t("payouts.downloadInstructions")}</button>
            {bankPortalUrl ? <a href={bankPortalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-xs font-semibold"><ExternalLink className="size-4" />{t("payouts.openBankPortal")}</a> : null}
            {canMarkSent ? <button onClick={() => void action(payout, "hold")} disabled={busy} className="inline-flex h-9 items-center rounded-md border px-3 text-xs font-semibold">{t("payouts.placeOnHold")}</button> : null}
            {payout.status === "READY" || payout.status === "HOLD" ? <button onClick={() => void action(payout, "processing")} disabled={busy} className="inline-flex h-9 items-center rounded-md border px-3 text-xs font-semibold">{t("payouts.markProcessing")}</button> : null}
            {canMarkSent ? <button onClick={() => void action(payout, "failed")} disabled={busy} className="inline-flex h-9 items-center rounded-md border px-3 text-xs font-semibold text-red-700">{t("payouts.markFailed")}</button> : null}
          </div>
          {canMarkSent ? <div className="flex min-w-0 flex-wrap gap-2"><input value={reference} onChange={(event) => setReference(event.target.value)} placeholder={t("payouts.externalTransferReference")} className="input h-9 min-w-0 flex-1" /><input value={bankReference} onChange={(event) => setBankReference(event.target.value)} placeholder={t("payouts.sendingBankReference")} className="input h-9 min-w-0 flex-1" /><input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder={t("payouts.confirmationPlaceholder")} className="input h-9 min-w-0 flex-1" /><button onClick={() => void action(payout, "mark_sent")} disabled={busy || !reference || !confirmation} className="inline-flex h-9 items-center gap-2 rounded-md bg-zinc-950 px-3 text-xs font-semibold text-white disabled:opacity-50"><Send className="size-4" />{t("payouts.markSent")}</button></div> : null}
        </>}
      </div>
    );
  };

  const renderPartnerActions = (payout: PartnerPayout) => {
    const instructionsAreRevealed = activeReveal?.payoutId === payout.id;
    const canMarkSent = isActionableStatus(payout.status);
    return (
      <div className="grid gap-3 border-t pt-4 theme-border">
        {payout.status === "SENT" ? <p className="text-sm font-medium text-emerald-700">{t("payouts.externalPayoutSent").replace("{date}", formatTradeDateTime(payout.sentAt, locale))}</p> : <>
          <label className="grid gap-1 text-xs font-medium theme-muted">{t("payouts.revealReason")}<input value={revealReason} onChange={(event) => setRevealReason(event.target.value)} maxLength={500} className="input h-9" placeholder={t("payouts.revealReasonPlaceholder")} /></label>
          <div className="flex flex-wrap gap-2"><button onClick={() => void revealPartner(payout)} className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-xs font-semibold"><ShieldAlert className="size-4" />{t("payouts.revealPartnerAccount")}</button><button onClick={() => void copyPartnerInstructions(payout.id)} disabled={!instructionsAreRevealed} className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-xs font-semibold disabled:opacity-50"><ClipboardCopy className="size-4" />{t("payouts.copyInstructions")}</button>{canMarkSent ? <button onClick={() => void partnerAction(payout, "hold")} disabled={busy} className="inline-flex h-9 items-center rounded-md border px-3 text-xs font-semibold">{t("payouts.placeOnHold")}</button> : null}{payout.status === "READY" || payout.status === "HOLD" ? <button onClick={() => void partnerAction(payout, "processing")} disabled={busy} className="inline-flex h-9 items-center rounded-md border px-3 text-xs font-semibold">{t("payouts.markProcessing")}</button> : null}{canMarkSent ? <button onClick={() => void partnerAction(payout, "failed")} disabled={busy} className="inline-flex h-9 items-center rounded-md border px-3 text-xs font-semibold text-red-700">{t("payouts.markFailed")}</button> : null}</div>
          {canMarkSent ? <div className="flex min-w-0 flex-wrap gap-2"><input value={reference} onChange={(event) => setReference(event.target.value)} placeholder={t("payouts.externalTransferReference")} className="input h-9 min-w-0 flex-1" /><input value={bankReference} onChange={(event) => setBankReference(event.target.value)} placeholder={t("payouts.sendingBankReference")} className="input h-9 min-w-0 flex-1" /><input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder={payout.payoutNumber} className="input h-9 min-w-0 flex-1" /><button onClick={() => void partnerAction(payout, "mark_sent")} disabled={busy || !reference || !confirmation} className="inline-flex h-9 items-center gap-2 rounded-md bg-zinc-950 px-3 text-xs font-semibold text-white disabled:opacity-50"><Send className="size-4" />{t("payouts.recordPartnerPayoutSent")}</button></div> : null}
        </>}
      </div>
    );
  };

  const currentStatus = selectedTransaction?.sellerPayout?.status ?? selectedTransaction?.partnerPayout?.status ?? selectedTransaction?.transaction.paymentStatus ?? "";

  return (
    <section className="grid min-w-0 gap-4">
      {error ? <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      <div className="sticky top-2 z-10 grid gap-3 rounded-xl border p-3 theme-surface-elevated">
        <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold theme-foreground">{t("payouts.reviewQueue")}</p><p className="text-xs theme-muted">{t("payouts.transactionReviewCount").replace("{count}", String(filteredTransactions.length))}</p></div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5"><input value={search} onChange={(event) => setSearch(event.target.value)} className="input h-9 min-w-0" placeholder={t("payouts.reviewSearchPlaceholder")} aria-label={t("payouts.reviewSearchPlaceholder")} /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="input h-9"><option value="all">{t("payouts.allStatuses")}</option><option value="READY">{payoutStatusLabel("READY", t)}</option><option value="HOLD">{payoutStatusLabel("HOLD", t)}</option><option value="PROCESSING">{payoutStatusLabel("PROCESSING", t)}</option><option value="SENT">{payoutStatusLabel("SENT", t)}</option><option value="FAILED">{payoutStatusLabel("FAILED", t)}</option></select><select value={partnerFilter} onChange={(event) => setPartnerFilter(event.target.value)} className="input h-9"><option value="all">{t("payouts.allTransactions")}</option><option value="with">{t("payouts.withPartner")}</option><option value="without">{t("payouts.withoutPartner")}</option></select><select value={warningFilter} onChange={(event) => setWarningFilter(event.target.value)} className="input h-9"><option value="all">{t("payouts.allWarnings")}</option><option value="warning">{t("payouts.warningsOnly")}</option><option value="clear">{t("payouts.noWarnings")}</option></select><select value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} className="input h-9"><option value="all">{t("payouts.allDates")}</option><option value="7d">{t("payouts.last7Days")}</option><option value="30d">{t("payouts.last30Days")}</option></select></div>
      </div>
      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(220px,0.36fr)_minmax(0,1fr)]">
        <nav className="grid content-start gap-2" aria-label={t("payouts.reviewQueue")}>
          {filteredTransactions.map((item) => { const payout = item.sellerPayout ?? item.partnerPayout; const status = payout?.status ?? item.transaction.paymentStatus; return <button key={item.orderId} type="button" onClick={() => setSelectedOrderId(item.orderId)} className={`grid min-w-0 gap-1 rounded-lg border p-3 text-left ${selectedTransaction?.orderId === item.orderId ? "border-emerald-500 ring-1 ring-emerald-500" : ""}`}><span className="truncate text-xs font-semibold theme-foreground">{item.orderNumber}</span><span className="truncate text-xs theme-muted">{item.buyer.company}</span><span className="flex items-center justify-between gap-2 text-xs"><span className="truncate theme-muted">{formatTradeMoney(item.transaction.grossAmount, item.transaction.currency, locale)}</span><span className="rounded-full border px-2 py-0.5 theme-muted">{payoutStatusLabel(status, t)}</span></span></button>; })}
          {!filteredTransactions.length ? <p className="rounded-lg border p-4 text-sm theme-muted">{t("payouts.noTransactions")}</p> : null}
        </nav>
        <div className="min-w-0">{!selectedTransaction ? <p className="rounded-xl border p-6 text-sm theme-muted">{t("payouts.selectTransaction")}</p> : <article className="grid min-w-0 gap-5 rounded-xl border p-4 theme-surface-elevated sm:p-5">
          <button type="button" onClick={() => setSelectedOrderId(null)} className="inline-flex w-fit items-center rounded-md border px-3 py-2 text-xs font-semibold sm:hidden">{t("payouts.backToTransactions")}</button>
          <header className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs theme-muted">{selectedTransaction.orderNumber} · {selectedTransaction.transaction.paymentRequestId}</p><h2 className="mt-1 truncate text-lg font-semibold theme-foreground">{selectedTransaction.transaction.productName ?? selectedTransaction.orderNumber}</h2><p className="mt-1 text-sm theme-muted">{selectedTransaction.orderNumber} · {selectedTransaction.transaction.paymentFlow === "DIRECT_CHARGE" ? t("payouts.directCharge") : t("payouts.legacySct")}</p></div><span className="rounded-full border px-2.5 py-1 text-xs font-semibold theme-success-badge">{payoutStatusLabel(currentStatus, t)}</span></header>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label={t("payouts.payment")} value={`${selectedTransaction.payment.status} · ${formatTradeMoney(selectedTransaction.payment.grossAmount, selectedTransaction.transaction.currency, locale)}`} /><Metric label={t("payouts.paymentDate")} value={selectedTransaction.transaction.paymentDate ? formatTradeDateTime(selectedTransaction.transaction.paymentDate, locale) : "—"} /><Metric label={t("payouts.holdUntil")} value={formatTradeDateTime(selectedTransaction.transaction.holdUntil, locale)} /><Metric label={t("payouts.stripeFeeSeparate")} value={selectedTransaction.transaction.stripeProcessingFee === null ? "—" : formatTradeMoney(selectedTransaction.transaction.stripeProcessingFee, selectedTransaction.transaction.currency, locale)} /></section>
          <DetailSection title={t("payouts.transactionSummary")}><Metric label={t("payouts.orderStatus")} value={selectedTransaction.transaction.orderStatus} /><Metric label={t("payouts.paymentStatus")} value={selectedTransaction.transaction.paymentStatus} /><Metric label={t("payouts.merchandiseAmount")} value={formatTradeMoney(selectedTransaction.transaction.merchandiseAmount, selectedTransaction.transaction.currency, locale)} /><Metric label={t("payouts.totalBuyerCharge")} value={formatTradeMoney(selectedTransaction.transaction.totalBuyerCharge, selectedTransaction.transaction.currency, locale)} /><Metric label={t("payouts.buyerServiceFee")} value={selectedTransaction.transaction.buyerServiceFee === null ? "—" : formatTradeMoney(selectedTransaction.transaction.buyerServiceFee, selectedTransaction.transaction.currency, locale)} /><Metric label={t("payouts.refundAmount")} value={formatTradeMoney(selectedTransaction.transaction.refundAmount, selectedTransaction.transaction.currency, locale)} /><Metric label={t("payouts.disputes")} value={String(selectedTransaction.transaction.disputes.length)} /></DetailSection>
          <DetailSection title={t("payouts.buyer")}><Metric label={t("payouts.company")} value={selectedTransaction.buyer.company} /><Metric label={t("payouts.contact")} value={selectedTransaction.buyer.contactName ?? "—"} /><Metric label={t("payouts.email")} value={selectedTransaction.buyer.email} /><Metric label={t("payouts.country")} value={selectedTransaction.buyer.country} /></DetailSection>
          <DetailSection title={t("payouts.sellerPayoutDetails")}><Metric label={t("payouts.company")} value={selectedTransaction.seller.company} /><Metric label={t("payouts.legalCompanyName")} value={selectedTransaction.sellerPayout?.legalCompanyName ?? selectedTransaction.seller.company} /><Metric label={t("payouts.tradeName")} value={selectedTransaction.sellerPayout?.tradeName ?? "—"} /><Metric label={t("payouts.representative")} value={selectedTransaction.seller.contactName ?? "—"} /><Metric label={t("payouts.email")} value={selectedTransaction.seller.email} /><Metric label={t("payouts.country")} value={selectedTransaction.seller.country} /><Metric label={t("payouts.accountCountry")} value={selectedTransaction.sellerPayout?.accountCountry ?? "—"} /><Metric label={t("payouts.accountHolder")} value={selectedTransaction.sellerPayout?.accountHolder ?? "—"} /><Metric label={t("payouts.bank")} value={selectedTransaction.sellerPayout?.bankNameSnapshot ?? "—"} /><Metric label={t("payouts.maskedAccount")} value={selectedTransaction.sellerPayout?.accountNumberLast4 ? `•••• ${selectedTransaction.sellerPayout.accountNumberLast4}` : "—"} /><Metric label={t("payouts.swiftBic")} value={selectedTransaction.sellerPayout?.swiftBicSnapshot ?? "—"} /><Metric label={t("payouts.payoutCurrency")} value={selectedTransaction.sellerPayout?.payoutCurrency ?? selectedTransaction.transaction.currency} /><Metric label={t("payouts.payoutNumber")} value={selectedTransaction.sellerPayout?.payoutNumber ?? "—"} /><Metric label={t("payouts.status")} value={selectedTransaction.sellerPayout ? payoutStatusLabel(selectedTransaction.sellerPayout.status, t) : t("payouts.notPrepared")} /><Metric label={t("payouts.gross")} value={selectedTransaction.sellerPayout ? formatTradeMoney(selectedTransaction.sellerPayout.grossAmount, selectedTransaction.sellerPayout.currency, locale) : "—"} /><Metric label={t("payouts.trade82Fee")} value={selectedTransaction.sellerPayout ? formatTradeMoney(selectedTransaction.sellerPayout.platformFeeAmount, selectedTransaction.sellerPayout.currency, locale) : "—"} /><Metric label={t("payouts.processingFee")} value={selectedTransaction.sellerPayout?.processingFeeAmount === null || selectedTransaction.sellerPayout?.processingFeeAmount === undefined ? "—" : formatTradeMoney(selectedTransaction.sellerPayout.processingFeeAmount, selectedTransaction.sellerPayout.currency, locale)} /><Metric label={t("payouts.refundAdjustment")} value={selectedTransaction.sellerPayout ? formatTradeMoney(selectedTransaction.sellerPayout.refundAdjustmentAmount, selectedTransaction.sellerPayout.currency, locale) : "—"} /><Metric label={t("payouts.finalPayout")} value={selectedTransaction.reconciliation.sellerPayout === null ? "—" : formatTradeMoney(selectedTransaction.reconciliation.sellerPayout, selectedTransaction.transaction.currency, locale)} /><Metric label={t("payouts.externalTransferReference")} value={selectedTransaction.sellerPayout?.externalTransferReference ?? "—"} /><Metric label={t("payouts.externalBankReference")} value={selectedTransaction.sellerPayout?.externalBankReference ?? "—"} /></DetailSection>
          {selectedTransaction.partnerPayout ? <DetailSection title={t("payouts.partnerPayoutDetails")}><Metric label={t("payouts.name")} value={selectedTransaction.partnerPayout.partnerDisplayNameSnapshot ?? selectedTransaction.partnerPayout.partnerLegalNameSnapshot ?? "—"} /><Metric label={t("payouts.company")} value={selectedTransaction.partnerPayout.partnerOrganizationSnapshot ?? "—"} /><Metric label={t("payouts.email")} value={selectedTransaction.partnerPayout.partnerEmailSnapshot ?? "—"} /><Metric label={t("payouts.contact")} value={selectedTransaction.partnerPayout.partnerPhoneSnapshot ?? "—"} /><Metric label={t("payouts.partnerStatus")} value={selectedTransaction.partnerPayout.partnerStatus} /><Metric label={t("payouts.payoutProfileStatus")} value={selectedTransaction.partnerPayout.payoutProfileStatus ?? "—"} /><Metric label={t("payouts.accountCountry")} value={selectedTransaction.partnerPayout.accountCountrySnapshot ?? "—"} /><Metric label={t("payouts.country")} value={selectedTransaction.partnerPayout.partnerResidenceCountrySnapshot ?? "—"} /><Metric label={t("payouts.accountHolder")} value={selectedTransaction.partnerPayout.accountHolderSnapshot ?? "—"} /><Metric label={t("payouts.bank")} value={selectedTransaction.partnerPayout.bankNameSnapshot ?? "—"} /><Metric label={t("payouts.maskedAccount")} value={selectedTransaction.partnerPayout.accountNumberMasked ?? (selectedTransaction.partnerPayout.accountNumberLast4 ? `•••• ${selectedTransaction.partnerPayout.accountNumberLast4}` : "—")} /><Metric label={t("payouts.payoutCurrency")} value={selectedTransaction.partnerPayout.payoutCurrencySnapshot ?? selectedTransaction.partnerPayout.currency} /><Metric label={t("payouts.payoutNumber")} value={selectedTransaction.partnerPayout.payoutNumber} /><Metric label={t("payouts.status")} value={payoutStatusLabel(selectedTransaction.partnerPayout.status, t)} /><Metric label={t("payouts.partnerCommission")} value={formatTradeMoney(selectedTransaction.partnerPayout.originalCommissionAmount, selectedTransaction.partnerPayout.currency, locale)} /><Metric label={t("payouts.refundAdjustment")} value={formatTradeMoney(selectedTransaction.partnerPayout.reversalAdjustmentAmount, selectedTransaction.partnerPayout.currency, locale)} /><Metric label={t("payouts.finalPayout")} value={formatTradeMoney(selectedTransaction.partnerPayout.finalPayoutAmount, selectedTransaction.partnerPayout.currency, locale)} /><Metric label={t("payouts.attribution")} value={selectedTransaction.partnerPayout.attributionId ?? "—"} /></DetailSection> : null}
          <DetailSection title={t("payouts.reconciliation")}><Metric label={t("payouts.grossAllocation")} value={formatTradeMoney(selectedTransaction.reconciliation.grossAllocationDifference ?? 0, selectedTransaction.transaction.currency, locale)} /><Metric label={t("payouts.platformFeeAllocation")} value={formatTradeMoney(selectedTransaction.reconciliation.platformFeeAllocationDifference ?? 0, selectedTransaction.transaction.currency, locale)} /><Metric label={t("payouts.reconciliationStatus")} value={selectedTransaction.reconciliation.balanced ? t("payouts.balanced") : t("payouts.reviewRequired")} /><Metric label={t("payouts.refundAdjustment")} value={formatTradeMoney(selectedTransaction.reconciliation.refundAdjustment, selectedTransaction.transaction.currency, locale)} /></DetailSection>
          {selectedTransaction.warnings.length ? <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">{selectedTransaction.warnings.map((warning) => <p key={warning}>{t(`payouts.warning.${warning}`)}</p>)}</div> : null}
          {selectedTransaction.sellerPayout ? <section className="grid gap-3 rounded-lg border p-4 theme-surface-muted"><h3 className="text-sm font-semibold theme-foreground">{t("payouts.sellerActions")}</h3>{renderSellerActions(selectedTransaction.sellerPayout)}</section> : null}
          {selectedTransaction.partnerPayout ? <section className="grid gap-3 rounded-lg border p-4 theme-surface-muted"><h3 className="text-sm font-semibold theme-foreground">{t("payouts.partnerActions")}</h3>{renderPartnerActions(selectedTransaction.partnerPayout)}</section> : null}
          {selectedTransaction.sellerPayout && selectedTransaction.sellerPayout.status !== "SENT" ? <section className="grid gap-3 rounded-lg border p-4 theme-surface-muted"><h3 className="text-sm font-semibold theme-foreground">{t("payouts.manualAdjustments")}</h3><div className="grid gap-2 sm:grid-cols-2"><select value={adjustmentType} onChange={(event) => setAdjustmentType(event.target.value as typeof adjustmentType)} className="input h-9"><option value="CREDIT">{payoutAdjustmentTypeLabel("CREDIT", t)}</option><option value="DEBIT">{payoutAdjustmentTypeLabel("DEBIT", t)}</option><option value="REFUND_RECOVERY">{payoutAdjustmentTypeLabel("REFUND_RECOVERY", t)}</option><option value="BANK_FEE">{payoutAdjustmentTypeLabel("BANK_FEE", t)}</option><option value="FX_ADJUSTMENT">{payoutAdjustmentTypeLabel("FX_ADJUSTMENT", t)}</option><option value="OTHER">{payoutAdjustmentTypeLabel("OTHER", t)}</option></select><input inputMode="numeric" value={adjustmentAmount} onChange={(event) => setAdjustmentAmount(event.target.value.replace(/[^0-9]/g, ""))} className="input h-9" placeholder={t("payouts.amountExample")} /><input value={adjustmentReason} onChange={(event) => setAdjustmentReason(event.target.value)} maxLength={1000} className="input h-9" placeholder={t("payouts.requiredAccountingReason")} /><input value={adjustmentConfirmation} onChange={(event) => setAdjustmentConfirmation(event.target.value)} className="input h-9" placeholder={selectedTransaction.sellerPayout.payoutNumber} /></div><button onClick={() => void addAdjustment(selectedTransaction.sellerPayout!)} disabled={adjusting} className="inline-flex h-9 w-fit items-center rounded-md border px-3 text-xs font-semibold">{adjusting ? t("payouts.addingAdjustment") : t("payouts.addAdjustment")}</button></section> : null}
          {selectedTransaction.auditEvents.length ? <DetailSection title={t("payouts.auditTrail")}>{selectedTransaction.auditEvents.slice(0, 10).map((event) => <Metric key={event.id} label={formatTradeDateTime(event.createdAt, locale)} value={event.message ?? event.eventType} />)}</DetailSection> : null}
        </article>}</div>
      </div>
      {activeReveal ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><div className="flex items-center justify-between gap-3"><p className="font-semibold">{t("payouts.revealedInstructions")}</p><button onClick={() => setRevealed(null)} className="inline-flex size-7 items-center justify-center rounded border" aria-label={t("payouts.hideRevealedInstructions")}><X className="size-4" /></button></div><p className="mt-1 text-xs">{t("payouts.revealExpiry")}</p><pre className="mt-2 max-w-full overflow-auto whitespace-pre-wrap">{JSON.stringify(activeReveal.instructions, null, 2)}</pre></div> : null}
    </section>
  );

  /*

  return (
    <section className="grid gap-4">
      {error ? <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {transactions.length ? <p className="text-xs theme-muted">{t("payouts.transactionReviewCount").replace("{count}", String(transactions.length))}</p> : null}
      {visible.map((payout) => {
        const instructionsAreRevealed = activeReveal?.payoutId === payout.id;
        const bankPortalUrl = isSafeOfficialBankWebsite(payout.officialBankWebsiteSnapshot)
          ? payout.officialBankWebsiteSnapshot
          : null;
        const canMarkSent = isActionableStatus(payout.status);
        return (
          <article key={payout.id} className="grid gap-4 rounded-xl border p-5 theme-surface-elevated">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs theme-muted">{payout.order.orderNumber} · {payout.payoutNumber}</p>
                <h2 className="mt-1 text-lg font-semibold theme-foreground">{payout.order.items[0]?.productName ?? t("orders.payoutSummary")}</h2>
                <p className="mt-1 text-sm theme-muted">{payout.order.sellerCompanyName} · {t("payouts.manualExternalRecord")}</p>
              </div>
              <span className="rounded-full border px-2.5 py-1 text-xs font-semibold theme-success-badge">{payoutStatusLabel(payout.status, t)}</span>
            </div>
            <p className="rounded-md border px-3 py-2 text-xs theme-muted">
              {t("payouts.manualExternalNotice")}
            </p>
            <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <Metric label={t("payouts.gross")} value={formatTradeMoney(payout.grossAmount, payout.currency, locale)} />
              <Metric label={t("payouts.trade82Fee")} value={formatTradeMoney(payout.platformFeeAmount, payout.currency, locale)} />
              <Metric label={t("payouts.stripeFee")} value={payout.processingFeeAmount === null ? "—" : formatTradeMoney(payout.processingFeeAmount, payout.currency, locale)} />
              <Metric label={t("payouts.baseSellerPayable")} value={formatTradeMoney(payout.sellerPayableAmount, payout.currency, locale)} />
              <Metric label={t("payouts.manualAdjustments")} value={formatTradeMoney(payout.manualAdjustmentAmount, payout.currency, locale)} />
              <Metric label={t("payouts.finalPayout")} value={formatTradeMoney(payout.finalPayoutAmount, payout.currency, locale)} />
              <Metric label={t("payouts.bank")} value={payout.bankNameSnapshot} />
              <Metric label={t("payouts.account")} value={payout.accountNumberLast4 ? `•••• ${payout.accountNumberLast4}` : "—"} />
              <Metric label="SWIFT / BIC" value={payout.swiftBicSnapshot ?? "—"} />
              <Metric label={t("payouts.refundAdjustment")} value={formatTradeMoney(payout.refundAdjustmentAmount, payout.currency, locale)} />
            </div>
            <section className="grid gap-3 rounded-lg border p-4 theme-surface-muted">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold theme-foreground">{t("payouts.manualAdjustments")}</h3>
                  <p className="mt-1 text-xs theme-muted">{t("payouts.adjustmentsDescription")}</p>
                </div>
                {payout.status === "SENT" ? <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900">{t("payouts.reconciliationRequired")}</span> : null}
              </div>
              {payout.status === "SENT" ? <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">{t("payouts.sentAdjustmentNotice")}</p> : null}
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                <label className="grid gap-1 text-xs font-medium theme-muted">{t("payouts.type")}
                  <select value={adjustmentType} onChange={(event) => setAdjustmentType(event.target.value as typeof adjustmentType)} className="input h-9">
                    <option value="CREDIT">{payoutAdjustmentTypeLabel("CREDIT", t)}</option><option value="DEBIT">{payoutAdjustmentTypeLabel("DEBIT", t)}</option><option value="REFUND_RECOVERY">{payoutAdjustmentTypeLabel("REFUND_RECOVERY", t)}</option><option value="BANK_FEE">{payoutAdjustmentTypeLabel("BANK_FEE", t)}</option><option value="FX_ADJUSTMENT">{payoutAdjustmentTypeLabel("FX_ADJUSTMENT", t)}</option><option value="OTHER">{payoutAdjustmentTypeLabel("OTHER", t)}</option>
                  </select>
                </label>
                <label className="grid gap-1 text-xs font-medium theme-muted">{t("payouts.amountMinorUnits").replace("{currency}", payout.currency.toUpperCase())}
                  <input inputMode="numeric" value={adjustmentAmount} onChange={(event) => setAdjustmentAmount(event.target.value.replace(/[^0-9]/g, ""))} placeholder={t("payouts.amountExample")} className="input h-9" />
                </label>
                <label className="grid gap-1 text-xs font-medium theme-muted">{t("payouts.confirmPayoutOrOrder")}
                  <input value={adjustmentConfirmation} onChange={(event) => setAdjustmentConfirmation(event.target.value)} placeholder={payout.payoutNumber} className="input h-9" />
                </label>
                <label className="grid gap-1 text-xs font-medium theme-muted md:col-span-2">{t("payouts.reason")}
                  <input value={adjustmentReason} onChange={(event) => setAdjustmentReason(event.target.value)} maxLength={1000} placeholder={t("payouts.requiredAccountingReason")} className="input h-9" />
                </label>
                <label className="grid gap-1 text-xs font-medium theme-muted">{t("payouts.internalNoteOptional")}
                  <input value={adjustmentNote} onChange={(event) => setAdjustmentNote(event.target.value)} maxLength={2000} className="input h-9" />
                </label>
              </div>
              <div><button onClick={() => void addAdjustment(payout)} disabled={adjusting} className="inline-flex h-9 items-center rounded-md border px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50">{adjusting ? t("payouts.addingAdjustment") : t("payouts.addAdjustment")}</button></div>
              <div className="grid gap-2">
                {payout.adjustments.length ? payout.adjustments.map((adjustment) => <div key={adjustment.id} className="grid gap-1 rounded-md border bg-white px-3 py-2 text-xs sm:grid-cols-[auto_1fr_auto] sm:items-center">
                  <span className="font-semibold theme-foreground">{payoutAdjustmentTypeLabel(adjustment.adjustmentType, t)} {adjustment.adjustmentType === "CREDIT" ? "+" : "−"}{formatTradeMoney(adjustment.amount, adjustment.currency, locale)}</span>
                  <span className="theme-muted">{adjustment.reason}{adjustment.internalNote ? ` · ${adjustment.internalNote}` : ""}{adjustment.requiresManualReconciliation ? ` · ${t("payouts.manualReconciliationRequired")}` : ""}</span>
                  <span className="theme-muted">{adjustment.createdByUser.displayName || adjustment.createdByUser.email} · {formatTradeDateTime(adjustment.createdAt, locale)}</span>
                </div>) : <p className="text-xs theme-muted">{t("payouts.noAdjustments")}</p>}
              </div>
            </section>
            {payout.status === "SENT" ? (
              <p className="text-sm font-medium text-emerald-700">{t("payouts.externalPayoutSent").replace("{date}", formatTradeDateTime(payout.sentAt, locale))}</p>
            ) : (
              <div className="grid gap-2 border-t pt-4 theme-border">
                <label className="grid gap-1 text-xs font-medium theme-muted">
                  {t("payouts.revealReason")}
                  <input value={revealReason} onChange={(event) => setRevealReason(event.target.value)} maxLength={500} className="input h-9" placeholder={t("payouts.revealReasonPlaceholder")} />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => void reveal(payout)} className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-xs font-semibold"><ShieldAlert className="size-4" />{t("payouts.revealBankDetails")}</button>
                  <button onClick={() => void copyInstructions(payout)} disabled={!instructionsAreRevealed} title={instructionsAreRevealed ? t("payouts.copyInstructionsTitle") : t("payouts.revealFirstTitle")} className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"><ClipboardCopy className="size-4" />{t("payouts.copyInstructions")}</button>
                  <button onClick={() => void downloadInstructions(payout)} disabled={!instructionsAreRevealed} className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"><Download className="size-4" />{t("payouts.downloadInstructions")}</button>
                  {bankPortalUrl ? <a href={bankPortalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-xs font-semibold"><ExternalLink className="size-4" />{t("payouts.openBankPortal")}</a> : null}
                  {canMarkSent ? <button onClick={() => void action(payout, "hold")} disabled={busy} className="inline-flex h-9 items-center rounded-md border px-3 text-xs font-semibold">{t("payouts.placeOnHold")}</button> : null}
                  {payout.status === "READY" || payout.status === "HOLD" ? <button onClick={() => void action(payout, "processing")} disabled={busy} className="inline-flex h-9 items-center rounded-md border px-3 text-xs font-semibold">{t("payouts.markProcessing")}</button> : null}
                  {canMarkSent ? <button onClick={() => void action(payout, "failed")} disabled={busy} className="inline-flex h-9 items-center rounded-md border px-3 text-xs font-semibold text-red-700">{t("payouts.markFailed")}</button> : null}
                </div>
                {canMarkSent ? <div className="flex flex-wrap gap-2"><input value={reference} onChange={(event) => setReference(event.target.value)} placeholder={t("payouts.externalTransferReference")} className="input h-9" /><input value={bankReference} onChange={(event) => setBankReference(event.target.value)} placeholder={t("payouts.sendingBankReference")} className="input h-9" /><input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder={t("payouts.confirmationPlaceholder")} className="input h-9" /><button onClick={() => void action(payout, "mark_sent")} disabled={busy || !reference || !confirmation} className="inline-flex h-9 items-center gap-2 rounded-md bg-zinc-950 px-3 text-xs font-semibold text-white disabled:opacity-50"><Send className="size-4" />{t("payouts.markSent")}</button></div> : null}
              </div>
            )}
          </article>
        );
      })}
      {visiblePartnerPayouts.map((payout) => {
        const order = payout.settlement.tradeOrder;
        const payment = payout.settlement.paymentRequest;
        const instructionsAreRevealed = activeReveal?.payoutId === payout.id;
        const canMarkSent = isActionableStatus(payout.status);
        const warnings = [
          payment.refundAmount > 0 ? `${t("payouts.refundAdjustment")}: ${formatTradeMoney(payment.refundAmount, payment.currency, locale)}` : "",
          payment.requiresManualReconciliation ? t("payouts.manualReconciliationRequired") : "",
          payment.disputes.length ? `${partnerCopy.warnings}: ${payment.disputes.map((item) => item.status).join(", ")}` : "",
          payout.settlement.paymentFlow !== "SCT" ? "Direct Charge excluded from SCT partner payout execution." : "",
        ].filter(Boolean);
        return (
          <article key={payout.id} className="grid gap-4 rounded-xl border p-5 theme-surface-elevated">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs theme-muted">{order.orderNumber} · {payout.payoutNumber}</p>
                <h2 className="mt-1 text-lg font-semibold theme-foreground">{partnerCopy.title}</h2>
                <p className="mt-1 text-sm theme-muted">{payout.partnerDisplayNameSnapshot ?? payout.partnerLegalNameSnapshot ?? "—"} · {partnerCopy.subtitle}</p>
              </div>
              <span className="rounded-full border px-2.5 py-1 text-xs font-semibold theme-success-badge">{payoutStatusLabel(payout.status, t)}</span>
            </div>
            <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <Metric label={partnerCopy.transaction} value={`${order.orderNumber} · ${payment.status}`} />
              <Metric label={t("payouts.gross")} value={formatTradeMoney(payment.grossAmount, payment.currency, locale)} />
              <Metric label={t("payouts.baseSellerPayable")} value={formatTradeMoney(payment.sellerPayableAmount, payment.currency, locale)} />
              <Metric label={partnerCopy.commission} value={formatTradeMoney(payout.originalCommissionAmount, payout.currency, locale)} />
              <Metric label={t("payouts.refundAdjustment")} value={formatTradeMoney(payout.reversalAdjustmentAmount, payout.currency, locale)} />
              <Metric label={t("payouts.finalPayout")} value={formatTradeMoney(payout.finalPayoutAmount, payout.currency, locale)} />
              <Metric label={t("payouts.stripeFee")} value={payment.stripeProcessingFeeAmount === null ? "—" : formatTradeMoney(payment.stripeProcessingFeeAmount, payment.currency, locale)} />
              <Metric label={partnerCopy.trade82Retained} value={formatTradeMoney(payout.settlement.trade82RetainedAmountBeforeStripeFees, payout.settlement.currency, locale)} />
              <Metric label={partnerCopy.holdUntil} value={formatTradeDateTime(payout.holdUntil, locale)} />
              <Metric label={partnerCopy.buyer} value={`${order.buyerCompanyName} · ${order.buyerEmail}`} />
              <Metric label={partnerCopy.seller} value={`${order.sellerCompanyName} · ${order.sellerEmail}`} />
              <Metric label={partnerCopy.partner} value={payout.partnerEmailSnapshot ?? payout.partnerProfile.contactEmail ?? "—"} />
              <Metric label={partnerCopy.payoutAccount} value={`${payout.bankNameSnapshot ?? "—"} · ${payout.accountNumberMasked ?? (payout.accountNumberLast4 ? `•••• ${payout.accountNumberLast4}` : "—")}`} />
            </div>
            {warnings.length ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                {warnings.join(" · ")}
              </div>
            ) : null}
            {payout.status === "SENT" ? (
              <p className="text-sm font-medium text-emerald-700">{t("payouts.externalPayoutSent").replace("{date}", formatTradeDateTime(payout.sentAt, locale))}</p>
            ) : (
              <div className="grid gap-2 border-t pt-4 theme-border">
                <label className="grid gap-1 text-xs font-medium theme-muted">
                  {t("payouts.revealReason")}
                  <input value={revealReason} onChange={(event) => setRevealReason(event.target.value)} maxLength={500} className="input h-9" placeholder={t("payouts.revealReasonPlaceholder")} />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => void revealPartner(payout)} className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-xs font-semibold"><ShieldAlert className="size-4" />{partnerCopy.reveal}</button>
                  <button onClick={() => void copyPartnerInstructions(payout.id)} disabled={!instructionsAreRevealed} className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"><ClipboardCopy className="size-4" />{t("payouts.copyInstructions")}</button>
                  {canMarkSent ? <button onClick={() => void partnerAction(payout, "hold")} disabled={busy} className="inline-flex h-9 items-center rounded-md border px-3 text-xs font-semibold">{t("payouts.placeOnHold")}</button> : null}
                  {payout.status === "READY" || payout.status === "HOLD" ? <button onClick={() => void partnerAction(payout, "processing")} disabled={busy} className="inline-flex h-9 items-center rounded-md border px-3 text-xs font-semibold">{t("payouts.markProcessing")}</button> : null}
                  {canMarkSent ? <button onClick={() => void partnerAction(payout, "failed")} disabled={busy} className="inline-flex h-9 items-center rounded-md border px-3 text-xs font-semibold text-red-700">{t("payouts.markFailed")}</button> : null}
                </div>
                {canMarkSent ? <div className="flex flex-wrap gap-2"><input value={reference} onChange={(event) => setReference(event.target.value)} placeholder={t("payouts.externalTransferReference")} className="input h-9" /><input value={bankReference} onChange={(event) => setBankReference(event.target.value)} placeholder={t("payouts.sendingBankReference")} className="input h-9" /><input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder={payout.payoutNumber} className="input h-9" /><button onClick={() => void partnerAction(payout, "mark_sent")} disabled={busy || !reference || !confirmation} className="inline-flex h-9 items-center gap-2 rounded-md bg-zinc-950 px-3 text-xs font-semibold text-white disabled:opacity-50"><Send className="size-4" />{partnerCopy.markSent}</button></div> : null}
              </div>
            )}
          </article>
        );
      })}
      {!transactions.length && !visible.length && !visiblePartnerPayouts.length ? <p className="rounded-xl border px-5 py-8 text-sm theme-muted">{t("payouts.noPayouts")}</p> : null}
      {activeReveal ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><div className="flex items-center justify-between gap-3"><p className="font-semibold">{t("payouts.revealedInstructions")}</p><button onClick={() => setRevealed(null)} className="inline-flex size-7 items-center justify-center rounded border" aria-label={t("payouts.hideRevealedInstructions")}><X className="size-4" /></button></div><p className="mt-1 text-xs">{t("payouts.revealExpiry")}</p><pre className="mt-2 overflow-auto whitespace-pre-wrap">{JSON.stringify(activeReveal.instructions, null, 2)}</pre></div> : null}
    </section>
  );
  */
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="grid gap-3 rounded-lg border p-4 theme-surface-muted"><h3 className="text-sm font-semibold theme-foreground">{title}</h3><div className="grid gap-3 sm:grid-cols-2">{children}</div></section>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs theme-muted">{label}</p><p className="mt-1 font-medium theme-foreground">{value}</p></div>;
}
