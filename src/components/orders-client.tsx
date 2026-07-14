"use client";

import { ArrowLeft, ChevronRight, Loader2, PackageCheck, Truck } from "lucide-react";
import Link from "next/link";
import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";

import { useI18n } from "@/components/i18n-provider";
import {
  formatTradeDate,
  formatTradeDateTime,
  formatTradeMoney,
  orderPaymentStatusLabel,
  payoutStatusLabel,
  shipmentStatusLabel,
  tradeOrderEventLabel,
} from "@/lib/trade-order-i18n";

type OrderSummary = {
  id: string; orderNumber: string; orderStatus: string; paymentStatus: string; shipmentStatus: string; payoutStatus: string;
  buyerCompanyName: string; sellerCompanyName: string; grossAmount: number; currency: string; createdAt: string;
  items: Array<{ productName: string; quantity: string; unit: string }>;
  shipment: { trackingNumber: string | null; shipmentStatus: string } | null;
};
type OrderDetail = Omit<OrderSummary, "items" | "shipment"> & {
  productAmount: number; shippingAmount: number; platformFeeAmount: number; sellerPayableAmount: number; paidAt: string | null; buyerCountry: string; sellerCountry: string;
  items: Array<{ productName: string; quantity: string; unit: string; productAmount: number; currency: string }>;
  shipment: Record<string, string | null> | null;
  events: Array<{ id: string; eventType: string; message: string | null; createdAt: string }>;
  payout: { status: string; payoutNumber: string; finalPayoutAmount: number; sentAt: string | null; accountNumberLast4: string | null; bankNameSnapshot: string } | null;
};

function orderHref(orderNumber: string, locale: "en" | "ko") {
  return `${locale === "en" ? "" : `/${locale}`}/orders/${encodeURIComponent(orderNumber)}`;
}

export function OrdersClient({ locale: pageLocale }: { locale?: "en" | "ko" }) {
  const { locale: contextLocale, t } = useI18n();
  const locale = pageLocale ?? contextLocale;
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/orders", { cache: "no-store" })
      .then(async (response) => ({ response, data: await response.json().catch(() => null) }))
      .then(({ response, data }) => {
        if (!active) return;
        if (!response.ok) { setError(t("orders.loadOrdersError")); return; }
        setOrders(data.orders ?? []);
      })
      .catch(() => active && setError(t("orders.loadOrdersError")))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [t]);

  return <main className="mx-auto grid max-w-6xl gap-5 px-4 py-8 sm:px-6"><header><p className="text-xs font-semibold uppercase tracking-[.18em] theme-success-text">Trade82</p><h1 className="mt-2 text-2xl font-semibold theme-foreground">{t("orders.title")}</h1><p className="mt-2 text-sm theme-muted">{t("orders.description")}</p></header>{loading ? <Loader2 className="size-5 animate-spin theme-muted" aria-label={t("payouts.loading")} /> : null}{error ? <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}{!loading && !error && orders.length === 0 ? <div className="rounded-xl border p-8 text-center text-sm theme-muted">{t("orders.noOrders")}</div> : null}<section className="grid gap-3">{orders.map((order) => <Link key={order.id} href={orderHref(order.orderNumber, locale)} className="group flex flex-wrap items-center gap-4 rounded-xl border p-4 transition hover:shadow-sm theme-surface-elevated"><span className="flex size-10 items-center justify-center rounded-lg border theme-surface-muted"><PackageCheck className="size-5 theme-success-text" /></span><div className="min-w-0 flex-1"><p className="text-xs font-semibold theme-muted">{order.orderNumber}</p><h2 className="mt-1 truncate font-semibold theme-foreground">{order.items[0]?.productName ?? t("orders.product")}</h2><p className="mt-1 text-sm theme-muted">{order.items[0] ? `${order.items[0].quantity} ${order.items[0].unit} · ` : ""}{formatTradeMoney(order.grossAmount, order.currency, locale)}</p></div><div className="hidden text-right text-xs theme-muted sm:block"><p>{orderPaymentStatusLabel(order.paymentStatus, t)} · {shipmentStatusLabel(order.shipmentStatus, t)}</p><p className="mt-1">{formatTradeDate(order.createdAt, locale)}</p></div><ChevronRight className="size-5 theme-muted" /></Link>)}</section></main>;
}

