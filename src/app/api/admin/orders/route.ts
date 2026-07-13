import { Prisma } from "@/generated/prisma/client";
import { apiError } from "@/lib/api-response";
import {
  adminOrderSortDirection,
  adminOrderSortField,
  currencyTotals,
  maskStripeIdentifier,
} from "@/lib/admin-order-table";
import { requireAdmin } from "@/lib/authz";
import { csvCell } from "@/lib/csv-security";
import { getDb } from "@/lib/db";
import { isManualPayoutSystemEnabledForClerkUser } from "@/lib/trade-order-feature";

const noStore = { "Cache-Control": "no-store, no-cache, must-revalidate" };

const enumValues = {
  orderStatus: ["PAYMENT_PENDING", "PAID", "PROCESSING", "READY_TO_SHIP", "SHIPPED", "DELIVERED", "COMPLETED", "CANCELLED", "REFUNDED", "DISPUTED"],
  paymentStatus: ["UNPAID", "PENDING", "PAID", "PARTIALLY_REFUNDED", "REFUNDED", "FAILED", "DISPUTED"],
  shipmentStatus: ["NOT_READY", "READY", "BOOKED", "SHIPPED", "IN_TRANSIT", "DELIVERED", "EXCEPTION", "CANCELLED"],
  payoutStatus: ["NOT_READY", "HOLD", "READY", "PROCESSING", "SENT", "FAILED", "RETURNED", "CANCELLED"],
} as const;

function pageParam(value: string | null) {
  const number = Number(value ?? "1");
  return Number.isInteger(number) && number > 0 ? number : 1;
}

function pageSizeParam(value: string | null) {
  const number = Number(value ?? "50");
  return Number.isInteger(number) ? Math.min(Math.max(number, 10), 100) : 50;
}

function optionalText(value: string | null, maxLength = 160) {
  const output = value?.trim();
  if (!output) return undefined;
  if (output.length > maxLength) throw new Error("A filter value is too long.");
  return output;
}

function enumFilter<T extends readonly string[]>(value: string | null, allowed: T, label: string) {
  const output = optionalText(value, 64);
  if (!output) return undefined;
  if (!(allowed as readonly string[]).includes(output)) throw new Error(`${label} filter is invalid.`);
  return output as T[number];
}

