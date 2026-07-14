"use client";

import { ChevronLeft, ChevronRight, Download, Eye, Loader2, Search, SlidersHorizontal, WalletCards, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  DEFAULT_ORDER_TABLE_COLUMNS,
  ORDER_TABLE_COLUMNS,
  sanitizeOrderTableColumnVisibility,
  type OrderTableColumn,
} from "@/lib/admin-order-table";

type Shipment = {
  incoterm: string; shippingMethod: string; originCountry: string; originCity: string | null;
  destinationCountry: string; destinationCity: string | null; carrierName: string | null;
  trackingNumber: string | null; shipDate: string | null; deliveredAt: string | null; shipmentStatus: string;
};
type Payout = {
  id: string; payoutNumber: string; status: string; currency: string; sellerPayableAmount: number;
  refundAdjustmentAmount: number; manualAdjustmentAmount: number; finalPayoutAmount: number;
  processingFeeAmount: number | null; bankNameSnapshot: string; accountNumberLast4: string | null;
  swiftBicSnapshot: string | null; settlementCurrency: string | null; sentAt: string | null; failureReason: string | null;
};
type AdminOrder = {
  id: string; orderNumber: string; createdAt: string; updatedAt: string; orderStatus: string; paymentStatus: string; shipmentStatus: string; payoutStatus: string;
  buyerCompanyName: string; buyerContactName: string | null; buyerEmail: string; buyerCountry: string;
  sellerCompanyName: string; sellerContactName: string | null; sellerEmail: string; sellerCountry: string;
  grossAmount: number; platformFeeAmount: number; sellerPayableAmount: number; currency: string; paidAt: string | null;
  items: Array<{ id: string; productName: string; quantity: string; unit: string; sku: string | null; hsCode: string | null; countryOfOrigin: string | null; productAmount: number; unitPrice: number | null; currency: string }>;
  shipment: Shipment | null; payout: Payout | null;
};
type OrderDetail = AdminOrder & {
  buyer: { companyName: string; contactName: string | null; email: string; phone: string | null; country: string; address: string | null };
  seller: { companyName: string; contactName: string | null; email: string; phone: string | null; country: string; address: string | null };
  payment: { status: string; dueDate: string; orderTerms: string; refundAmount: number; stripeProcessingFeeAmount: number | null; stripe: { checkoutSession: string | null; paymentIntent: string | null; charge: string | null } };
  timeline: Array<{ id: string; source: string; type: string; message: string | null; actor: string | null; createdAt: string }>;
  blockingPayoutReasons: string[];
};
type Summary = { orderCount: number; currencies: Record<string, { grossAmount: number; platformFeeAmount: number; sellerPayableAmount: number }>; sentPayoutsByCurrency: Record<string, number>; payoutsOnHold: number };

const storageKey = "trade82.admin.order-table-columns";
const columnLabels: Record<OrderTableColumn, string> = {
  orderNumber: "Order Number", createdAt: "Created Date", orderStatus: "Order Status", paymentStatus: "Payment Status", shipmentStatus: "Shipment Status", payoutStatus: "Payout Status",
  buyerCompany: "Buyer Company", buyerContact: "Buyer Contact", buyerCountry: "Buyer Country", sellerCompany: "Seller Company", sellerContact: "Seller Contact", sellerCountry: "Seller Country",
  product: "Product", quantity: "Quantity", grossAmount: "Gross Amount", platformFeeAmount: "Trade82 Fee", sellerPayableAmount: "Seller Payable", currency: "Currency",
  bankName: "Bank Name", maskedAccount: "Masked Account", swiftBic: "SWIFT / BIC", payoutCurrency: "Payout Currency", incoterm: "Incoterm", shippingMethod: "Shipping Method",
  originCountry: "Origin Country", destinationCountry: "Destination Country", carrier: "Carrier", trackingNumber: "Tracking Number", shipDate: "Ship Date", paidDate: "Paid Date", payoutSentDate: "Payout Sent Date", updatedAt: "Last Updated",
};
const sortableColumns: Partial<Record<OrderTableColumn, string>> = {
  orderNumber: "orderNumber", createdAt: "createdAt", updatedAt: "updatedAt", buyerCompany: "buyerCompanyName", sellerCompany: "sellerCompanyName", grossAmount: "grossAmount", platformFeeAmount: "platformFeeAmount", sellerPayableAmount: "sellerPayableAmount", paidDate: "paidAt",
};
function money(value: number, currency: string) { return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(value / 100); }
function date(value: string | null | undefined) { return value ? new Date(value).toLocaleDateString() : "—"; }
function dateTime(value: string | null | undefined) { return value ? new Date(value).toLocaleString() : "—"; }
function contact(name: string | null, email: string) { return name ? `${name} · ${email}` : email; }

