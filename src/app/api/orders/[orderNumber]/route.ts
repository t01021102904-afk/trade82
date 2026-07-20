import { apiError } from "@/lib/api-response";
import { idParam, readJsonObject } from "@/lib/api-security";
import { requireCurrentAppUser } from "@/lib/current-app-user";
import { isAdminUser } from "@/lib/authz";
import { getDb } from "@/lib/db";
import { appendTradeOrderEvent } from "@/lib/trade-orders";
import { sendTradeOrderNotification } from "@/lib/trade-order-notifications";
import { isTradeOrderSystemEnabledForClerkUser } from "@/lib/trade-order-feature";

const noStore = { "Cache-Control": "no-store, no-cache, must-revalidate" };
const shipmentFields = new Set([
  "incoterm", "shippingMethod", "originCountry", "originCity", "destinationCountry", "destinationCity", "destinationAddress", "carrierName", "freightForwarderName", "trackingNumber", "billOfLadingNumber", "airWaybillNumber", "shipmentReference", "shipDate", "estimatedArrivalDate", "deliveredAt", "shipmentStatus", "notes",
]);

function nullableText(value: unknown, key: string, max = 600) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw new Error(`${key} must be text.`);
  const text = value.trim();
  if (text.length > max) throw new Error(`${key} is too long.`);
  return text || null;
}

function dateOrNull(value: unknown, key: string) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new Error(`${key} is invalid.`);
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error(`${key} is invalid.`);
  return date;
}

function requiredText(value: unknown, key: string, max = 600) {
  const result = nullableText(value, key, max);
  if (!result) throw new Error(`${key} is required.`);
  return result;
}

async function accessibleOrder(orderNumber: string, userId: string, admin: boolean) {
  return getDb().tradeOrder.findFirst({
    where: {
      orderNumber,
        ...(admin
          ? {}
          : {
              OR: [
                { buyerCompany: { ownerUserId: userId, deletedAt: null } },
                { sellerCompany: { ownerUserId: userId, deletedAt: null } },
              ],
            }),
    },
    include: {
      items: true,
      shipment: true,
      events: { orderBy: { createdAt: "asc" }, select: { id: true, eventType: true, message: true, metadata: true, createdAt: true } },
      paymentRequest: { select: { status: true, paymentDueDate: true, paidAt: true, refundAmount: true, currency: true } },
      payout: { select: { status: true, payoutNumber: true, finalPayoutAmount: true, sentAt: true } },
    },
  });
}

function buyerSafeOrder<T extends object>(order: T) {
  const safeOrder = { ...order } as Record<string, unknown>;
  for (const field of [
    "platformFeeRateBps",
    "platformFeeAmount",
    "sellerPayableAmount",
    "stripeProcessingFeeAmount",
    "payoutStatus",
    "payout",
  ]) {
    delete safeOrder[field];
  }
  return safeOrder;
}

