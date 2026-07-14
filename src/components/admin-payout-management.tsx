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
  processingFeeAmount: number | null;
  bankNameSnapshot: string;
  accountNumberLast4: string | null;
  swiftBicSnapshot: string | null;
  officialBankWebsiteSnapshot: string | null;
  sentAt: string | null;
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
  order: {
    id: string;
    orderNumber: string;
    buyerCompanyName: string;
    sellerCompanyName: string;
    items: Array<{ productName: string }>;
  };
  sellerCompany: { legalName: string; tradeName: string | null };
};

type RevealedInstructions = {
  payoutId: string;
  scope: string | null;
  instructions: Record<string, unknown>;
};

function isActionableStatus(status: string) {
  return status === "READY" || status === "PROCESSING";
}

export function AdminPayoutManagement({ selectedId }: { selectedId?: string }) {
  const { locale, t } = useI18n();
  const [payouts, setPayouts] = useState<Payout[]>([]);
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
      setPayouts(data.payouts ?? []);
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
    if (!revealed || revealed.scope !== (selectedId ?? null)) return;
    const timer = window.setTimeout(() => setRevealed(null), 60_000);
    return () => window.clearTimeout(timer);
  }, [revealed, selectedId]);

  // A reveal belongs to the route where it was requested. Navigating to a
  // different payout immediately removes it from the rendered browser state.
  const activeReveal = revealed?.scope === (selectedId ?? null) ? revealed : null;

  const visible = useMemo(
    () => (selectedId ? payouts.filter((payout) => payout.id === selectedId) : payouts),
    [payouts, selectedId],
  );

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
                sentAt: new Date().toISOString(),
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
      setRevealed({ payoutId: payout.id, scope: selectedId ?? null, instructions: data.instructions });
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

  if (loading) return <Loader2 className="size-5 animate-spin theme-muted" />;

  return (
    <section className="grid gap-4">
      {error ? <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
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
      {!visible.length ? <p className="rounded-xl border px-5 py-8 text-sm theme-muted">{t("payouts.noPayouts")}</p> : null}
      {activeReveal ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><div className="flex items-center justify-between gap-3"><p className="font-semibold">{t("payouts.revealedInstructions")}</p><button onClick={() => setRevealed(null)} className="inline-flex size-7 items-center justify-center rounded border" aria-label={t("payouts.hideRevealedInstructions")}><X className="size-4" /></button></div><p className="mt-1 text-xs">{t("payouts.revealExpiry")}</p><pre className="mt-2 overflow-auto whitespace-pre-wrap">{JSON.stringify(activeReveal.instructions, null, 2)}</pre></div> : null}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs theme-muted">{label}</p><p className="mt-1 font-medium theme-foreground">{value}</p></div>;
}
