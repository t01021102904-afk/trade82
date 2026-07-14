"use client";

import { ChevronLeft, ChevronRight, Download, Eye, Loader2, Search, SlidersHorizontal, WalletCards, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useI18n } from "@/components/i18n-provider";
import {
  DEFAULT_ORDER_TABLE_COLUMNS,
  ORDER_TABLE_COLUMNS,
  sanitizeOrderTableColumnVisibility,
  type OrderTableColumn,
} from "@/lib/admin-order-table";
import {
  formatTradeDate,
  formatTradeDateTime,
  formatTradeMoney,
  orderPaymentStatusLabel,
  payoutStatusLabel,
  shipmentStatusLabel,
  tradeOrderEventLabel,
  tradeOrderStatusLabel,
} from "@/lib/trade-order-i18n";

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
const sortableColumns: Partial<Record<OrderTableColumn, string>> = {
  orderNumber: "orderNumber", createdAt: "createdAt", updatedAt: "updatedAt", buyerCompany: "buyerCompanyName", sellerCompany: "sellerCompanyName", grossAmount: "grossAmount", platformFeeAmount: "platformFeeAmount", sellerPayableAmount: "sellerPayableAmount", paidDate: "paidAt",
};
function contact(name: string | null, email: string) { return name ? `${name} · ${email}` : email; }
function columnLabel(column: OrderTableColumn, t: (key: string, fallback?: string) => string) { return t(`orders.column.${column}`); }