export function AdminOrderManagement({ selectedId }: { selectedId?: string }) {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [sort, setSort] = useState("createdAt");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const [filters, setFilters] = useState({ orderStatus: "", paymentStatus: "", shipmentStatus: "", payoutStatus: "", buyerCountry: "", sellerCountry: "", originCountry: "", destinationCountry: "", currency: "", dateFrom: "", dateTo: "" });
  const [visibleColumns, setVisibleColumns] = useState<OrderTableColumn[]>(() => {
    if (typeof window === "undefined") return DEFAULT_ORDER_TABLE_COLUMNS;
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return DEFAULT_ORDER_TABLE_COLUMNS;
    try { return sanitizeOrderTableColumnVisibility(JSON.parse(stored)); }
    catch { window.localStorage.removeItem(storageKey); return DEFAULT_ORDER_TABLE_COLUMNS; }
  });
  const [showColumns, setShowColumns] = useState(false);
  const [preparingId, setPreparingId] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<OrderDetail | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedId) params.set("id", selectedId);
    if (search.trim()) params.set("search", search.trim());
    params.set("page", String(page)); params.set("pageSize", String(pageSize)); params.set("sort", sort); params.set("direction", direction);
    for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
    return params;
  }, [selectedId, search, page, pageSize, sort, direction, filters]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/orders?${query.toString()}`, { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Unable to load orders.");
      setOrders(data.orders ?? []); setSummary(data.summary ?? null); setTotal(data.total ?? 0); setTotalPages(data.totalPages ?? 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load orders."); }
    finally { setLoading(false); }
  }, [query]);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  const openDrawer = useCallback(async (orderId: string) => {
    setDrawerLoading(true); setError("");
    try {
      const response = await fetch(`/api/admin/orders?id=${encodeURIComponent(orderId)}&detail=1`, { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Unable to load order detail.");
      setDrawer(data.detail ?? null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load order detail."); }
    finally { setDrawerLoading(false); }
  }, []);
  useEffect(() => { if (!selectedId) return; const timer = window.setTimeout(() => void openDrawer(selectedId), 0); return () => window.clearTimeout(timer); }, [selectedId, openDrawer]);

  function updateFilter(key: keyof typeof filters, value: string) { setPage(1); setFilters((current) => ({ ...current, [key]: value })); }
  function clearFilters() { setSearch(""); setFilters({ orderStatus: "", paymentStatus: "", shipmentStatus: "", payoutStatus: "", buyerCountry: "", sellerCountry: "", originCountry: "", destinationCountry: "", currency: "", dateFrom: "", dateTo: "" }); setSort("createdAt"); setDirection("desc"); setPage(1); }
  function toggleColumn(column: OrderTableColumn) { setVisibleColumns((current) => { const next = current.includes(column) ? current.filter((item) => item !== column) : [...current, column]; const safe = sanitizeOrderTableColumnVisibility(next); window.localStorage.setItem(storageKey, JSON.stringify(safe)); return safe; }); }
  function restoreColumns() { window.localStorage.removeItem(storageKey); setVisibleColumns(DEFAULT_ORDER_TABLE_COLUMNS); }
  function changeSort(nextSort: string) { setPage(1); if (sort === nextSort) setDirection((current) => current === "asc" ? "desc" : "asc"); else { setSort(nextSort); setDirection("asc"); } }
  async function prepare(orderId: string) { setPreparingId(orderId); setError(""); try { const response = await fetch(`/api/admin/orders/${orderId}/prepare-payout`, { method: "POST" }); const data = await response.json().catch(() => null); if (!response.ok) throw new Error(data?.error ?? "Unable to prepare payout."); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to prepare payout."); } finally { setPreparingId(null); } }
  const csvHref = `/api/admin/orders?${new URLSearchParams({ ...Object.fromEntries(query.entries()), format: "csv" }).toString()}`;
  const visible = (column: OrderTableColumn) => visibleColumns.includes(column);
  const renderCell = (order: AdminOrder, column: OrderTableColumn) => {
    const item = order.items[0]; const payout = order.payout;
    const value: Record<OrderTableColumn, React.ReactNode> = {
      orderNumber: <button onClick={() => void openDrawer(order.id)} className="font-semibold hover:underline">{order.orderNumber}</button>, createdAt: date(order.createdAt), orderStatus: order.orderStatus, paymentStatus: order.paymentStatus, shipmentStatus: order.shipmentStatus, payoutStatus: order.payoutStatus,
      buyerCompany: order.buyerCompanyName, buyerContact: contact(order.buyerContactName, order.buyerEmail), buyerCountry: order.buyerCountry, sellerCompany: order.sellerCompanyName, sellerContact: contact(order.sellerContactName, order.sellerEmail), sellerCountry: order.sellerCountry,
      product: item?.productName ?? "—", quantity: item ? `${item.quantity} ${item.unit}` : "—", grossAmount: money(order.grossAmount, order.currency), platformFeeAmount: money(order.platformFeeAmount, order.currency), sellerPayableAmount: money(order.sellerPayableAmount, order.currency), currency: order.currency.toUpperCase(),
      bankName: payout?.bankNameSnapshot ?? "—", maskedAccount: payout?.accountNumberLast4 ? `•••• ${payout.accountNumberLast4}` : "—", swiftBic: payout?.swiftBicSnapshot ?? "—", payoutCurrency: payout?.settlementCurrency?.toUpperCase() ?? payout?.currency.toUpperCase() ?? "—", incoterm: order.shipment?.incoterm ?? "—", shippingMethod: order.shipment?.shippingMethod ?? "—",
      originCountry: order.shipment?.originCountry ?? "—", destinationCountry: order.shipment?.destinationCountry ?? "—", carrier: order.shipment?.carrierName ?? "—", trackingNumber: order.shipment?.trackingNumber ?? "—", shipDate: date(order.shipment?.shipDate), paidDate: date(order.paidAt), payoutSentDate: date(payout?.sentAt), updatedAt: dateTime(order.updatedAt),
    };
    return value[column];
  };

  return <section className="grid gap-4">
    <div className="grid gap-3 rounded-xl border p-4 theme-surface-elevated">
      <div className="flex flex-wrap items-end justify-between gap-3"><div className="flex flex-wrap gap-2"><label className="relative"><Search className="pointer-events-none absolute left-3 top-2.5 size-4 theme-muted" /><input value={search} onChange={(event) => { setPage(1); setSearch(event.target.value); }} placeholder="Order, company, email, product, tracking, transfer reference" className="input h-9 w-80 max-w-full pl-9" /></label><button onClick={() => setShowColumns((current) => !current)} className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-semibold"><SlidersHorizontal className="size-4" />Columns</button><a href={csvHref} className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-semibold"><Download className="size-4" />CSV (masked)</a></div><button onClick={clearFilters} className="h-9 rounded-md border px-3 text-sm font-semibold">Clear all filters</button></div>
      {showColumns ? <div className="grid gap-2 rounded-lg border p-3 text-xs sm:grid-cols-3 lg:grid-cols-5">{ORDER_TABLE_COLUMNS.map((column) => <label key={column} className="flex items-center gap-2"><input checked={visible(column)} onChange={() => toggleColumn(column)} type="checkbox" />{columnLabels[column]}</label>)}<button onClick={restoreColumns} className="w-fit font-semibold underline">Restore defaults</button></div> : null}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <FilterSelect value={filters.orderStatus} onChange={(value) => updateFilter("orderStatus", value)} label="Order status" values={["PAYMENT_PENDING", "PAID", "PROCESSING", "READY_TO_SHIP", "SHIPPED", "DELIVERED", "COMPLETED", "CANCELLED", "REFUNDED", "DISPUTED"]} />
        <FilterSelect value={filters.paymentStatus} onChange={(value) => updateFilter("paymentStatus", value)} label="Payment status" values={["UNPAID", "PENDING", "PAID", "PARTIALLY_REFUNDED", "REFUNDED", "FAILED", "DISPUTED"]} />
        <FilterSelect value={filters.shipmentStatus} onChange={(value) => updateFilter("shipmentStatus", value)} label="Shipment status" values={["NOT_READY", "READY", "BOOKED", "SHIPPED", "IN_TRANSIT", "DELIVERED", "EXCEPTION", "CANCELLED"]} />
        <FilterSelect value={filters.payoutStatus} onChange={(value) => updateFilter("payoutStatus", value)} label="Payout status" values={["NOT_READY", "HOLD", "READY", "PROCESSING", "SENT", "FAILED", "RETURNED", "CANCELLED"]} />
        <input value={filters.buyerCountry} onChange={(event) => updateFilter("buyerCountry", event.target.value)} placeholder="Buyer country" className="input h-9" /><input value={filters.sellerCountry} onChange={(event) => updateFilter("sellerCountry", event.target.value)} placeholder="Seller country" className="input h-9" />
        <input value={filters.originCountry} onChange={(event) => updateFilter("originCountry", event.target.value)} placeholder="Origin country" className="input h-9" /><input value={filters.destinationCountry} onChange={(event) => updateFilter("destinationCountry", event.target.value)} placeholder="Destination country" className="input h-9" />
        <input value={filters.currency} onChange={(event) => updateFilter("currency", event.target.value.toLowerCase())} maxLength={3} placeholder="Currency (USD)" className="input h-9" /><label className="grid gap-1 text-xs theme-muted">From<input value={filters.dateFrom} onChange={(event) => updateFilter("dateFrom", event.target.value)} type="date" className="input h-9" /></label><label className="grid gap-1 text-xs theme-muted">To<input value={filters.dateTo} onChange={(event) => updateFilter("dateTo", event.target.value)} type="date" className="input h-9" /></label>
      </div>
    </div>
    {error ? <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
    {summary ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Filtered orders" value={String(summary.orderCount)} /><Metric label="Payouts on hold" value={String(summary.payoutsOnHold)} />{Object.entries(summary.currencies).map(([currency, values]) => <Metric key={currency} label={`${currency.toUpperCase()} totals`} value={`Gross ${money(values.grossAmount, currency)} · Fee ${money(values.platformFeeAmount, currency)} · Seller ${money(values.sellerPayableAmount, currency)} · Sent ${money(summary.sentPayoutsByCurrency[currency] ?? 0, currency)}`} />)}</div> : null}
    <div className="overflow-x-auto rounded-xl border theme-surface-elevated"><table className="min-w-[2800px] text-left text-xs"><thead className="sticky top-0 z-10 border-b theme-surface-muted"><tr>{ORDER_TABLE_COLUMNS.filter(visible).map((column) => <th key={column} className="whitespace-nowrap px-3 py-3 font-semibold theme-foreground">{sortableColumns[column] ? <button onClick={() => changeSort(sortableColumns[column]!)} className="inline-flex items-center gap-1 hover:underline">{columnLabels[column]}{sort === sortableColumns[column] ? direction === "asc" ? " ↑" : " ↓" : ""}</button> : columnLabels[column]}</th>)}<th className="sticky right-0 bg-inherit px-3 py-3">Actions</th></tr></thead><tbody>{loading ? <tr><td colSpan={visibleColumns.length + 1} className="p-8"><Loader2 className="size-4 animate-spin" /></td></tr> : orders.length ? orders.map((order) => <tr key={order.id} className="border-b last:border-0 theme-border">{ORDER_TABLE_COLUMNS.filter(visible).map((column) => <td key={column} className="max-w-64 whitespace-nowrap px-3 py-3">{renderCell(order, column)}</td>)}<td className="sticky right-0 bg-white px-3 py-3"><div className="flex items-center gap-2"><button onClick={() => void openDrawer(order.id)} className="inline-flex h-8 items-center gap-1 rounded-md border px-2 font-semibold"><Eye className="size-3.5" />Details</button>{!order.payout && order.paymentStatus === "PAID" ? <button disabled={preparingId === order.id} onClick={() => void prepare(order.id)} className="inline-flex h-8 items-center gap-1 rounded-md border px-2 font-semibold disabled:opacity-50"><WalletCards className="size-3.5" />{preparingId === order.id ? "Preparing" : "Prepare Payout"}</button> : order.payout ? <Link href={`/admin/payouts/${order.payout.id}`} className="font-semibold theme-success-text">Review payout</Link> : null}</div></td></tr>) : <tr><td colSpan={visibleColumns.length + 1} className="p-10 text-center theme-muted">No orders found.</td></tr>}</tbody></table></div>
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm"><p className="theme-muted">{total.toLocaleString()} result{total === 1 ? "" : "s"}</p><div className="flex items-center gap-2"><select value={pageSize} onChange={(event) => { setPage(1); setPageSize(Number(event.target.value)); }} className="input h-9"><option value={25}>25 / page</option><option value={50}>50 / page</option><option value={100}>100 / page</option></select><button onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1} className="inline-flex h-9 items-center rounded-md border px-2 disabled:opacity-40" aria-label="Previous page"><ChevronLeft className="size-4" /></button><span className="min-w-28 text-center">Page {page} of {totalPages}</span><button onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages} className="inline-flex h-9 items-center rounded-md border px-2 disabled:opacity-40" aria-label="Next page"><ChevronRight className="size-4" /></button></div></div>
    {drawerLoading ? <div className="fixed inset-y-0 right-0 z-50 grid w-full max-w-xl place-items-center border-l bg-white shadow-2xl"><Loader2 className="size-5 animate-spin" /></div> : null}
    {drawer ? <OrderDrawer detail={drawer} onClose={() => setDrawer(null)} /> : null}
  </section>;
}

function FilterSelect({ value, onChange, label, values }: { value: string; onChange: (value: string) => void; label: string; values: string[] }) { return <select value={value} onChange={(event) => onChange(event.target.value)} className="input h-9"><option value="">All {label}</option>{values.map((item) => <option key={item}>{item}</option>)}</select>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border p-3 theme-surface-elevated"><p className="text-xs theme-muted">{label}</p><p className="mt-1 text-sm font-semibold theme-foreground">{value}</p></div>; }
function DetailBlock({ title, children }: { title: string; children: React.ReactNode }) { return <section className="grid gap-2 border-b pb-4 last:border-0"><h3 className="text-sm font-semibold theme-foreground">{title}</h3>{children}</section>; }
function OrderDrawer({ detail, onClose }: { detail: OrderDetail; onClose: () => void }) { return <aside role="dialog" aria-modal="true" aria-label={`Order ${detail.orderNumber} detail`} className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl overflow-y-auto border-l bg-white p-5 shadow-2xl"><div className="sticky top-0 z-10 -mt-5 mb-5 flex items-start justify-between border-b bg-white py-5"><div><p className="text-xs theme-muted">Order detail</p><h2 className="text-xl font-semibold theme-foreground">{detail.orderNumber}</h2></div><button onClick={onClose} className="inline-flex size-9 items-center justify-center rounded-md border" aria-label="Close order detail"><X className="size-4" /></button></div><div className="grid gap-5 text-sm"><DetailBlock title="Order identity"><p>{detail.orderStatus} · {detail.currency.toUpperCase()} · created {dateTime(detail.createdAt)}</p><p className="theme-muted">Updated {dateTime(detail.updatedAt)}</p></DetailBlock><div className="grid gap-5 sm:grid-cols-2"><DetailBlock title="Buyer snapshot"><p className="font-medium">{detail.buyer.companyName}</p><p>{contact(detail.buyer.contactName, detail.buyer.email)}</p><p>{detail.buyer.phone ?? "—"} · {detail.buyer.country}</p><p className="theme-muted">{detail.buyer.address ?? "—"}</p></DetailBlock><DetailBlock title="Seller snapshot"><p className="font-medium">{detail.seller.companyName}</p><p>{contact(detail.seller.contactName, detail.seller.email)}</p><p>{detail.seller.phone ?? "—"} · {detail.seller.country}</p><p className="theme-muted">{detail.seller.address ?? "—"}</p></DetailBlock></div><DetailBlock title="Items">{detail.items.map((item) => <div key={item.id} className="rounded-md border p-3"><p className="font-medium">{item.productName}</p><p className="theme-muted">{item.quantity} {item.unit} · {money(item.productAmount, item.currency)}{item.sku ? ` · SKU ${item.sku}` : ""}</p></div>)}</DetailBlock><DetailBlock title="Payment summary"><p>{detail.payment.status} · gross {money(detail.grossAmount, detail.currency)} · Trade82 fee {money(detail.platformFeeAmount, detail.currency)} · seller payable {money(detail.sellerPayableAmount, detail.currency)}</p><p>Stripe processing fee: {detail.payment.stripeProcessingFeeAmount === null ? "—" : money(detail.payment.stripeProcessingFeeAmount, detail.currency)} · refund adjustment: {money(detail.payment.refundAmount, detail.currency)}</p><p>Due {date(detail.payment.dueDate)} · {detail.payment.orderTerms}</p><p className="theme-muted">Checkout Session: {detail.payment.stripe.checkoutSession ?? "—"} · PaymentIntent: {detail.payment.stripe.paymentIntent ?? "—"} · Charge: {detail.payment.stripe.charge ?? "—"}</p></DetailBlock><DetailBlock title="Shipment summary">{detail.shipment ? <><p>{detail.shipment.incoterm} · {detail.shipment.shippingMethod} · {detail.shipment.shipmentStatus}</p><p>{detail.shipment.originCountry} → {detail.shipment.destinationCountry}</p><p>{detail.shipment.carrierName ?? "No carrier"} · tracking {detail.shipment.trackingNumber ?? "—"}</p><p>Ship date {date(detail.shipment.shipDate)} · delivered {date(detail.shipment.deliveredAt)}</p></> : <p className="theme-muted">No shipment record yet.</p>}</DetailBlock><DetailBlock title="Payout summary">{detail.payout ? <><p>{detail.payout.payoutNumber} · {detail.payout.status} · {detail.payout.currency.toUpperCase()}</p><p>Base seller payable {money(detail.payout.sellerPayableAmount, detail.payout.currency)} · refunds {money(detail.payout.refundAdjustmentAmount, detail.payout.currency)} · manual adjustments {money(detail.payout.manualAdjustmentAmount, detail.payout.currency)} · final {money(detail.payout.finalPayoutAmount, detail.payout.currency)}</p><p>{detail.payout.bankNameSnapshot} · {detail.payout.accountNumberLast4 ? `•••• ${detail.payout.accountNumberLast4}` : "masked account unavailable"} · {detail.payout.swiftBicSnapshot ?? "no SWIFT/BIC"}</p><p>Sent {dateTime(detail.payout.sentAt)}</p></> : <p className="theme-muted">No payout has been prepared.</p>}</DetailBlock><DetailBlock title="Blocking payout reasons">{detail.blockingPayoutReasons.length ? <ul className="list-disc pl-5">{detail.blockingPayoutReasons.map((reason) => <li key={reason}>{reason}</li>)}</ul> : <p className="theme-success-text">No current blocking reason.</p>}</DetailBlock><DetailBlock title="Timeline">{detail.timeline.length ? <ol className="grid gap-2">{detail.timeline.map((event) => <li key={event.id} className="rounded-md border p-3"><p className="font-medium">{event.type}</p><p>{event.message ?? "No message"}</p><p className="text-xs theme-muted">{event.source} · {event.actor ?? "System"} · {dateTime(event.createdAt)}</p></li>)}</ol> : <p className="theme-muted">No timeline events yet.</p>}</DetailBlock></div></aside>; }
