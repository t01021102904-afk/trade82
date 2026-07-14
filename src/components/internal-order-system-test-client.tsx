"use client";

import { Calculator, CheckCircle2, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type InternalOrderTestRun = {
  id: string;
  isInternalTest: boolean;
  testLabel: string;
  testOrderReference: string;
  status: "CREATED" | "SIMULATED_PAID" | "SIMULATED_PARTIALLY_REFUNDED" | "SIMULATED_REFUNDED" | "CANCELLED";
  productName: string;
  productAmount: number;
  shippingAmount: number;
  grossAmount: number;
  platformFeeAmount: number;
  sellerPayableAmount: number;
  simulatedPaidAmount: number;
  simulatedRefundAmount: number;
  payoutPreviewAmount: number | null;
  payoutPreviewGeneratedAt: string | null;
  version: number;
  createdAt: string;
};

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value / 100);
}

function newIdempotencyKey() {
  return crypto.randomUUID().replaceAll("-", "");
}

export function InternalOrderSystemTestClient() {
  const [runs, setRuns] = useState<InternalOrderTestRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [productName, setProductName] = useState("Internal test product");
  const [productAmount, setProductAmount] = useState("1000.00");
  const [shippingAmount, setShippingAmount] = useState("0.00");
  const [refundAmounts, setRefundAmounts] = useState<Record<string, string>>({});
  const [createKey, setCreateKey] = useState(newIdempotencyKey);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/order-system-test", { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Unable to load internal test orders.");
      setRuns(data.runs ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load internal test orders.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  async function mutate(payload: Record<string, unknown>, key: string) {
    setSubmitting(key);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/order-system-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Internal test action failed.");
      setNotice("Internal test simulation updated. No payment or payout was executed.");
      await load();
      return data;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Internal test action failed.");
      return null;
    } finally {
      setSubmitting(null);
    }
  }

  async function createRun() {
    const result = await mutate({
      action: "create",
      idempotencyKey: createKey,
      productName,
      productAmount,
      shippingAmount,
    }, "create");
    if (result) setCreateKey(newIdempotencyKey());
  }

  return (
    <main className="mx-auto grid max-w-6xl gap-5 px-4 py-8 sm:px-6">
      <section className="rounded-xl border border-red-300 bg-red-50 p-5 text-red-950 shadow-sm">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="text-sm font-bold tracking-wide">INTERNAL PRODUCTION TEST</p>
            <p className="mt-1 text-sm font-semibold">NO REAL PAYMENT, REFUND, TRANSFER, OR PAYOUT</p>
            <p className="mt-2 text-sm">This isolated tool records only clearly marked simulation data. It cannot create Stripe Checkout, a payment, a refund, a transfer, a payout, a bank instruction, or a notification.</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 rounded-xl border p-5 theme-surface-elevated">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.16em] theme-muted">Simulation</p>
          <h1 className="mt-1 text-2xl font-semibold theme-foreground">Order and seller proceeds test</h1>
          <p className="mt-2 text-sm theme-muted">Amounts are validated and stored in USD minor units on the server. Trade82 fee is calculated at 5%; seller proceeds cannot be negative.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="grid gap-1 text-sm font-medium">Test product<input value={productName} onChange={(event) => setProductName(event.target.value)} maxLength={240} className="input h-10" /></label>
          <label className="grid gap-1 text-sm font-medium">Product amount (USD)<input value={productAmount} onChange={(event) => setProductAmount(event.target.value)} inputMode="decimal" className="input h-10" /></label>
          <label className="grid gap-1 text-sm font-medium">Shipping amount (USD)<input value={shippingAmount} onChange={(event) => setShippingAmount(event.target.value)} inputMode="decimal" className="input h-10" /></label>
        </div>
        <div><button type="button" onClick={() => void createRun()} disabled={submitting !== null || !productName.trim()} className="inline-flex h-10 items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"><Calculator className="size-4" />{submitting === "create" ? "Creating simulation..." : "Create test order"}</button></div>
      </section>

      {error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {notice ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p> : null}

      <section className="grid gap-3">
        <div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-semibold theme-foreground">Your internal test orders</h2><p className="text-sm theme-muted">Only simulations created by your allowed Clerk account are visible here.</p></div><button type="button" onClick={() => void load()} disabled={loading || submitting !== null} className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-semibold disabled:opacity-50"><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />Refresh</button></div>
        {loading ? <div className="rounded-xl border p-10"><Loader2 className="size-5 animate-spin" /></div> : runs.length ? runs.map((run) => <TestRunCard key={run.id} run={run} refundAmount={refundAmounts[run.id] ?? "0.00"} onRefundAmount={(value) => setRefundAmounts((current) => ({ ...current, [run.id]: value }))} onAction={(action) => void mutate(action, `${action.action}:${run.id}`)} loading={submitting} />) : <div className="rounded-xl border p-8 text-sm theme-muted">No internal test orders have been created.</div>}
      </section>
    </main>
  );
}