export function AdminOrderManagement({ selectedId }: { selectedId?: string }) {
  const { locale, t } = useI18n();
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
      if (!response.ok) throw new Error(t("orders.loadOrdersError"));
      setOrders(data.orders ?? []); setSummary(data.summary ?? null); setTotal(data.total ?? 0); setTotalPages(data.totalPages ?? 1);
    } catch { setError(t("orders.loadOrdersError")); }
    finally { setLoading(false); }
  }, [query, t]);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  const openDrawer = useCallback(async (orderId: string) => {
    setDrawerLoading(true); setError("");
    try {
      const response = await fetch(`/api/admin/orders?id=${encodeURIComponent(orderId)}&detail=1`, { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(t("orders.loadOrderDetailError"));
      setDrawer(data.detail ?? null);
    } catch { setError(t("orders.loadOrderDetailError")); }
    finally { setDrawerLoading(false); }
  }, [t]);
  useEffect(() => { if (!selectedId) return; const timer = window.setTimeout(() => void openDrawer(selectedId), 0); return () => window.clearTimeout(timer); }, [selectedId, openDrawer]);

  function updateFilter(key: keyof typeof filters, value: string) { setPage(1); setFilters((current) => ({ ...current, [key]: value })); }
  function clearFilters() { setSearch(""); setFilters({ orderStatus: "", paymentStatus: "", shipmentStatus: "", payoutStatus: "", buyerCountry: "", sellerCountry: "", originCountry: "", destinationCountry: "", currency: "", dateFrom: "", dateTo: "" }); setSort("createdAt"); setDirection("desc"); setPage(1); }
  function toggleColumn(column: OrderTableColumn) { setVisibleColumns((current) => { const next = current.includes(column) ? current.filter((item) => item !== column) : [...current, column]; const safe = sanitizeOrderTableColumnVisibility(next); window.localStorage.setItem(storageKey, JSON.stringify(safe)); return safe; }); }
  function restoreColumns() { window.localStorage.removeItem(storageKey); setVisibleColumns(DEFAULT_ORDER_TABLE_COLUMNS); }
  function changeSort(nextSort: string) { setPage(1); if (sort === nextSort) setDirection((current) => current === "asc" ? "desc" : "asc"); else { setSort(nextSort); setDirection("asc"); } }
  async function prepare(orderId: string) { setPreparingId(orderId); setError(""); try { const response = await fetch(`/api/admin/orders/${orderId}/prepare-payout`, { method: "POST" }); if (!response.ok) throw new Error(t("orders.preparePayoutError")); await load(); } catch { setError(t("orders.preparePayoutError")); } finally { setPreparingId(null); } }
  const csvHref = `/api/admin/orders?${new URLSearchParams({ ...Object.fromEntries(query.entries()), format: "csv" }).toString()}`;
  const visible = (column: OrderTableColumn) => visibleColumns.includes(column);
  const renderCell = (order: AdminOrder, column: OrderTableColumn) => {
    const item = order.items[0]; const payout = order.payout;
    const value: Record<OrderTableColumn, React.ReactNode> = {
      orderNumber: <button onClick={() => void openDrawer(order.id)} className="font-semibold hover:underline">{order.orderNumber}</button>, createdAt: formatTradeDate(order.createdAt, locale), orderStatus: tradeOrderStatusLabel(order.orderStatus, t), paymentStatus: orderPaymentStatusLabel(order.paymentStatus, t), shipmentStatus: shipmentStatusLabel(order.shipmentStatus, t), payoutStatus: payoutStatusLabel(order.payoutStatus, t),
      buyerCompany: order.buyerCompanyName, buyerContact: contact(order.buyerContactName, order.buyerEmail), buyerCountry: order.buyerCountry, sellerCompany: order.sellerCompanyName, sellerContact: contact(order.sellerContactName, order.sellerEmail), sellerCountry: order.sellerCountry,
      product: item?.productName ?? "—", quantity: item ? `${item.quantity} ${item.unit}` : "—", grossAmount: formatTradeMoney(order.grossAmount, order.currency, locale), platformFeeAmount: formatTradeMoney(order.platformFeeAmount, order.currency, locale), sellerPayableAmount: formatTradeMoney(order.sellerPayableAmount, order.currency, locale), currency: order.currency.toUpperCase(),
      bankName: payout?.bankNameSnapshot ?? "—", maskedAccount: payout?.accountNumberLast4 ? `•••• ${payout.accountNumberLast4}` : "—", swiftBic: payout?.swiftBicSnapshot ?? "—", payoutCurrency: payout?.settlementCurrency?.toUpperCase() ?? payout?.currency.toUpperCase() ?? "—", incoterm: order.shipment?.incoterm ?? "—", shippingMethod: order.shipment?.shippingMethod ?? "—",
      originCountry: order.shipment?.originCountry ?? "—", destinationCountry: order.shipment?.destinationCountry ?? "—", carrier: order.shipment?.carrierName ?? "—", trackingNumber: order.shipment?.trackingNumber ?? "—", shipDate: formatTradeDate(order.shipment?.shipDate, locale), paidDate: formatTradeDate(order.paidAt, locale), payoutSentDate: formatTradeDate(payout?.sentAt, locale), updatedAt: formatTradeDateTime(order.updatedAt, locale),
    };
    return value[column];
  };

  return <section className="grid gap-4">
    <div className="grid gap-3 rounded-xl border p-4 theme-surface-elevated">
      <div className="flex flex-wrap items-end justify-between gap-3"><div className="flex flex-wrap gap-2"><label className="relative"><Search className="pointer-events-none absolute left-3 top-2.5 size-4 theme-muted" /><input value={search} onChange={(event) => { setPage(1); setSearch(event.target.value); }} placeholder={t("orders.searchPlaceholder")} className="input h-9 w-80 max-w-full pl-9" /></label><button onClick={() => setShowColumns((current) => !current)} className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-semibold"><SlidersHorizontal className="size-4" />{t("orders.columns")}</button><a href={csvHref} className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-semibold"><Download className="size-4" />{t("orders.maskedCsv")}</a></div><button onClick={clearFilters} className="h-9 rounded-md border px-3 text-sm font-semibold">{t("orders.clearFilters")}</button></div>
      {showColumns ? <div className="grid gap-2 rounded-lg border p-3 text-xs sm:grid-cols-3 lg:grid-cols-5">{ORDER_TABLE_COLUMNS.map((column) => <label key={column} className="flex items-center gap-2"><input checked={visible(column)} onChange={() => toggleColumn(column)} type="checkbox" />{columnLabel(column, t)}</label>)}<button onClick={restoreColumns} className="w-fit font-semibold underline">{t("orders.restoreDefaults")}</button></div> : null}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <FilterSelect value={filters.orderStatus} onChange={(value) => updateFilter("orderStatus", value)} label={t("orders.orderStatus")} values={["PAYMENT_PENDING", "PAID", "PROCESSING", "READY_TO_SHIP", "SHIPPED", "DELIVERED", "COMPLETED", "CANCELLED", "REFUNDED", "DISPUTED"]} formatter={(value) => tradeOrderStatusLabel(value, t)} />
        <FilterSelect value={filters.paymentStatus} onChange={(value) => updateFilter("paymentStatus", value)} label={t("orders.paymentStatus")} values={["UNPAID", "PENDING", "PAID", "PARTIALLY_REFUNDED", "REFUNDED", "FAILED", "DISPUTED"]} formatter={(value) => orderPaymentStatusLabel(value, t)} />
        <FilterSelect value={filters.shipmentStatus} onChange={(value) => updateFilter("shipmentStatus", value)} label={t("orders.shipmentStatus")} values={["NOT_READY", "READY", "BOOKED", "SHIPPED", "IN_TRANSIT", "DELIVERED", "EXCEPTION", "CANCELLED"]} formatter={(value) => shipmentStatusLabel(value, t)} />
        <FilterSelect value={filters.payoutStatus} onChange={(value) => updateFilter("payoutStatus", value)} label={t("orders.payoutStatus")} values={["NOT_READY", "HOLD", "READY", "PROCESSING", "SENT", "FAILED", "RETURNED", "CANCELLED"]} formatter={(value) => payoutStatusLabel(value, t)} />
        <input value={filters.buyerCountry} onChange={(event) => updateFilter("buyerCountry", event.target.value)} placeholder={t("orders.buyerCountry")} className="input h-9" /><input value={filters.sellerCountry} onChange={(event) => updateFilter("sellerCountry", event.target.value)} placeholder={t("orders.sellerCountry")} className="input h-9" />
        <input value={filters.originCountry} onChange={(event) => updateFilter("originCountry", event.target.value)} placeholder={t("orders.originCountry")} className="input h-9" /><input value={filters.destinationCountry} onChange={(event) => updateFilter("destinationCountry", event.target.value)} placeholder={t("orders.destinationCountry")} className="input h-9" />
        <input value={filters.currency} onChange={(event) => updateFilter("currency", event.target.value.toLowerCase())} maxLength={3} placeholder={`${t("orders.currency")} (USD)`} className="input h-9" /><label className="grid gap-1 text-xs theme-muted">{t("orders.from")}<input value={filters.dateFrom} onChange={(event) => updateFilter("dateFrom", event.target.value)} type="date" className="input h-9" /></label><label className="grid gap-1 text-xs theme-muted">{t("orders.to")}<input value={filters.dateTo} onChange={(event) => updateFilter("dateTo", event.target.value)} type="date" className="input h-9" /></label>
      </div>
    </div>
    {error ? <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
    {summary ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label={t("orders.filteredOrders")} value={String(summary.orderCount)} /><Metric label={t("orders.payoutsOnHold")} value={String(summary.payoutsOnHold)} />{Object.entries(summary.currencies).map(([currency, values]) => <Metric key={currency} label={`${currency.toUpperCase()} ${t("orders.filteredOrders")}`} value={`${t("orders.gross")} ${formatTradeMoney(values.grossAmount, currency, locale)} · ${t("orders.fee")} ${formatTradeMoney(values.platformFeeAmount, currency, locale)} · ${t("orders.seller")} ${formatTradeMoney(values.sellerPayableAmount, currency, locale)} · ${t("orders.sent")} ${formatTradeMoney(summary.sentPayoutsByCurrency[currency] ?? 0, currency, locale)}`} />)}</div> : null}
    <div className="overflow-x-auto rounded-xl border theme-surface-elevated"><table className="min-w-[2800px] text-left text-xs"><thead className="sticky top-0 z-10 border-b theme-surface-muted"><tr>{ORDER_TABLE_COLUMNS.filter(visible).map((column) => <th key={column} className="whitespace-nowrap px-3 py-3 font-semibold theme-foreground">{sortableColumns[column] ? <button onClick={() => changeSort(sortableColumns[column]!)} className="inline-flex items-center gap-1 hover:underline">{columnLabel(column, t)}{sort === sortableColumns[column] ? direction === "asc" ? " ↑" : " ↓" : ""}</button> : columnLabel(column, t)}</th>)}<th className="sticky right-0 bg-inherit px-3 py-3">{t("orders.actions")}</th></tr></thead><tbody>{loading ? <tr><td colSpan={visibleColumns.length + 1} className="p-8"><Loader2 className="size-4 animate-spin" aria-label={t("payouts.loading")} /></td></tr> : orders.length ? orders.map((order) => <tr key={order.id} className="border-b last:border-0 theme-border">{ORDER_TABLE_COLUMNS.filter(visible).map((column) => <td key={column} className="max-w-64 whitespace-nowrap px-3 py-3">{renderCell(order, column)}</td>)}<td className="sticky right-0 bg-white px-3 py-3"><div className="flex items-center gap-2"><button onClick={() => void openDrawer(order.id)} className="inline-flex h-8 items-center gap-1 rounded-md border px-2 font-semibold"><Eye className="size-3.5" />{t("orders.details")}</button>{!order.payout && order.paymentStatus === "PAID" ? <button disabled={preparingId === order.id} onClick={() => void prepare(order.id)} className="inline-flex h-8 items-center gap-1 rounded-md border px-2 font-semibold disabled:opacity-50"><WalletCards className="size-3.5" />{preparingId === order.id ? t("orders.preparing") : t("orders.preparePayout")}</button> : order.payout ? <Link href={`/admin/payouts/${order.payout.id}`} className="font-semibold theme-success-text">{t("orders.reviewPayout")}</Link> : null}</div></td></tr>) : <tr><td colSpan={visibleColumns.length + 1} className="p-10 text-center theme-muted">{t("orders.noOrders")}</td></tr>}</tbody></table></div>
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm"><p className="theme-muted">{total.toLocaleString(locale === "ko" ? "ko-KR" : "en-US")} {t("orders.results")}</p><div className="flex items-center gap-2"><select value={pageSize} onChange={(event) => { setPage(1); setPageSize(Number(event.target.value)); }} className="input h-9"><option value={25}>25 / {t("orders.perPage")}</option><option value={50}>50 / {t("orders.perPage")}</option><option value={100}>100 / {t("orders.perPage")}</option></select><button onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1} className="inline-flex h-9 items-center rounded-md border px-2 disabled:opacity-40" aria-label={t("orders.previousPage")}><ChevronLeft className="size-4" /></button><span className="min-w-28 text-center">{t("orders.pageOf").replace("{page}", String(page)).replace("{total}", String(totalPages))}</span><button onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages} className="inline-flex h-9 items-center rounded-md border px-2 disabled:opacity-40" aria-label={t("orders.nextPage")}><ChevronRight className="size-4" /></button></div></div>
    {drawerLoading ? <div className="fixed inset-y-0 right-0 z-50 grid w-full max-w-xl place-items-center border-l bg-white shadow-2xl"><Loader2 className="size-5 animate-spin" /></div> : null}
    {drawer ? <OrderDrawer detail={drawer} onClose={() => setDrawer(null)} locale={locale} t={t} /> : null}
  </section>;
}

function FilterSelect({ value, onChange, label, values, formatter }: { value: string; onChange: (value: string) => void; label: string; values: string[]; formatter: (value: string) => string }) { const { t } = useI18n(); return <select value={value} onChange={(event) => onChange(event.target.value)} className="input h-9"><option value="">{t("orders.allStatus").replace("{label}", label)}</option>{values.map((item) => <option key={item} value={item}>{formatter(item)}</option>)}</select>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border p-3 theme-surface-elevated"><p className="text-xs theme-muted">{label}</p><p className="mt-1 text-sm font-semibold theme-foreground">{value}</p></div>; }
function DetailBlock({ title, children }: { title: string; children: React.ReactNode }) { return <section className="grid gap-2 border-b pb-4 last:border-0"><h3 className="text-sm font-semibold theme-foreground">{title}</h3>{children}</section>; }
function OrderDrawer({ detail, onClose, locale, t }: { detail: OrderDetail; onClose: () => void; locale: "en" | "ko"; t: (key: string, fallback?: string) => string }) { return <aside role="dialog" aria-modal="true" aria-label={t("orders.orderDetailAria").replace("{orderNumber}", detail.orderNumber)} className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl overflow-y-auto border-l bg-white p-5 shadow-2xl"><div className="sticky top-0 z-10 -mt-5 mb-5 flex items-start justify-between border-b bg-white py-5"><div><p className="text-xs theme-muted">{t("orders.orderDetail")}</p><h2 className="text-xl font-semibold theme-foreground">{detail.orderNumber}</h2></div><button onClick={onClose} className="inline-flex size-9 items-center justify-center rounded-md border" aria-label={t("orders.closeOrderDetail")}><X className="size-4" /></button></div><div className="grid gap-5 text-sm"><DetailBlock title={t("orders.orderIdentity")}><p>{tradeOrderStatusLabel(detail.orderStatus, t)} · {detail.currency.toUpperCase()} · {t("orders.created")} {formatTradeDateTime(detail.createdAt, locale)}</p><p className="theme-muted">{t("orders.updated")} {formatTradeDateTime(detail.updatedAt, locale)}</p></DetailBlock><div className="grid gap-5 sm:grid-cols-2"><DetailBlock title={t("orders.buyerSnapshot")}><p className="font-medium">{detail.buyer.companyName}</p><p>{contact(detail.buyer.contactName, detail.buyer.email)}</p><p>{detail.buyer.phone ?? "—"} · {detail.buyer.country}</p><p className="theme-muted">{detail.buyer.address ?? "—"}</p></DetailBlock><DetailBlock title={t("orders.sellerSnapshot")}><p className="font-medium">{detail.seller.companyName}</p><p>{contact(detail.seller.contactName, detail.seller.email)}</p><p>{detail.seller.phone ?? "—"} · {detail.seller.country}</p><p className="theme-muted">{detail.seller.address ?? "—"}</p></DetailBlock></div><DetailBlock title={t("orders.items")}>{detail.items.map((item) => <div key={item.id} className="rounded-md border p-3"><p className="font-medium">{item.productName}</p><p className="theme-muted">{item.quantity} {item.unit} · {formatTradeMoney(item.productAmount, item.currency, locale)}{item.sku ? ` · SKU ${item.sku}` : ""}</p></div>)}</DetailBlock><DetailBlock title={t("orders.paymentSummary")}><p>{orderPaymentStatusLabel(detail.payment.status, t)} · {t("orders.gross")} {formatTradeMoney(detail.grossAmount, detail.currency, locale)} · {t("orders.trade82Fee")} {formatTradeMoney(detail.platformFeeAmount, detail.currency, locale)} · {t("orders.sellerPayable")} {formatTradeMoney(detail.sellerPayableAmount, detail.currency, locale)}</p><p>{t("orders.stripeProcessingFee")}: {detail.payment.stripeProcessingFeeAmount === null ? "—" : formatTradeMoney(detail.payment.stripeProcessingFeeAmount, detail.currency, locale)} · {t("orders.refundAdjustment")}: {formatTradeMoney(detail.payment.refundAmount, detail.currency, locale)}</p><p>{t("orders.due")} {formatTradeDate(detail.payment.dueDate, locale)} · {detail.payment.orderTerms}</p><p className="theme-muted">{t("orders.checkoutSession")}: {detail.payment.stripe.checkoutSession ?? "—"} · {t("orders.paymentIntent")}: {detail.payment.stripe.paymentIntent ?? "—"} · {t("orders.charge")}: {detail.payment.stripe.charge ?? "—"}</p></DetailBlock><DetailBlock title={t("orders.shipmentSummary")}>{detail.shipment ? <><p>{detail.shipment.incoterm} · {detail.shipment.shippingMethod} · {shipmentStatusLabel(detail.shipment.shipmentStatus, t)}</p><p>{detail.shipment.originCountry} → {detail.shipment.destinationCountry}</p><p>{detail.shipment.carrierName ?? t("orders.noCarrier")} · {t("orders.tracking")} {detail.shipment.trackingNumber ?? "—"}</p><p>{t("orders.shipDate")} {formatTradeDate(detail.shipment.shipDate, locale)} · {t("orders.delivered")} {formatTradeDate(detail.shipment.deliveredAt, locale)}</p></> : <p className="theme-muted">{t("orders.noShipment")}</p>}</DetailBlock><DetailBlock title={t("orders.payoutSummary")}>{detail.payout ? <><p>{detail.payout.payoutNumber} · {payoutStatusLabel(detail.payout.status, t)} · {detail.payout.currency.toUpperCase()}</p><p>{t("orders.baseSellerPayable")} {formatTradeMoney(detail.payout.sellerPayableAmount, detail.payout.currency, locale)} · {t("orders.refunds")} {formatTradeMoney(detail.payout.refundAdjustmentAmount, detail.payout.currency, locale)} · {t("orders.manualAdjustments")} {formatTradeMoney(detail.payout.manualAdjustmentAmount, detail.payout.currency, locale)} · {t("orders.final")} {formatTradeMoney(detail.payout.finalPayoutAmount, detail.payout.currency, locale)}</p><p>{detail.payout.bankNameSnapshot} · {detail.payout.accountNumberLast4 ? `•••• ${detail.payout.accountNumberLast4}` : t("orders.maskedAccountUnavailable")} · {detail.payout.swiftBicSnapshot ?? t("orders.noSwiftBic")}</p><p>{t("orders.sent")} {formatTradeDateTime(detail.payout.sentAt, locale)}</p></> : <p className="theme-muted">{t("orders.noPayoutPrepared")}</p>}</DetailBlock><DetailBlock title={t("orders.blockingPayoutReasons")}>{detail.blockingPayoutReasons.length ? <ul className="list-disc pl-5">{detail.blockingPayoutReasons.map((reason) => <li key={reason}>{reason}</li>)}</ul> : <p className="theme-success-text">{t("orders.noBlockingReason")}</p>}</DetailBlock><DetailBlock title={t("orders.timeline")}>{detail.timeline.length ? <ol className="grid gap-2">{detail.timeline.map((event) => <li key={event.id} className="rounded-md border p-3"><p className="font-medium">{tradeOrderEventLabel(event.type, t)}</p><p>{event.message ?? t("orders.noMessage")}</p><p className="text-xs theme-muted">{event.source} · {event.actor ?? t("orders.system")} · {formatTradeDateTime(event.createdAt, locale)}</p></li>)}</ol> : <p className="theme-muted">{t("orders.noTimelineEvents")}</p>}</DetailBlock></div></aside>; }