export async function GET(_request: Request, { params }: { params: Promise<{ orderNumber: string }> }) {
  try {
    const user = await requireCurrentAppUser();
    if (!isTradeOrderSystemEnabledForClerkUser(user.clerkUserId)) return Response.json({ error: "Orders are not enabled for this account." }, { status: 403, headers: noStore });
    const orderNumber = idParam((await params).orderNumber, "orderNumber");
    const admin = await isAdminUser();
    const order = await accessibleOrder(orderNumber, user.id, admin);
    if (!order) return Response.json({ error: "Order not found." }, { status: 404, headers: noStore });
    const sellerCanEdit = await getDb().company.count({
      where: {
        id: order.sellerCompanyId,
        ownerUserId: user.id,
        companyRole: "seller",
        deletedAt: null,
      },
    });
    const canViewSellerFinancials = admin || sellerCanEdit > 0;
    return Response.json(
      {
        order: canViewSellerFinancials ? order : buyerSafeOrder(order),
        sellerCanEdit: sellerCanEdit > 0,
      },
      { headers: noStore },
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ orderNumber: string }> }) {
  try {
    const user = await requireCurrentAppUser();
    if (!isTradeOrderSystemEnabledForClerkUser(user.clerkUserId)) return Response.json({ error: "Orders are not enabled for this account." }, { status: 403, headers: noStore });
    const orderNumber = idParam((await params).orderNumber, "orderNumber");
    const order = await getDb().tradeOrder.findFirst({
      where: {
        orderNumber,
        sellerCompany: { ownerUserId: user.id, deletedAt: null },
      },
      select: { id: true, sellerCompanyId: true },
    });
    if (!order) return Response.json({ error: "Only the seller may update shipment information." }, { status: 403, headers: noStore });
    const body = await readJsonObject(request);
    if (Object.keys(body).some((key) => !shipmentFields.has(key))) return Response.json({ error: "Unexpected shipment field." }, { status: 400, headers: noStore });
    const shipmentStatus = nullableText(body.shipmentStatus, "shipmentStatus", 40);
    const shipment = await getDb().$transaction(async (tx) => {
      const updateData: import("@/generated/prisma/client").Prisma.TradeOrderShipmentUpdateInput = {
        ...(body.incoterm !== undefined ? { incoterm: requiredText(body.incoterm, "incoterm", 30) as never } : {}),
        ...(body.shippingMethod !== undefined ? { shippingMethod: requiredText(body.shippingMethod, "shippingMethod", 30) as never } : {}),
        ...(body.originCountry !== undefined ? { originCountry: requiredText(body.originCountry, "originCountry", 120) } : {}),
        ...(body.originCity !== undefined ? { originCity: nullableText(body.originCity, "originCity", 120) } : {}),
        ...(body.destinationCountry !== undefined ? { destinationCountry: requiredText(body.destinationCountry, "destinationCountry", 120) } : {}),
        ...(body.destinationCity !== undefined ? { destinationCity: nullableText(body.destinationCity, "destinationCity", 120) } : {}),
        ...(body.destinationAddress !== undefined ? { destinationAddress: nullableText(body.destinationAddress, "destinationAddress") } : {}),
        ...(body.carrierName !== undefined ? { carrierName: nullableText(body.carrierName, "carrierName", 240) } : {}),
        ...(body.freightForwarderName !== undefined ? { freightForwarderName: nullableText(body.freightForwarderName, "freightForwarderName", 240) } : {}),
        ...(body.trackingNumber !== undefined ? { trackingNumber: nullableText(body.trackingNumber, "trackingNumber", 240) } : {}),
        ...(body.billOfLadingNumber !== undefined ? { billOfLadingNumber: nullableText(body.billOfLadingNumber, "billOfLadingNumber", 240) } : {}),
        ...(body.airWaybillNumber !== undefined ? { airWaybillNumber: nullableText(body.airWaybillNumber, "airWaybillNumber", 240) } : {}),
        ...(body.shipmentReference !== undefined ? { shipmentReference: nullableText(body.shipmentReference, "shipmentReference", 240) } : {}),
        ...(body.shipDate !== undefined ? { shipDate: dateOrNull(body.shipDate, "shipDate") } : {}),
        ...(body.estimatedArrivalDate !== undefined ? { estimatedArrivalDate: dateOrNull(body.estimatedArrivalDate, "estimatedArrivalDate") } : {}),
        ...(body.deliveredAt !== undefined ? { deliveredAt: dateOrNull(body.deliveredAt, "deliveredAt") } : {}),
        ...(shipmentStatus ? { shipmentStatus: shipmentStatus as never } : {}),
        ...(body.notes !== undefined ? { notes: nullableText(body.notes, "notes", 3_000) } : {}),
      };
      const result = await tx.tradeOrderShipment.update({ where: { orderId: order.id }, data: updateData });
      await tx.tradeOrder.update({ where: { id: order.id }, data: shipmentStatus ? { shipmentStatus: shipmentStatus as never } : {} });
      await appendTradeOrderEvent(tx, { orderId: order.id, eventType: shipmentStatus === "SHIPPED" ? "SHIPPED" : shipmentStatus === "DELIVERED" ? "DELIVERED" : "SHIPMENT_UPDATED", actorUserId: user.id, message: "Seller updated shipment information." });
      return result;
    });
    try {
      await sendTradeOrderNotification({
        orderId: order.id,
        kind: "shipment_updated",
        recipient: "buyer",
        idempotencyKey: `trade82-order-shipment-${order.id}-${shipment.updatedAt.getTime()}`,
      });
    } catch {
      console.error("Trade order notification delivery failed.", { kind: "shipment_updated" });
    }
    return Response.json({ shipment }, { headers: noStore });
  } catch (error) {
    if (error instanceof Error) return Response.json({ error: error.message }, { status: 400, headers: noStore });
    return apiError(error);
  }
}