function TestRunCard({ run, refundAmount, onRefundAmount, onAction, loading }: { run: InternalOrderTestRun; refundAmount: string; onRefundAmount: (value: string) => void; onAction: (action: Record<string, unknown>) => void; loading: string | null }) {
  const actionKey = (action: string) => `${action}:${run.id}`;
  const busy = loading !== null;
  return <article className="grid gap-4 rounded-xl border p-5 theme-surface-elevated">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold theme-foreground">{run.testOrderReference}</p><span className="rounded-full border px-2 py-0.5 text-xs font-semibold">{run.status.replaceAll("_", " ")}</span><span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">TEST ONLY</span></div><p className="mt-1 text-sm theme-muted">{run.productName} · Created {new Date(run.createdAt).toLocaleString()}</p></div><div className="text-right text-sm"><p className="theme-muted">Version {run.version}</p><p className="font-semibold">USD only</p></div></div>
    <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-5"><Value label="Product" value={money(run.productAmount)} /><Value label="Shipping" value={money(run.shippingAmount)} /><Value label="Gross" value={money(run.grossAmount)} /><Value label="Trade82 fee" value={money(run.platformFeeAmount)} /><Value label="Seller proceeds" value={money(run.sellerPayableAmount)} /><Value label="Simulated paid" value={money(run.simulatedPaidAmount)} /><Value label="Simulated refund" value={money(run.simulatedRefundAmount)} /><Value label="Payout preview" value={run.payoutPreviewAmount === null ? "Not generated" : money(run.payoutPreviewAmount)} /></dl>
    <div className="flex flex-wrap items-end gap-2 border-t pt-4">
      {run.status === "CREATED" ? <><button type="button" onClick={() => onAction({ action: "simulate-payment", runId: run.id, expectedVersion: run.version })} disabled={busy} className="h-9 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white disabled:opacity-50">{loading === actionKey("simulate-payment") ? "Updating..." : "Simulate paid"}</button><button type="button" onClick={() => onAction({ action: "cancel", runId: run.id, expectedVersion: run.version })} disabled={busy} className="h-9 rounded-md border px-3 text-sm font-semibold disabled:opacity-50">Cancel test</button></> : null}
      {run.status === "SIMULATED_PAID" ? <><label className="grid gap-1 text-xs font-medium">Refund simulation (USD)<input value={refundAmount} onChange={(event) => onRefundAmount(event.target.value)} inputMode="decimal" className="input h-9 w-36 text-sm" /></label><button type="button" onClick={() => onAction({ action: "simulate-refund", runId: run.id, expectedVersion: run.version, refundAmount })} disabled={busy} className="h-9 rounded-md border px-3 text-sm font-semibold disabled:opacity-50">Simulate refund</button><button type="button" onClick={() => onAction({ action: "payout-preview", runId: run.id, expectedVersion: run.version })} disabled={busy} className="h-9 rounded-md border px-3 text-sm font-semibold disabled:opacity-50">Generate payout preview</button></> : null}
      {run.status === "SIMULATED_PARTIALLY_REFUNDED" ? <button type="button" onClick={() => onAction({ action: "payout-preview", runId: run.id, expectedVersion: run.version })} disabled={busy} className="h-9 rounded-md border px-3 text-sm font-semibold disabled:opacity-50">Generate payout preview</button> : null}
      {run.payoutPreviewGeneratedAt ? <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700"><CheckCircle2 className="size-4" />Idempotent payout preview generated. No payout was created.</span> : null}
    </div>
  </article>;
}

function Value({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs theme-muted">{label}</dt><dd className="mt-1 font-semibold theme-foreground">{value}</dd></div>;
}
