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

import { isSafeOfficialBankWebsite } from "@/lib/bank-directory-security";

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

function money(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(value / 100);
}

function isActionableStatus(status: string) {
  return status === "READY" || status === "PROCESSING";
}

export function AdminPayoutManagement({ selectedId }: { selectedId?: string }) {
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
      if (!response.ok) throw new Error(data?.error ?? "Unable to load payouts.");
      setPayouts(data.payouts ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load payouts.");
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

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
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Unable to update payout.");
      setConfirmation("");
      setReference("");
      setBankReference("");
      setRevealed(null);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update payout.");
    } finally {
      setBusy(false);
    }
  }

  async function addAdjustment(payout: Payout) {
    const amount = Number(adjustmentAmount);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      setError("Enter a positive whole-number minor-unit amount.");
      return;
    }
    if (adjustmentReason.trim().length < 3) {
      setError("Enter an adjustment reason.");
      return;
    }
    if (!adjustmentConfirmation.trim()) {
      setError("Type the payout or order number to confirm this adjustment.");
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
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Unable to add the payout adjustment.");
      setAdjustmentAmount("");
      setAdjustmentReason("");
      setAdjustmentNote("");
      setAdjustmentConfirmation("");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to add the payout adjustment.");
    } finally {
      setAdjusting(false);
    }
  }

  async function reveal(payout: Payout) {
    if (revealReason.trim().length < 3) {
      setError("Enter a short reason before revealing bank instructions.");
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
        throw new Error(data?.error ?? "Unable to reveal bank instructions.");
      }
      setRevealed({ payoutId: payout.id, scope: selectedId ?? null, instructions: data.instructions });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to reveal bank instructions.");
    }
  }

  async function recordInstructionExport(payoutId: string, actionName: "copied" | "downloaded") {
    const response = await fetch(`/api/admin/payouts/${payoutId}/instructions-exported`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: actionName }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.error ?? "Unable to record the instruction export.");
    }
  }

  async function copyInstructions(payout: Payout) {
    if (activeReveal?.payoutId !== payout.id) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(activeReveal.instructions, null, 2));
      await recordInstructionExport(payout.id, "copied");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to copy payout instructions.");
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
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to download payout instructions.");
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
                <h2 className="mt-1 text-lg font-semibold theme-foreground">{payout.order.items[0]?.productName ?? "Order payout"}</h2>
                <p className="mt-1 text-sm theme-muted">{payout.order.sellerCompanyName} · manual external payout record</p>
              </div>
              <span className="rounded-full border px-2.5 py-1 text-xs font-semibold theme-success-badge">{payout.status}</span>
            </div>
            <p className="rounded-md border px-3 py-2 text-xs theme-muted">
              Trade82 records manual external payouts. Clicking Mark as Sent does not initiate a bank transfer.
              <br />Trade82는 외부 수동 정산을 기록합니다. 전송 완료 기록은 은행 이체를 실행하지 않습니다.
            </p>
            <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="Gross" value={money(payout.grossAmount, payout.currency)} />
              <Metric label="Trade82 fee" value={money(payout.platformFeeAmount, payout.currency)} />
              <Metric label="Stripe fee" value={payout.processingFeeAmount === null ? "—" : money(payout.processingFeeAmount, payout.currency)} />
              <Metric label="Base seller payable" value={money(payout.sellerPayableAmount, payout.currency)} />
              <Metric label="Manual adjustments" value={money(payout.manualAdjustmentAmount, payout.currency)} />
              <Metric label="Final payout" value={money(payout.finalPayoutAmount, payout.currency)} />
              <Metric label="Bank" value={payout.bankNameSnapshot} />
              <Metric label="Account" value={payout.accountNumberLast4 ? `•••• ${payout.accountNumberLast4}` : "—"} />
              <Metric label="SWIFT / BIC" value={payout.swiftBicSnapshot ?? "—"} />
              <Metric label="Refund adjustment" value={money(payout.refundAdjustmentAmount, payout.currency)} />
            </div>
            <section className="grid gap-3 rounded-lg border p-4 theme-surface-muted">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold theme-foreground">Manual adjustments</h3>
                  <p className="mt-1 text-xs theme-muted">Append-only amounts use minor units. Credits increase the payout; all other adjustment types reduce it.</p>
                </div>
                {payout.status === "SENT" ? <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900">Reconciliation required</span> : null}
              </div>
              {payout.status === "SENT" ? <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">This payout was already sent externally. A new adjustment will not alter the recorded sent amount and may require an additional external transfer or recovery. Trade82 will not claim an external payment occurred.</p> : null}
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                <label className="grid gap-1 text-xs font-medium theme-muted">Type
                  <select value={adjustmentType} onChange={(event) => setAdjustmentType(event.target.value as typeof adjustmentType)} className="input h-9">
                    <option value="CREDIT">Credit</option><option value="DEBIT">Debit</option><option value="REFUND_RECOVERY">Refund recovery</option><option value="BANK_FEE">Bank fee</option><option value="FX_ADJUSTMENT">FX adjustment</option><option value="OTHER">Other</option>
                  </select>
                </label>
                <label className="grid gap-1 text-xs font-medium theme-muted">Amount ({payout.currency.toUpperCase()} minor units)
                  <input inputMode="numeric" value={adjustmentAmount} onChange={(event) => setAdjustmentAmount(event.target.value.replace(/[^0-9]/g, ""))} placeholder="e.g. 500" className="input h-9" />
                </label>
                <label className="grid gap-1 text-xs font-medium theme-muted">Confirm payout or order number
                  <input value={adjustmentConfirmation} onChange={(event) => setAdjustmentConfirmation(event.target.value)} placeholder={payout.payoutNumber} className="input h-9" />
                </label>
                <label className="grid gap-1 text-xs font-medium theme-muted md:col-span-2">Reason
                  <input value={adjustmentReason} onChange={(event) => setAdjustmentReason(event.target.value)} maxLength={1000} placeholder="Required accounting reason" className="input h-9" />
                </label>
                <label className="grid gap-1 text-xs font-medium theme-muted">Internal note (optional)
                  <input value={adjustmentNote} onChange={(event) => setAdjustmentNote(event.target.value)} maxLength={2000} className="input h-9" />
                </label>
              </div>
              <div><button onClick={() => void addAdjustment(payout)} disabled={adjusting} className="inline-flex h-9 items-center rounded-md border px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50">{adjusting ? "Adding adjustment…" : "Add adjustment"}</button></div>
              <div className="grid gap-2">
                {payout.adjustments.length ? payout.adjustments.map((adjustment) => <div key={adjustment.id} className="grid gap-1 rounded-md border bg-white px-3 py-2 text-xs sm:grid-cols-[auto_1fr_auto] sm:items-center">
                  <span className="font-semibold theme-foreground">{adjustment.adjustmentType.replaceAll("_", " ")} {adjustment.adjustmentType === "CREDIT" ? "+" : "−"}{money(adjustment.amount, adjustment.currency)}</span>
                  <span className="theme-muted">{adjustment.reason}{adjustment.internalNote ? ` · ${adjustment.internalNote}` : ""}{adjustment.requiresManualReconciliation ? " · manual reconciliation required" : ""}</span>
                  <span className="theme-muted">{adjustment.createdByUser.displayName || adjustment.createdByUser.email} · {new Date(adjustment.createdAt).toLocaleString()}</span>
                </div>) : <p className="text-xs theme-muted">No manual adjustments have been recorded.</p>}
              </div>
            </section>
            {payout.status === "SENT" ? (
              <p className="text-sm font-medium text-emerald-700">External payout recorded as sent {payout.sentAt ? new Date(payout.sentAt).toLocaleString() : ""}.</p>
            ) : (
              <div className="grid gap-2 border-t pt-4 theme-border">
                <label className="grid gap-1 text-xs font-medium theme-muted">
                  Reason for bank-detail reveal
                  <input value={revealReason} onChange={(event) => setRevealReason(event.target.value)} maxLength={500} className="input h-9" placeholder="Payout review" />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => void reveal(payout)} className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-xs font-semibold"><ShieldAlert className="size-4" />Reveal Bank Details</button>
                  <button onClick={() => void copyInstructions(payout)} disabled={!instructionsAreRevealed} title={instructionsAreRevealed ? "Copy the revealed instructions" : "Reveal this payout's bank details first"} className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"><ClipboardCopy className="size-4" />Copy Payout Instructions</button>
                  <button onClick={() => void downloadInstructions(payout)} disabled={!instructionsAreRevealed} className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"><Download className="size-4" />Download Payout Instruction</button>
                  {bankPortalUrl ? <a href={bankPortalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-xs font-semibold"><ExternalLink className="size-4" />Open Bank Portal</a> : null}
                  {canMarkSent ? <button onClick={() => void action(payout, "hold")} disabled={busy} className="inline-flex h-9 items-center rounded-md border px-3 text-xs font-semibold">Place on Hold</button> : null}
                  {payout.status === "READY" || payout.status === "HOLD" ? <button onClick={() => void action(payout, "processing")} disabled={busy} className="inline-flex h-9 items-center rounded-md border px-3 text-xs font-semibold">Mark as Processing</button> : null}
                  {canMarkSent ? <button onClick={() => void action(payout, "failed")} disabled={busy} className="inline-flex h-9 items-center rounded-md border px-3 text-xs font-semibold text-red-700">Mark as Failed</button> : null}
                </div>
                {canMarkSent ? <div className="flex flex-wrap gap-2"><input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="External transfer reference" className="input h-9" /><input value={bankReference} onChange={(event) => setBankReference(event.target.value)} placeholder="Sending bank reference (optional)" className="input h-9" /><input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Type order or payout number" className="input h-9" /><button onClick={() => void action(payout, "mark_sent")} disabled={busy || !reference || !confirmation} className="inline-flex h-9 items-center gap-2 rounded-md bg-zinc-950 px-3 text-xs font-semibold text-white disabled:opacity-50"><Send className="size-4" />Mark as Sent</button></div> : null}
              </div>
            )}
          </article>
        );
      })}
      {activeReveal ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><div className="flex items-center justify-between gap-3"><p className="font-semibold">Revealed bank instructions</p><button onClick={() => setRevealed(null)} className="inline-flex size-7 items-center justify-center rounded border" aria-label="Hide revealed bank instructions"><X className="size-4" /></button></div><p className="mt-1 text-xs">This view clears automatically after one minute.</p><pre className="mt-2 overflow-auto whitespace-pre-wrap">{JSON.stringify(activeReveal.instructions, null, 2)}</pre></div> : null}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs theme-muted">{label}</p><p className="mt-1 font-medium theme-foreground">{value}</p></div>;
}