function dateStart(value: string | null, label: string) {
  if (!value) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${label} must use YYYY-MM-DD.`);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new Error(`${label} is invalid.`);
  return date;
}

function addOneUtcDay(value: Date) {
  const result = new Date(value);
  result.setUTCDate(result.getUTCDate() + 1);
  return result;
}

function orderWhere(url: URL): Prisma.TradeOrderWhereInput {
  const id = optionalText(url.searchParams.get("id"), 128);
  const search = optionalText(url.searchParams.get("search"));
  const orderStatus = enumFilter(url.searchParams.get("orderStatus"), enumValues.orderStatus, "order status");
  const paymentStatus = enumFilter(url.searchParams.get("paymentStatus"), enumValues.paymentStatus, "payment status");
  const shipmentStatus = enumFilter(url.searchParams.get("shipmentStatus"), enumValues.shipmentStatus, "shipment status");
  const payoutStatus = enumFilter(url.searchParams.get("payoutStatus"), enumValues.payoutStatus, "payout status");
  const buyerCountry = optionalText(url.searchParams.get("buyerCountry"), 120);
  const sellerCountry = optionalText(url.searchParams.get("sellerCountry"), 120);
  const originCountry = optionalText(url.searchParams.get("originCountry"), 120);
  const destinationCountry = optionalText(url.searchParams.get("destinationCountry"), 120);
  const currency = optionalText(url.searchParams.get("currency"), 12)?.toLowerCase();
  if (currency && !/^[a-z]{3}$/.test(currency)) throw new Error("Currency filter is invalid.");
  const from = dateStart(url.searchParams.get("dateFrom"), "dateFrom");
  const to = dateStart(url.searchParams.get("dateTo"), "dateTo");
  if (from && to && from > to) throw new Error("dateFrom cannot be after dateTo.");

  const clauses: Prisma.TradeOrderWhereInput[] = [];
  if (id) clauses.push({ id });
  if (orderStatus) clauses.push({ orderStatus });
  if (paymentStatus) clauses.push({ paymentStatus });
  if (shipmentStatus) clauses.push({ shipmentStatus });
  if (payoutStatus) clauses.push({ payoutStatus });
  if (buyerCountry) clauses.push({ buyerCountry });
  if (sellerCountry) clauses.push({ sellerCountry });
  if (currency) clauses.push({ currency });
  if (originCountry) clauses.push({ shipment: { is: { originCountry } } });
  if (destinationCountry) clauses.push({ shipment: { is: { destinationCountry } } });
  if (from || to) clauses.push({ createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: addOneUtcDay(to) } : {}) } });
  if (search) {
    clauses.push({
      OR: [
        { orderNumber: { contains: search, mode: "insensitive" } },
        { buyerCompanyName: { contains: search, mode: "insensitive" } },
        { sellerCompanyName: { contains: search, mode: "insensitive" } },
        { buyerEmail: { contains: search, mode: "insensitive" } },
        { sellerEmail: { contains: search, mode: "insensitive" } },
        { items: { some: { productName: { contains: search, mode: "insensitive" } } } },
        { shipment: { is: { trackingNumber: { contains: search, mode: "insensitive" } } } },
        { payout: { is: { externalTransferReference: { contains: search, mode: "insensitive" } } } },
      ],
    });
  }
  return clauses.length ? { AND: clauses } : {};
}

const orderInclude = {
  items: { orderBy: { createdAt: "asc" } },
  shipment: true,
  paymentRequest: {
    select: {
      status: true,
      paymentDueDate: true,
      orderTerms: true,
      refundAmount: true,
      stripeProcessingFeeAmount: true,
      stripeCheckoutSessionId: true,
      stripePaymentIntentId: true,
      stripeChargeId: true,
      requiresManualReconciliation: true,
      reconciliationNote: true,
    },
  },
  payout: {
    select: {
      id: true,
      payoutNumber: true,
      status: true,
      currency: true,
      sellerPayableAmount: true,
      refundAdjustmentAmount: true,
      manualAdjustmentAmount: true,
      finalPayoutAmount: true,
      processingFeeAmount: true,
      bankNameSnapshot: true,
      accountNumberLast4: true,
      swiftBicSnapshot: true,
      settlementCurrency: true,
      sentAt: true,
      externalTransferReference: true,
      failureReason: true,
      events: { orderBy: { createdAt: "asc" }, select: { id: true, eventType: true, message: true, createdAt: true, actorUser: { select: { displayName: true } } } },
    },
  },
  events: { orderBy: { createdAt: "asc" }, select: { id: true, eventType: true, message: true, createdAt: true, actorUser: { select: { displayName: true } } } },
} satisfies Prisma.TradeOrderInclude;

type AdminOrder = Prisma.TradeOrderGetPayload<{ include: typeof orderInclude }>;

function orderResponse(order: AdminOrder, includeDetail = false) {
  const payout = order.payout;
  const base = {
    id: order.id,
    orderNumber: order.orderNumber,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    orderStatus: order.orderStatus,
    paymentStatus: order.paymentStatus,
    shipmentStatus: order.shipmentStatus,
    payoutStatus: order.payoutStatus,
    buyerCompanyName: order.buyerCompanyName,
    buyerContactName: order.buyerContactName,
    buyerEmail: order.buyerEmail,
    buyerCountry: order.buyerCountry,
    sellerCompanyName: order.sellerCompanyName,
    sellerContactName: order.sellerContactName,
    sellerEmail: order.sellerEmail,
    sellerCountry: order.sellerCountry,
    grossAmount: order.grossAmount,
    platformFeeAmount: order.platformFeeAmount,
    sellerPayableAmount: order.sellerPayableAmount,
    currency: order.currency,
    paidAt: order.paidAt,
    items: order.items.map((item) => ({
      id: item.id,
      productName: item.productName,
      quantity: item.quantity,
      unit: item.unit,
      sku: item.sku,
      hsCode: item.hsCode,
      countryOfOrigin: item.countryOfOrigin,
      productAmount: item.productAmount,
      unitPrice: item.unitPrice,
      currency: item.currency,
    })),
    shipment: order.shipment ? {
      incoterm: order.shipment.incoterm,
      shippingMethod: order.shipment.shippingMethod,
      originCountry: order.shipment.originCountry,
      originCity: order.shipment.originCity,
      destinationCountry: order.shipment.destinationCountry,
      destinationCity: order.shipment.destinationCity,
      carrierName: order.shipment.carrierName,
      trackingNumber: order.shipment.trackingNumber,
      shipDate: order.shipment.shipDate,
      deliveredAt: order.shipment.deliveredAt,
      shipmentStatus: order.shipment.shipmentStatus,
    } : null,
    payout: payout ? {
      id: payout.id,
      payoutNumber: payout.payoutNumber,
      status: payout.status,
      currency: payout.currency,
      sellerPayableAmount: payout.sellerPayableAmount,
      refundAdjustmentAmount: payout.refundAdjustmentAmount,
      manualAdjustmentAmount: payout.manualAdjustmentAmount,
      finalPayoutAmount: payout.finalPayoutAmount,
      processingFeeAmount: payout.processingFeeAmount,
      bankNameSnapshot: payout.bankNameSnapshot,
      accountNumberLast4: payout.accountNumberLast4,
      swiftBicSnapshot: payout.swiftBicSnapshot,
      settlementCurrency: payout.settlementCurrency,
      sentAt: payout.sentAt,
      failureReason: payout.failureReason,
    } : null,
  };
  if (!includeDetail) return base;

  const timeline = [
    ...order.events.map((event) => ({ id: `order-${event.id}`, source: "order", type: event.eventType, message: event.message, actor: event.actorUser?.displayName ?? null, createdAt: event.createdAt })),
    ...(payout?.events.map((event) => ({ id: `payout-${event.id}`, source: "payout", type: event.eventType, message: event.message, actor: event.actorUser?.displayName ?? null, createdAt: event.createdAt })) ?? []),
  ].sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
  const blockingPayoutReasons = [
    ...(order.paymentStatus !== "PAID" ? ["Payment is not settled."] : []),
    ...(order.paymentRequest.refundAmount > 0 ? ["A refund adjustment exists."] : []),
    ...(order.paymentRequest.requiresManualReconciliation ? ["Payment requires manual reconciliation."] : []),
    ...(payout?.status === "HOLD" ? ["Payout is on hold."] : []),
    ...(payout?.failureReason ? ["Payout has a recorded failure reason."] : []),
  ];
  return {
    ...base,
    buyer: { companyName: order.buyerCompanyName, contactName: order.buyerContactName, email: order.buyerEmail, phone: order.buyerPhone, country: order.buyerCountry, address: order.buyerAddress },
    seller: { companyName: order.sellerCompanyName, contactName: order.sellerContactName, email: order.sellerEmail, phone: order.sellerPhone, country: order.sellerCountry, address: order.sellerAddress },
    payment: {
      status: order.paymentRequest.status,
      dueDate: order.paymentRequest.paymentDueDate,
      orderTerms: order.paymentRequest.orderTerms,
      refundAmount: order.paymentRequest.refundAmount,
      stripeProcessingFeeAmount: order.paymentRequest.stripeProcessingFeeAmount,
      stripe: {
        checkoutSession: maskStripeIdentifier(order.paymentRequest.stripeCheckoutSessionId, "cs"),
        paymentIntent: maskStripeIdentifier(order.paymentRequest.stripePaymentIntentId, "pi"),
        charge: maskStripeIdentifier(order.paymentRequest.stripeChargeId, "ch"),
      },
    },
    timeline,
    blockingPayoutReasons,
  };
}

function csvRows(orders: AdminOrder[]) {
  const header = ["Order Number", "Created Date", "Order Status", "Payment Status", "Shipment Status", "Payout Status", "Buyer Company", "Buyer Contact", "Buyer Country", "Seller Company", "Seller Contact", "Seller Country", "Product", "Quantity", "Gross Amount", "Trade82 Fee", "Seller Payable", "Currency", "Bank Name", "Masked Account", "SWIFT/BIC", "Payout Currency", "Incoterm", "Shipping Method", "Origin Country", "Destination Country", "Carrier", "Tracking Number", "Ship Date", "Paid Date", "Payout Sent Date", "Last Updated"];
  const rows = orders.map((order) => {
    const item = order.items[0];
    const payout = order.payout;
    return [order.orderNumber, order.createdAt.toISOString(), order.orderStatus, order.paymentStatus, order.shipmentStatus, order.payoutStatus, order.buyerCompanyName, order.buyerContactName, order.buyerCountry, order.sellerCompanyName, order.sellerContactName, order.sellerCountry, item?.productName, item ? `${item.quantity} ${item.unit}` : "", order.grossAmount, order.platformFeeAmount, order.sellerPayableAmount, order.currency, payout?.bankNameSnapshot, payout?.accountNumberLast4 ? `•••• ${payout.accountNumberLast4}` : "", payout?.swiftBicSnapshot, payout?.settlementCurrency, order.shipment?.incoterm, order.shipment?.shippingMethod, order.shipment?.originCountry, order.shipment?.destinationCountry, order.shipment?.carrierName, order.shipment?.trackingNumber, order.shipment?.shipDate?.toISOString(), order.paidAt?.toISOString(), payout?.sentAt?.toISOString(), order.updatedAt.toISOString()];
  });
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

export async function GET(request: Request) {
  try {
    const user = await requireAdmin();
    if (!isManualPayoutSystemEnabledForClerkUser(user.clerkUserId)) {
      return Response.json({ error: "Manual payouts are not enabled for this account." }, { status: 403, headers: noStore });
    }
    const url = new URL(request.url);
    const where = orderWhere(url);
    const db = getDb();
    const detail = url.searchParams.get("detail") === "1";
    const id = optionalText(url.searchParams.get("id"), 128);
    if (detail) {
      if (!id) return Response.json({ error: "An order id is required for detail." }, { status: 400, headers: noStore });
      const order = await db.tradeOrder.findFirst({ where, include: orderInclude });
      if (!order) return Response.json({ error: "Order was not found." }, { status: 404, headers: noStore });
      return Response.json({ detail: orderResponse(order, true) }, { headers: noStore });
    }

    const page = pageParam(url.searchParams.get("page"));
    const pageSize = pageSizeParam(url.searchParams.get("pageSize"));
    const sortField = adminOrderSortField(url.searchParams.get("sort"));
    const sortDirection = adminOrderSortDirection(url.searchParams.get("direction"));
    const [total, orders, groupedTotals, sentPayouts, payoutsOnHold] = await Promise.all([
      db.tradeOrder.count({ where }),
      db.tradeOrder.findMany({ where, orderBy: { [sortField]: sortDirection }, skip: (page - 1) * pageSize, take: pageSize, include: orderInclude }),
      db.tradeOrder.groupBy({ by: ["currency"], where, _sum: { grossAmount: true, platformFeeAmount: true, sellerPayableAmount: true } }),
      db.sellerPayout.groupBy({ by: ["currency"], where: { status: "SENT", order: { is: where } }, _sum: { finalPayoutAmount: true } }),
      db.sellerPayout.count({ where: { status: "HOLD", order: { is: where } } }),
    ]);

    if (url.searchParams.get("format") === "csv") {
      const allOrders = await db.tradeOrder.findMany({ where, orderBy: { [sortField]: sortDirection }, include: orderInclude });
      if (allOrders.length) {
        await db.tradeOrderEvent.createMany({
          data: allOrders.map((order) => ({ orderId: order.id, actorUserId: user.id, eventType: "ADMIN_NOTE", message: "Admin exported masked order CSV data.", metadata: { export: "masked_order_csv" } })),
        });
      }
      return new Response(`\uFEFF${csvRows(allOrders)}`, { headers: { ...noStore, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=trade82-orders.csv" } });
    }

    const perCurrency = currencyTotals(groupedTotals.map((row) => ({
      currency: row.currency,
      grossAmount: row._sum.grossAmount ?? 0,
      platformFeeAmount: row._sum.platformFeeAmount ?? 0,
      sellerPayableAmount: row._sum.sellerPayableAmount ?? 0,
    })));
    const sentPayoutsByCurrency = Object.fromEntries(sentPayouts.map((row) => [row.currency.toLowerCase(), row._sum.finalPayoutAmount ?? 0]));
    return Response.json({
      orders: orders.map((order) => orderResponse(order)),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      sort: sortField,
      direction: sortDirection,
      summary: { orderCount: total, currencies: perCurrency, sentPayoutsByCurrency, payoutsOnHold },
    }, { headers: noStore });
  } catch (error) {
    if (error instanceof Error) return Response.json({ error: error.message }, { status: 400, headers: noStore });
    return apiError(error);
  }
}
