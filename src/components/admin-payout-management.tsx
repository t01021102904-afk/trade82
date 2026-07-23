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

function reviewPayoutStatusLabel(status: string, t: (key: string, fallback?: string) => string) {
  if (status === "NOT_PREPARED") return t("payouts.notPrepared");
  if (status === "NOT_PRESENT") return t("payouts.noPartnerPayouts");
  return payoutStatusLabel(status, t);
}

export function AdminPayoutManagement({ selectedId }: { selectedId?: string }) {
  const { locale, t } = useI18n();
  const [transactions, setTransactions] = useState<AdminPayoutReviewTransaction[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sellerStatusFilter, setSellerStatusFilter] = useState("all");
  const [partnerStatusFilter, setPartnerStatusFilter] = useState("all");
  const [partnerFilter, setPartnerFilter] = useState("all");
  const [warningFilter, setWarningFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [filterNow] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revealed, setRevealed] = useState<RevealedInstructions | null>(null);
  const [sellerRevealReason, setSellerRevealReason] = useState("");
  const [partnerRevealReason, setPartnerRevealReason] = useState("");
  const [sellerConfirmation, setSellerConfirmation] = useState("");
  const [partnerConfirmation, setPartnerConfirmation] = useState("");
  const [sellerReference, setSellerReference] = useState("");
  const [partnerReference, setPartnerReference] = useState("");
  const [sellerBankReference, setSellerBankReference] = useState("");
  const [partnerBankReference, setPartnerBankReference] = useState("");
  const [sellerBusy, setSellerBusy] = useState(false);
  const [partnerBusy, setPartnerBusy] = useState(false);
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
      setMobileDetailOpen(false);
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

  const clearSensitiveActionState = useCallback(() => {
    setRevealed(null);
    setSellerRevealReason("");
    setPartnerRevealReason("");
    setSellerConfirmation("");
    setPartnerConfirmation("");
    setSellerReference("");
    setPartnerReference("");
    setSellerBankReference("");
    setPartnerBankReference("");
  }, []);

  const selectTransaction = useCallback((orderId: string) => {
    setSelectedOrderId(orderId);
    setMobileDetailOpen(true);
    clearSensitiveActionState();
  }, [clearSensitiveActionState]);

  const filteredTransactions = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return transactions.filter((item) => {
      const sellerStatus = item.sellerPayout?.status ?? "NOT_PREPARED";
      const partnerStatus = item.partnerPayout?.status ?? "NOT_PRESENT";
      const hasPartner = Boolean(item.partnerPayout);
      const hasWarning = item.warnings.length > 0;
      const paidAt = item.transaction.paidAt ? new Date(item.transaction.paidAt).getTime() : 0;
      const matchesSearch = !normalizedSearch || [
        item.orderNumber,
        item.buyer.company,
        item.buyer.email,
        item.seller.company,
        item.seller.email,
        item.sellerPayout?.payoutNumber,
        item.partnerPayout?.payoutNumber,
      ].some((value) => value?.toLowerCase().includes(normalizedSearch));
      const matchesDate = dateFilter === "all"
        || (dateFilter === "7d" && paidAt >= filterNow - 7 * 86_400_000)
        || (dateFilter === "30d" && paidAt >= filterNow - 30 * 86_400_000);
      const anyPayoutStatusMatches = statusFilter === "all"
        || sellerStatus === statusFilter
        || partnerStatus === statusFilter;
      return anyPayoutStatusMatches
        && (sellerStatusFilter === "all" || sellerStatus === sellerStatusFilter)
        && (partnerStatusFilter === "all" || partnerStatus === partnerStatusFilter)
        && (partnerFilter === "all" || (partnerFilter === "with" ? hasPartner : !hasPartner))
        && (warningFilter === "all" || (warningFilter === "warning" ? hasWarning : !hasWarning))
        && matchesDate
        && matchesSearch;
    });
  }, [dateFilter, filterNow, partnerFilter, partnerStatusFilter, search, sellerStatusFilter, statusFilter, transactions, warningFilter]);

  const selectedTransaction = filteredTransactions.find((item) => item.orderId === selectedOrderId)
    ?? transactions.find((item) => item.orderId === selectedOrderId)
    ?? (mobileDetailOpen ? null : filteredTransactions[0])
    ?? null;

  async function action(
    payout: Payout,
    nextAction: "hold" | "processing" | "failed" | "mark_sent",
  ) {
    setSellerBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/payouts/${payout.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          nextAction === "mark_sent"
            ? {
                action: nextAction,
                externalTransferReference: sellerReference,
                externalBankReference: sellerBankReference || undefined,
                confirmation: sellerConfirmation,
              }
            : { action: nextAction },
        ),
      });
      await response.json().catch(() => null);
      if (!response.ok) throw new Error(t("payouts.updatePayoutError"));
      setSellerConfirmation("");
      setSellerReference("");
      setSellerBankReference("");
      setRevealed(null);
      await load();
    } catch {
      setError(t("payouts.updatePayoutError"));
    } finally {
      setSellerBusy(false);
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
    if (sellerRevealReason.trim().length < 3) {
      setError(t("payouts.revealReasonError"));
      return;
    }
    setError("");
    try {
      const response = await fetch(`/api/admin/payouts/${payout.id}/reveal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: sellerRevealReason.trim() }),
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
    setPartnerBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/partner-payouts/${payout.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          nextAction === "mark_sent"
            ? {
                action: nextAction,
                externalTransferReference: partnerReference,
                externalBankReference: partnerBankReference || undefined,
                confirmation: partnerConfirmation,
              }
            : { action: nextAction },
        ),
      });
      await response.json().catch(() => null);
      if (!response.ok) throw new Error(t("payouts.updatePayoutError"));
      setPartnerConfirmation("");
      setPartnerReference("");
      setPartnerBankReference("");
      setRevealed(null);
      await load();
    } catch {
      setError(t("payouts.updatePayoutError"));
    } finally {
      setPartnerBusy(false);
    }
  }

  async function revealPartner(payout: PartnerPayout) {
    if (partnerRevealReason.trim().length < 3) {
      setError(t("payouts.revealReasonError"));
      return;
    }
    setError("");
    try {
      const response = await fetch(`/api/admin/partner-payouts/${payout.id}/reveal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: partnerRevealReason.trim() }),
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
          <label className="grid gap-1 text-xs font-medium theme-muted">{t("payouts.revealReason")}<input value={sellerRevealReason} onChange={(event) => setSellerRevealReason(event.target.value)} maxLength={500} className="input h-9" placeholder={t("payouts.revealReasonPlaceholder")} /></label>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => void reveal(payout)} className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-xs font-semibold"><ShieldAlert className="size-4" />{t("payouts.revealBankDetails")}</button>
            <button onClick={() => void copyInstructions(payout)} disabled={!instructionsAreRevealed} className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-xs font-semibold disabled:opacity-50"><ClipboardCopy className="size-4" />{t("payouts.copyInstructions")}</button>
            <button onClick={() => void downloadInstructions(payout)} disabled={!instructionsAreRevealed} className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-xs font-semibold disabled:opacity-50"><Download className="size-4" />{t("payouts.downloadInstructions")}</button>
            {bankPortalUrl ? <a href={bankPortalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-xs font-semibold"><ExternalLink className="size-4" />{t("payouts.openBankPortal")}</a> : null}
            {canMarkSent ? <button onClick={() => void action(payout, "hold")} disabled={sellerBusy} className="inline-flex h-9 items-center rounded-md border px-3 text-xs font-semibold">{t("payouts.placeOnHold")}</button> : null}
            {payout.status === "READY" || payout.status === "HOLD" ? <button onClick={() => void action(payout, "processing")} disabled={sellerBusy} className="inline-flex h-9 items-center rounded-md border px-3 text-xs font-semibold">{t("payouts.markProcessing")}</button> : null}
            {canMarkSent ? <button onClick={() => void action(payout, "failed")} disabled={sellerBusy} className="inline-flex h-9 items-center rounded-md border px-3 text-xs font-semibold text-red-700">{t("payouts.markFailed")}</button> : null}
          </div>
          {canMarkSent ? <div className="flex min-w-0 flex-wrap gap-2"><input value={sellerReference} onChange={(event) => setSellerReference(event.target.value)} placeholder={t("payouts.externalTransferReference")} className="input h-9 min-w-0 flex-1" /><input value={sellerBankReference} onChange={(event) => setSellerBankReference(event.target.value)} placeholder={t("payouts.sendingBankReference")} className="input h-9 min-w-0 flex-1" /><input value={sellerConfirmation} onChange={(event) => setSellerConfirmation(event.target.value)} placeholder={t("payouts.confirmationPlaceholder")} className="input h-9 min-w-0 flex-1" /><button onClick={() => void action(payout, "mark_sent")} disabled={sellerBusy || !sellerReference || !sellerConfirmation} className="inline-flex h-9 items-center gap-2 rounded-md bg-zinc-950 px-3 text-xs font-semibold text-white disabled:opacity-50"><Send className="size-4" />{t("payouts.markSent")}</button></div> : null}
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
          <label className="grid gap-1 text-xs font-medium theme-muted">{t("payouts.revealReason")}<input value={partnerRevealReason} onChange={(event) => setPartnerRevealReason(event.target.value)} maxLength={500} className="input h-9" placeholder={t("payouts.revealReasonPlaceholder")} /></label>
          <div className="flex flex-wrap gap-2"><button onClick={() => void revealPartner(payout)} className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-xs font-semibold"><ShieldAlert className="size-4" />{t("payouts.revealPartnerAccount")}</button><button onClick={() => void copyPartnerInstructions(payout.id)} disabled={!instructionsAreRevealed} className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-xs font-semibold disabled:opacity-50"><ClipboardCopy className="size-4" />{t("payouts.copyInstructions")}</button>{canMarkSent ? <button onClick={() => void partnerAction(payout, "hold")} disabled={partnerBusy} className="inline-flex h-9 items-center rounded-md border px-3 text-xs font-semibold">{t("payouts.placeOnHold")}</button> : null}{payout.status === "READY" || payout.status === "HOLD" ? <button onClick={() => void partnerAction(payout, "processing")} disabled={partnerBusy} className="inline-flex h-9 items-center rounded-md border px-3 text-xs font-semibold">{t("payouts.markProcessing")}</button> : null}{canMarkSent ? <button onClick={() => void partnerAction(payout, "failed")} disabled={partnerBusy} className="inline-flex h-9 items-center rounded-md border px-3 text-xs font-semibold text-red-700">{t("payouts.markFailed")}</button> : null}</div>
          {canMarkSent ? <div className="flex min-w-0 flex-wrap gap-2"><input value={partnerReference} onChange={(event) => setPartnerReference(event.target.value)} placeholder={t("payouts.externalTransferReference")} className="input h-9 min-w-0 flex-1" /><input value={partnerBankReference} onChange={(event) => setPartnerBankReference(event.target.value)} placeholder={t("payouts.sendingBankReference")} className="input h-9 min-w-0 flex-1" /><input value={partnerConfirmation} onChange={(event) => setPartnerConfirmation(event.target.value)} placeholder={payout.payoutNumber} className="input h-9 min-w-0 flex-1" /><button onClick={() => void partnerAction(payout, "mark_sent")} disabled={partnerBusy || !partnerReference || !partnerConfirmation} className="inline-flex h-9 items-center gap-2 rounded-md bg-zinc-950 px-3 text-xs font-semibold text-white disabled:opacity-50"><Send className="size-4" />{t("payouts.recordPartnerPayoutSent")}</button></div> : null}
        </>}
      </div>
    );
  };

  const sellerStatus = selectedTransaction?.sellerPayout?.status ?? "NOT_PREPARED";
  const partnerStatus = selectedTransaction?.partnerPayout?.status ?? "NOT_PRESENT";
  return (
    <section className="admin-design-v2 grid min-w-0 max-w-full gap-4 overflow-x-hidden">
      {error ? <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      <div className="sticky top-2 z-10 grid gap-3 rounded-xl border bg-white/95 p-3 shadow-sm backdrop-blur-sm dark:bg-zinc-950/95">
        <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold theme-foreground">{t("payouts.reviewQueue")}</p><p className="text-xs theme-muted">{t("payouts.transactionReviewCount").replace("{count}", String(filteredTransactions.length))}</p></div>
        <div className="grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-7"><input value={search} onChange={(event) => setSearch(event.target.value)} className="input h-9 min-w-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600" placeholder={t("payouts.reviewSearchPlaceholder")} aria-label={t("payouts.reviewSearchPlaceholder")} /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="input h-9 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600"><option value="all">{t("payouts.allStatuses")}</option><option value="READY">{payoutStatusLabel("READY", t)}</option><option value="HOLD">{payoutStatusLabel("HOLD", t)}</option><option value="PROCESSING">{payoutStatusLabel("PROCESSING", t)}</option><option value="SENT">{payoutStatusLabel("SENT", t)}</option><option value="FAILED">{payoutStatusLabel("FAILED", t)}</option></select><select value={sellerStatusFilter} onChange={(event) => setSellerStatusFilter(event.target.value)} className="input h-9 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600"><option value="all">{t("payouts.allSellerStatuses")}</option><option value="NOT_PREPARED">{t("payouts.notPrepared")}</option><option value="READY">{payoutStatusLabel("READY", t)}</option><option value="HOLD">{payoutStatusLabel("HOLD", t)}</option><option value="PROCESSING">{payoutStatusLabel("PROCESSING", t)}</option><option value="SENT">{payoutStatusLabel("SENT", t)}</option><option value="FAILED">{payoutStatusLabel("FAILED", t)}</option></select><select value={partnerStatusFilter} onChange={(event) => setPartnerStatusFilter(event.target.value)} className="input h-9 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600"><option value="all">{t("payouts.allPartnerStatuses")}</option><option value="NOT_PRESENT">{t("payouts.noPartnerPayouts")}</option><option value="READY">{payoutStatusLabel("READY", t)}</option><option value="HOLD">{payoutStatusLabel("HOLD", t)}</option><option value="PROCESSING">{payoutStatusLabel("PROCESSING", t)}</option><option value="SENT">{payoutStatusLabel("SENT", t)}</option><option value="FAILED">{payoutStatusLabel("FAILED", t)}</option></select><select value={partnerFilter} onChange={(event) => setPartnerFilter(event.target.value)} className="input h-9 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600"><option value="all">{t("payouts.allTransactions")}</option><option value="with">{t("payouts.withPartner")}</option><option value="without">{t("payouts.withoutPartner")}</option></select><select value={warningFilter} onChange={(event) => setWarningFilter(event.target.value)} className="input h-9 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600"><option value="all">{t("payouts.allWarnings")}</option><option value="warning">{t("payouts.warningsOnly")}</option><option value="clear">{t("payouts.noWarnings")}</option></select><select value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} className="input h-9 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600"><option value="all">{t("payouts.allDates")}</option><option value="7d">{t("payouts.last7Days")}</option><option value="30d">{t("payouts.last30Days")}</option></select></div>
      </div>
      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(220px,0.36fr)_minmax(0,1fr)]">
        <nav className={mobileDetailOpen ? "hidden content-start gap-2 lg:grid" : "grid content-start gap-2"} aria-label={t("payouts.reviewQueue")}>
          {filteredTransactions.map((item) => { const seller = item.sellerPayout?.status ?? "NOT_PREPARED"; const partner = item.partnerPayout?.status ?? "NOT_PRESENT"; return <button key={item.orderId} type="button" onClick={() => selectTransaction(item.orderId)} className={`grid min-w-0 gap-1 rounded-lg border bg-white p-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600 dark:bg-zinc-950 ${selectedTransaction?.orderId === item.orderId ? "border-emerald-500 ring-2 ring-emerald-500" : ""}`}><span className="truncate text-xs font-semibold theme-foreground">{item.orderNumber}</span><span className="truncate text-xs theme-muted">{item.buyer.company}</span><span className="flex min-w-0 flex-wrap items-center justify-between gap-2 text-xs"><span className="truncate tabular-nums theme-muted">{formatTradeMoney(item.transaction.grossAmount, item.transaction.currency, locale)}</span><span className="flex min-w-0 flex-wrap gap-1"><span className="rounded-full border px-2 py-0.5 theme-muted">{t("payouts.sellerStatus")}: {reviewPayoutStatusLabel(seller, t)}</span>{item.partnerPayout ? <span className="rounded-full border border-sky-300 px-2 py-0.5 text-sky-800">{t("payouts.partnerStatus")}: {reviewPayoutStatusLabel(partner, t)}</span> : null}{item.warnings.length ? <span className="rounded-full border border-amber-300 px-2 py-0.5 text-amber-900">{t("payouts.warningBadge")}</span> : null}</span></span></button>; })}
          {!filteredTransactions.length ? <p className="rounded-lg border p-4 text-sm theme-muted">{t("payouts.noTransactions")}</p> : null}
        </nav>
        <div className={mobileDetailOpen ? "min-w-0" : "hidden min-w-0 lg:block"}>{!selectedTransaction ? <p className="rounded-xl border bg-white p-6 text-sm theme-muted dark:bg-zinc-950">{t("payouts.selectTransaction")}</p> : <article className="grid min-w-0 gap-5 rounded-xl border bg-white p-4 text-sm shadow-sm dark:bg-zinc-950 sm:p-5">
          <button type="button" onClick={() => { setSelectedOrderId(null); setMobileDetailOpen(false); clearSensitiveActionState(); }} className="inline-flex w-fit items-center rounded-md border px-3 py-2 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600 sm:hidden">{t("payouts.backToTransactions")}</button>
          <header className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 break-words"><p className="text-xs theme-muted">{selectedTransaction.orderNumber} · {selectedTransaction.transaction.paymentRequestId}</p><h2 className="mt-1 break-words text-lg font-semibold theme-foreground">{selectedTransaction.transaction.productName ?? selectedTransaction.orderNumber}</h2><p className="mt-1 text-sm theme-muted">{selectedTransaction.orderNumber} · {selectedTransaction.transaction.paymentFlow === "DIRECT_CHARGE" ? t("payouts.directCharge") : t("payouts.legacySct")}</p></div><div className="flex min-w-0 flex-wrap gap-1"><span className="rounded-full border px-2.5 py-1 text-xs font-semibold">{t("payouts.sellerStatus")}: {reviewPayoutStatusLabel(sellerStatus, t)}</span>{selectedTransaction.partnerPayout ? <span className="rounded-full border border-sky-300 px-2.5 py-1 text-xs font-semibold text-sky-800">{t("payouts.partnerStatus")}: {reviewPayoutStatusLabel(partnerStatus, t)}</span> : null}</div></header>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label={t("payouts.payment")} value={`${selectedTransaction.payment.status} · ${formatTradeMoney(selectedTransaction.payment.grossAmount, selectedTransaction.transaction.currency, locale)}`} /><Metric label={t("payouts.paymentDate")} value={selectedTransaction.transaction.paymentDate ? formatTradeDateTime(selectedTransaction.transaction.paymentDate, locale) : "—"} /><Metric label={t("payouts.holdUntil")} value={formatTradeDateTime(selectedTransaction.transaction.holdUntil, locale)} /><Metric label={t("payouts.stripeFeeSeparate")} value={selectedTransaction.transaction.stripeProcessingFee === null ? "—" : formatTradeMoney(selectedTransaction.transaction.stripeProcessingFee, selectedTransaction.transaction.currency, locale)} /></section>
          <DetailSection title={t("payouts.transactionSummary")}><Metric label={t("payouts.orderStatus")} value={selectedTransaction.transaction.orderStatus} /><Metric label={t("payouts.paymentStatus")} value={selectedTransaction.transaction.paymentStatus} /><Metric label={t("payouts.merchandiseAmount")} value={formatTradeMoney(selectedTransaction.transaction.merchandiseAmount, selectedTransaction.transaction.currency, locale)} /><Metric label={t("payouts.totalBuyerCharge")} value={formatTradeMoney(selectedTransaction.transaction.totalBuyerCharge, selectedTransaction.transaction.currency, locale)} /><Metric label={t("payouts.buyerServiceFee")} value={selectedTransaction.transaction.buyerServiceFee === null ? "—" : formatTradeMoney(selectedTransaction.transaction.buyerServiceFee, selectedTransaction.transaction.currency, locale)} /><Metric label={t("payouts.refundAmount")} value={formatTradeMoney(selectedTransaction.transaction.refundAmount, selectedTransaction.transaction.currency, locale)} /><Metric label={t("payouts.disputes")} value={String(selectedTransaction.transaction.disputes.length)} /></DetailSection>
          <DetailSection title={t("payouts.buyer")}><Metric label={t("payouts.company")} value={selectedTransaction.buyer.company} /><Metric label={t("payouts.contact")} value={selectedTransaction.buyer.contactName ?? "—"} /><Metric label={t("payouts.email")} value={selectedTransaction.buyer.email} /><Metric label={t("payouts.phone")} value={selectedTransaction.buyer.phone ?? "—"} /><Metric label={t("payouts.country")} value={selectedTransaction.buyer.country} /><Metric label={t("payouts.totalBuyerCharge")} value={formatTradeMoney(selectedTransaction.transaction.totalBuyerCharge, selectedTransaction.transaction.currency, locale)} /><Metric label={t("payouts.paymentDate")} value={selectedTransaction.transaction.paymentDate ? formatTradeDateTime(selectedTransaction.transaction.paymentDate, locale) : "—"} /></DetailSection>
          <DetailSection title={t("payouts.sellerPayoutDetails")}><Metric label={t("payouts.company")} value={selectedTransaction.seller.company} /><Metric label={t("payouts.legalCompanyName")} value={selectedTransaction.sellerPayout?.legalCompanyName ?? selectedTransaction.seller.company} /><Metric label={t("payouts.tradeName")} value={selectedTransaction.sellerPayout?.tradeName ?? "—"} /><Metric label={t("payouts.representative")} value={selectedTransaction.seller.contactName ?? "—"} /><Metric label={t("payouts.email")} value={selectedTransaction.seller.email} /><Metric label={t("payouts.phone")} value={selectedTransaction.seller.phone ?? "—"} /><Metric label={t("payouts.country")} value={selectedTransaction.seller.country} /><Metric label={t("payouts.accountCountry")} value={selectedTransaction.sellerPayout?.accountCountry ?? "—"} /><Metric label={t("payouts.accountHolder")} value={selectedTransaction.sellerPayout?.accountHolder ?? "—"} /><Metric label={t("payouts.bank")} value={selectedTransaction.sellerPayout?.bankNameSnapshot ?? "—"} /><Metric label={t("payouts.maskedAccount")} value={selectedTransaction.sellerPayout?.accountNumberLast4 ? `•••• ${selectedTransaction.sellerPayout.accountNumberLast4}` : "—"} /><Metric label={t("payouts.swiftBic")} value={selectedTransaction.sellerPayout?.swiftBicSnapshot ?? "—"} /><Metric label={t("payouts.payoutCurrency")} value={selectedTransaction.sellerPayout?.payoutCurrency ?? selectedTransaction.transaction.currency} /><Metric label={t("payouts.payoutNumber")} value={selectedTransaction.sellerPayout?.payoutNumber ?? "—"} /><Metric label={t("payouts.status")} value={selectedTransaction.sellerPayout ? payoutStatusLabel(selectedTransaction.sellerPayout.status, t) : t("payouts.notPrepared")} /><Metric label={t("payouts.holdUntil")} value={formatTradeDateTime(selectedTransaction.transaction.holdUntil, locale)} /><Metric label={t("payouts.gross")} value={selectedTransaction.sellerPayout ? formatTradeMoney(selectedTransaction.sellerPayout.grossAmount, selectedTransaction.sellerPayout.currency, locale) : "—"} /><Metric label={t("payouts.trade82Fee")} value={selectedTransaction.sellerPayout ? formatTradeMoney(selectedTransaction.sellerPayout.platformFeeAmount, selectedTransaction.sellerPayout.currency, locale) : "—"} /><Metric label={t("payouts.processingFee")} value={selectedTransaction.sellerPayout?.processingFeeAmount === null || selectedTransaction.sellerPayout?.processingFeeAmount === undefined ? "—" : formatTradeMoney(selectedTransaction.sellerPayout.processingFeeAmount, selectedTransaction.sellerPayout.currency, locale)} /><Metric label={t("payouts.refundAdjustment")} value={selectedTransaction.sellerPayout ? formatTradeMoney(selectedTransaction.sellerPayout.refundAdjustmentAmount, selectedTransaction.sellerPayout.currency, locale) : "—"} /><Metric label={t("payouts.manualAdjustments")} value={selectedTransaction.sellerPayout ? formatTradeMoney(selectedTransaction.sellerPayout.manualAdjustmentAmount, selectedTransaction.sellerPayout.currency, locale) : "—"} /><Metric label={t("payouts.finalPayout")} value={selectedTransaction.reconciliation.sellerPayout === null ? "—" : formatTradeMoney(selectedTransaction.reconciliation.sellerPayout, selectedTransaction.transaction.currency, locale)} /><Metric label={t("payouts.approvedAt")} value={selectedTransaction.sellerPayout?.approvedAt ? formatTradeDateTime(selectedTransaction.sellerPayout.approvedAt, locale) : "—"} /><Metric label={t("payouts.preparedAt")} value={selectedTransaction.sellerPayout?.preparedAt ? formatTradeDateTime(selectedTransaction.sellerPayout.preparedAt, locale) : "—"} /><Metric label={t("payouts.sentAt")} value={selectedTransaction.sellerPayout?.sentAt ? formatTradeDateTime(selectedTransaction.sellerPayout.sentAt, locale) : "—"} /><Metric label={t("payouts.externalTransferReference")} value={selectedTransaction.sellerPayout?.externalTransferReference ?? "—"} /><Metric label={t("payouts.externalBankReference")} value={selectedTransaction.sellerPayout?.externalBankReference ?? "—"} /></DetailSection>
          {selectedTransaction.partnerPayout ? <DetailSection title={t("payouts.partnerPayoutDetails")}><Metric label={t("payouts.partnerLegalName")} value={selectedTransaction.partnerPayout.partnerLegalNameSnapshot ?? "—"} /><Metric label={t("payouts.partnerDisplayName")} value={selectedTransaction.partnerPayout.partnerDisplayNameSnapshot ?? "—"} /><Metric label={t("payouts.company")} value={selectedTransaction.partnerPayout.partnerOrganizationSnapshot ?? "—"} /><Metric label={t("payouts.email")} value={selectedTransaction.partnerPayout.partnerEmailSnapshot ?? "—"} /><Metric label={t("payouts.contact")} value={selectedTransaction.partnerPayout.partnerPhoneSnapshot ?? "—"} /><Metric label={t("payouts.partnerStatus")} value={selectedTransaction.partnerPayout.partnerStatus} /><Metric label={t("payouts.payoutProfileStatus")} value={selectedTransaction.partnerPayout.payoutProfileStatus ?? "—"} /><Metric label={t("payouts.accountCountry")} value={selectedTransaction.partnerPayout.accountCountrySnapshot ?? "—"} /><Metric label={t("payouts.country")} value={selectedTransaction.partnerPayout.partnerResidenceCountrySnapshot ?? "—"} /><Metric label={t("payouts.accountHolder")} value={selectedTransaction.partnerPayout.accountHolderSnapshot ?? "—"} /><Metric label={t("payouts.bank")} value={selectedTransaction.partnerPayout.bankNameSnapshot ?? "—"} /><Metric label={t("payouts.maskedAccount")} value={selectedTransaction.partnerPayout.accountNumberMasked ?? (selectedTransaction.partnerPayout.accountNumberLast4 ? `•••• ${selectedTransaction.partnerPayout.accountNumberLast4}` : "—")} /><Metric label={t("payouts.payoutCurrency")} value={selectedTransaction.partnerPayout.payoutCurrencySnapshot ?? selectedTransaction.partnerPayout.currency} /><Metric label={t("payouts.payoutNumber")} value={selectedTransaction.partnerPayout.payoutNumber} /><Metric label={t("payouts.status")} value={payoutStatusLabel(selectedTransaction.partnerPayout.status, t)} /><Metric label={t("payouts.partnerCommission")} value={formatTradeMoney(selectedTransaction.partnerPayout.originalCommissionAmount, selectedTransaction.partnerPayout.currency, locale)} /><Metric label={t("payouts.refundAdjustment")} value={formatTradeMoney(selectedTransaction.partnerPayout.reversalAdjustmentAmount, selectedTransaction.partnerPayout.currency, locale)} /><Metric label={t("payouts.finalCommission")} value={formatTradeMoney(selectedTransaction.partnerPayout.finalPayoutAmount, selectedTransaction.partnerPayout.currency, locale)} /><Metric label={t("payouts.holdUntil")} value={formatTradeDateTime(selectedTransaction.partnerPayout.holdUntil, locale)} /><Metric label={t("payouts.snapshotCapturedAt")} value={selectedTransaction.partnerPayout.snapshotCapturedAt ? formatTradeDateTime(selectedTransaction.partnerPayout.snapshotCapturedAt, locale) : "—"} /><Metric label={t("payouts.sentAt")} value={selectedTransaction.partnerPayout.sentAt ? formatTradeDateTime(selectedTransaction.partnerPayout.sentAt, locale) : "—"} /><Metric label={t("payouts.attribution")} value={selectedTransaction.partnerPayout.attributionId ?? "—"} /><Metric label={t("payouts.externalTransferReference")} value={selectedTransaction.partnerPayout.externalTransferReference ?? "—"} /><Metric label={t("payouts.externalBankReference")} value={selectedTransaction.partnerPayout.externalBankReference ?? "—"} /></DetailSection> : null}
          <DetailSection title={t("payouts.reconciliation")}><Metric label={t("payouts.grossAllocation")} value={formatTradeMoney(selectedTransaction.reconciliation.grossAllocationDifference ?? 0, selectedTransaction.transaction.currency, locale)} /><Metric label={t("payouts.platformFeeAllocation")} value={formatTradeMoney(selectedTransaction.reconciliation.platformFeeAllocationDifference ?? 0, selectedTransaction.transaction.currency, locale)} /><Metric label={t("payouts.reconciliationStatus")} value={selectedTransaction.reconciliation.balanced ? t("payouts.balanced") : t("payouts.reviewRequired")} /><Metric label={t("payouts.refundAdjustment")} value={formatTradeMoney(selectedTransaction.reconciliation.refundAdjustment, selectedTransaction.transaction.currency, locale)} /></DetailSection>
          {selectedTransaction.warnings.length ? <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">{selectedTransaction.warnings.map((warning) => <p key={warning}>{t(`payouts.warning.${warning}`)}</p>)}</div> : null}
          {selectedTransaction.sellerPayout ? <section className="grid gap-3 rounded-lg border bg-white p-4 text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-100"><h3 className="text-sm font-semibold">{t("payouts.sellerActions")}</h3>{renderSellerActions(selectedTransaction.sellerPayout)}</section> : null}
          {selectedTransaction.partnerPayout ? <section className="grid gap-3 rounded-lg border bg-white p-4 text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-100"><h3 className="text-sm font-semibold">{t("payouts.partnerActions")}</h3>{renderPartnerActions(selectedTransaction.partnerPayout)}</section> : null}
          {selectedTransaction.sellerPayout && selectedTransaction.sellerPayout.status !== "SENT" ? <section className="grid gap-3 rounded-lg border bg-white p-4 text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-100"><h3 className="text-sm font-semibold">{t("payouts.manualAdjustments")}</h3><div className="grid gap-2 sm:grid-cols-2"><select value={adjustmentType} onChange={(event) => setAdjustmentType(event.target.value as typeof adjustmentType)} className="input h-9"><option value="CREDIT">{payoutAdjustmentTypeLabel("CREDIT", t)}</option><option value="DEBIT">{payoutAdjustmentTypeLabel("DEBIT", t)}</option><option value="REFUND_RECOVERY">{payoutAdjustmentTypeLabel("REFUND_RECOVERY", t)}</option><option value="BANK_FEE">{payoutAdjustmentTypeLabel("BANK_FEE", t)}</option><option value="FX_ADJUSTMENT">{payoutAdjustmentTypeLabel("FX_ADJUSTMENT", t)}</option><option value="OTHER">{payoutAdjustmentTypeLabel("OTHER", t)}</option></select><input inputMode="numeric" value={adjustmentAmount} onChange={(event) => setAdjustmentAmount(event.target.value.replace(/[^0-9]/g, ""))} className="input h-9" placeholder={t("payouts.amountExample")} /><input value={adjustmentReason} onChange={(event) => setAdjustmentReason(event.target.value)} maxLength={1000} className="input h-9" placeholder={t("payouts.requiredAccountingReason")} /><input value={adjustmentConfirmation} onChange={(event) => setAdjustmentConfirmation(event.target.value)} className="input h-9" placeholder={selectedTransaction.sellerPayout.payoutNumber} /></div><button onClick={() => void addAdjustment(selectedTransaction.sellerPayout!)} disabled={adjusting} className="inline-flex h-9 w-fit items-center rounded-md border px-3 text-xs font-semibold">{adjusting ? t("payouts.addingAdjustment") : t("payouts.addAdjustment")}</button></section> : null}
          {selectedTransaction.auditEvents.length ? <DetailSection title={t("payouts.auditTrail")}>{selectedTransaction.auditEvents.slice(0, 10).map((event) => <Metric key={event.id} label={formatTradeDateTime(event.createdAt, locale)} value={event.message ?? event.eventType} />)}</DetailSection> : null}
        </article>}</div>
      </div>
      {activeReveal ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><div className="flex items-center justify-between gap-3"><p className="font-semibold">{t("payouts.revealedInstructions")}</p><button onClick={() => setRevealed(null)} className="inline-flex size-7 items-center justify-center rounded border" aria-label={t("payouts.hideRevealedInstructions")}><X className="size-4" /></button></div><p className="mt-1 text-xs">{t("payouts.revealExpiry")}</p><pre className="mt-2 max-w-full overflow-auto whitespace-pre-wrap">{JSON.stringify(activeReveal.instructions, null, 2)}</pre></div> : null}
    </section>
  );

}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="grid min-w-0 gap-3 rounded-lg border bg-white p-4 text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-100"><h3 className="text-sm font-semibold">{title}</h3><div className="grid min-w-0 gap-3 sm:grid-cols-2">{children}</div></section>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><p className="break-words text-xs text-zinc-500 dark:text-zinc-400">{label}</p><p className="mt-1 break-words font-medium tabular-nums text-zinc-900 dark:text-zinc-100">{value}</p></div>;
}