export function OrderDetailClient({ orderNumber, locale: pageLocale }: { orderNumber: string; locale?: "en" | "ko" }) {
  const { locale: contextLocale, t } = useI18n();
  const locale = pageLocale ?? contextLocale;
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [sellerCanEdit, setSellerCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => { const response = await fetch(`/api/orders/${encodeURIComponent(orderNumber)}`, { cache: "no-store" }); const data = await response.json().catch(() => null); if (!response.ok) throw new Error(t("orders.loadOrderDetailError")); setOrder(data.order); setSellerCanEdit(Boolean(data.sellerCanEdit)); }, [orderNumber, t]);
  useEffect(() => { const timer = window.setTimeout(() => { void load().catch(() => setError(t("orders.loadOrderDetailError"))).finally(() => setLoading(false)); }, 0); return () => window.clearTimeout(timer); }, [load, t]);
  async function updateShipment(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!order) return; setSaving(true); setError(""); const form = new FormData(event.currentTarget); try { const response = await fetch(`/api/orders/${encodeURIComponent(order.orderNumber)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ carrierName: form.get("carrierName"), trackingNumber: form.get("trackingNumber"), shipmentStatus: form.get("shipmentStatus"), shipmentReference: form.get("shipmentReference") }) }); if (!response.ok) throw new Error(t("orders.updateShipmentError")); await load(); } catch { setError(t("orders.updateShipmentError")); } finally { setSaving(false); } }
  if (loading) return <main className="mx-auto max-w-6xl px-4 py-10"><Loader2 className="size-5 animate-spin theme-muted" aria-label={t("payouts.loading")} /></main>;
  if (!order) return <main className="mx-auto max-w-6xl px-4 py-10"><p className="text-sm text-red-700">{error || t("orders.orderNotFound")}</p></main>;
  return <main className="mx-auto grid max-w-6xl gap-5 px-4 py-8 sm:px-6"><Link href={locale === "en" ? "/orders" : `/${locale}/orders`} className="inline-flex w-fit items-center gap-2 text-sm theme-muted"><ArrowLeft className="size-4" />{t("orders.backToOrders")}</Link><header className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold theme-muted">{order.orderNumber}</p><h1 className="mt-1 text-2xl font-semibold theme-foreground">{order.items[0]?.productName ?? t("orders.product")}</h1><p className="mt-2 text-sm theme-muted">{order.buyerCompanyName} · {order.sellerCompanyName}</p></div><span className="rounded-full border px-3 py-1 text-xs font-semibold theme-success-badge">{orderPaymentStatusLabel(order.paymentStatus, t)}</span></header>{error ? <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}<section className="grid gap-4 md:grid-cols-3"><Metric label={t("orders.grossAmount")} value={formatTradeMoney(order.grossAmount, order.currency, locale)} /><Metric label={t("orders.paymentStatus")} value={orderPaymentStatusLabel(order.paymentStatus, t)} /><Metric label={t("orders.shipment")} value={shipmentStatusLabel(order.shipmentStatus, t)} />{sellerCanEdit ? <><Metric label={t("orders.trade82Fee")} value={formatTradeMoney(order.platformFeeAmount, order.currency, locale)} /><Metric label={t("orders.sellerPayable")} value={formatTradeMoney(order.sellerPayableAmount, order.currency, locale)} /><Metric label={t("orders.payoutStatus")} value={payoutStatusLabel(order.payoutStatus, t)} /></> : null}</section><section className="grid gap-4 lg:grid-cols-2"><article className="rounded-xl border p-5 theme-surface-elevated"><h2 className="font-semibold theme-foreground">{t("orders.products")}</h2><div className="mt-3 grid gap-2">{order.items.map((item, index) => <div key={`${item.productName}-${index}`} className="flex justify-between gap-4 text-sm"><span>{item.productName} <span className="theme-muted">{item.quantity} {item.unit}</span></span><strong>{formatTradeMoney(item.productAmount, item.currency, locale)}</strong></div>)}</div></article><article className="rounded-xl border p-5 theme-surface-elevated"><h2 className="flex items-center gap-2 font-semibold theme-foreground"><Truck className="size-4" />{t("orders.shipment")}</h2><p className="mt-3 text-sm theme-muted">{order.shipment?.trackingNumber ? `${t("orders.tracking")}: ${order.shipment.trackingNumber}` : t("orders.trackingWillAppear")}</p>{sellerCanEdit ? <form onSubmit={updateShipment} className="mt-4 grid gap-3"><input name="carrierName" className="input" defaultValue={order.shipment?.carrierName ?? ""} placeholder={t("orders.carrierName")} /><input name="trackingNumber" className="input" defaultValue={order.shipment?.trackingNumber ?? ""} placeholder={t("orders.trackingNumber")} /><input name="shipmentReference" className="input" defaultValue={order.shipment?.shipmentReference ?? ""} placeholder={t("orders.shipmentReference")} /><select name="shipmentStatus" className="input" defaultValue={order.shipmentStatus}><option value="READY">{shipmentStatusLabel("READY", t)}</option><option value="BOOKED">{shipmentStatusLabel("BOOKED", t)}</option><option value="SHIPPED">{shipmentStatusLabel("SHIPPED", t)}</option><option value="IN_TRANSIT">{shipmentStatusLabel("IN_TRANSIT", t)}</option><option value="DELIVERED">{shipmentStatusLabel("DELIVERED", t)}</option><option value="EXCEPTION">{shipmentStatusLabel("EXCEPTION", t)}</option></select><button disabled={saving} className="inline-flex h-9 w-fit items-center rounded-md bg-zinc-950 px-3 text-sm font-semibold text-white disabled:opacity-60">{saving ? t("orders.saving") : t("orders.updateShipment")}</button></form> : null}</article></section><section className="rounded-xl border p-5 theme-surface-elevated"><h2 className="font-semibold theme-foreground">{t("orders.timeline")}</h2><ol className="mt-4 grid gap-3">{order.events.map((event) => <li key={event.id} className="border-l pl-3 text-sm theme-border"><p className="font-medium theme-foreground">{event.message ?? tradeOrderEventLabel(event.eventType, t)}</p><time className="text-xs theme-muted">{formatTradeDateTime(event.createdAt, locale)}</time></li>)}</ol></section></main>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border p-4 theme-surface-elevated"><p className="text-xs theme-muted">{label}</p><p className="mt-1 font-semibold theme-foreground">{value}</p></div>; }
