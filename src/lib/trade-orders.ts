import "server-only";

import {
  OrderPaymentStatus,
  OrderPayoutStatus,
  PaymentRequestStatus,
  Prisma,
  TradeOrderEventType,
  TradeOrderStatus,
} from "@/generated/prisma/client";
import {
  assertUsdCurrency,
  calculateOrderFinancials,
  PLATFORM_FEE_BPS,
} from "@/lib/order-financials";
import {
  immutableCompanySnapshot,
} from "@/lib/trade-order-rules";
import {
  nextTradeOrderNumber,
} from "@/lib/order-number-counters";

type Tx = Prisma.TransactionClient;

type PaymentRequestForOrder = {
  id: string;
  inquiryId: string;
  buyerCompanyId: string;
  sellerCompanyId: string;
  productName: string;
  quantity: string;
  unit: string;
  productAmount: number;
  shippingAmount: number;
  grossAmount: number;
  platformFeeAmount: number;
  sellerPayableAmount: number;
  currency: string;
  refundAmount: number;
};

function wholeNumberUnitPrice(productAmount: number, quantity: string) {
  if (!/^\d+$/.test(quantity)) return null;
  const amount = Number(quantity);
  if (!Number.isSafeInteger(amount) || amount <= 0 || productAmount % amount !== 0) {
    return null;
  }
  return productAmount / amount;
}

export { formatSellerPayoutNumber, formatTradeOrderNumber } from "@/lib/trade-order-rules";

export { nextSellerPayoutNumber, nextTradeOrderNumber } from "@/lib/order-number-counters";

export async function appendTradeOrderEvent(
  tx: Tx,
  {
    orderId,
    eventType,
    actorUserId,
    message,
    metadata,
  }: {
    orderId: string;
    eventType: TradeOrderEventType;
    actorUserId?: string | null;
    message?: string;
    metadata?: Prisma.InputJsonValue;
  },
) {
  await tx.tradeOrderEvent.create({
    data: {
      orderId,
      eventType,
      ...(actorUserId ? { actorUserId } : {}),
      ...(message ? { message } : {}),
      ...(metadata ? { metadata } : {}),
    },
  });
}

// Called inside the payment-request creation transaction. The request is created
// first, then this required Order->PaymentRequest link and the nullable reverse
// PaymentRequest.orderId link are persisted before the transaction can commit.
export async function createTradeOrderForPaymentRequest(
  tx: Tx,
  paymentRequestId: string,
  now = new Date(),
) {
  const paymentRequest = await tx.paymentRequest.findUniqueOrThrow({
    where: { id: paymentRequestId },
    include: {
      inquiry: { include: { product: true } },
      buyerCompany: { include: { owner: true } },
      sellerCompany: { include: { owner: true } },
    },
  });

  const existing = await tx.tradeOrder.findUnique({ where: { paymentRequestId } });
  if (existing) return existing;

  assertUsdCurrency(paymentRequest.currency);
  const financials = calculateOrderFinancials(
    paymentRequest.productAmount,
    paymentRequest.shippingAmount,
  );
  if (
    paymentRequest.grossAmount !== financials.grossAmount ||
    paymentRequest.platformFeeAmount !== financials.platformFeeAmount ||
    paymentRequest.sellerPayableAmount !== financials.sellerPayableAmount
  ) {
    throw new Error("Payment request financials do not match the order calculation.");
  }

  const product = paymentRequest.inquiry.product;
  const buyerSnapshot = immutableCompanySnapshot(paymentRequest.buyerCompany);
  const sellerSnapshot = immutableCompanySnapshot(paymentRequest.sellerCompany);
  const order = await tx.tradeOrder.create({
    data: {
      orderNumber: await nextTradeOrderNumber(tx, now),
      inquiryId: paymentRequest.inquiryId,
      paymentRequestId: paymentRequest.id,
      buyerCompanyId: paymentRequest.buyerCompanyId,
      sellerCompanyId: paymentRequest.sellerCompanyId,
      buyerCompanyName: buyerSnapshot.companyName,
      buyerContactName: buyerSnapshot.contactName,
      buyerEmail: buyerSnapshot.email,
      buyerPhone: buyerSnapshot.phone,
      buyerCountry: buyerSnapshot.country,
      buyerAddress: buyerSnapshot.address,
      sellerCompanyName: sellerSnapshot.companyName,
      sellerContactName: sellerSnapshot.contactName,
      sellerEmail: sellerSnapshot.email,
      sellerPhone: sellerSnapshot.phone,
      sellerCountry: sellerSnapshot.country,
      sellerAddress: sellerSnapshot.address,
      productAmount: financials.grossAmount - paymentRequest.shippingAmount,
      shippingAmount: paymentRequest.shippingAmount,
      grossAmount: financials.grossAmount,
      platformFeeRateBps: PLATFORM_FEE_BPS,
      platformFeeAmount: financials.platformFeeAmount,
      sellerPayableAmount: financials.sellerPayableAmount,
      currency: paymentRequest.currency.toLowerCase(),
      items: {
        create: {
          productId: product?.id,
          productName: paymentRequest.productName,
          sku: product?.slug ?? null,
          hsCode: product?.hsCode || null,
          countryOfOrigin: product?.countryOfOrigin || null,
          quantity: paymentRequest.quantity,
          unit: paymentRequest.unit,
          unitPrice: wholeNumberUnitPrice(paymentRequest.productAmount, paymentRequest.quantity),
          productAmount: paymentRequest.productAmount,
          currency: paymentRequest.currency.toLowerCase(),
          productSnapshot: product
            ? {
                name: product.name,
                category: product.category,
                imageUrl: product.imageUrl,
                tags: product.tags,
                countryOfOrigin: product.countryOfOrigin,
              }
            : undefined,
        },
      },
      shipment: {
        create: {
          originCountry: product?.shippingOriginCountry || paymentRequest.sellerCompany.country,
          originCity: paymentRequest.sellerCompany.city || null,
          destinationCountry: paymentRequest.buyerCompany.country,
          destinationCity: paymentRequest.buyerCompany.city || null,
          destinationAddress: paymentRequest.buyerCompany.businessAddress || null,
        },
      },
    },
  });

  await tx.paymentRequest.update({ where: { id: paymentRequest.id }, data: { orderId: order.id } });
  await appendTradeOrderEvent(tx, {
    orderId: order.id,
    eventType: TradeOrderEventType.ORDER_CREATED,
    actorUserId: paymentRequest.createdByUserId,
    message: "Order created with the payment request.",
  });
  await appendTradeOrderEvent(tx, {
    orderId: order.id,
    eventType: TradeOrderEventType.PAYMENT_REQUESTED,
    actorUserId: paymentRequest.createdByUserId,
    message: "Seller requested payment.",
  });

  return order;
}

export async function syncTradeOrderFromPaymentRequest(
  tx: Tx,
  paymentRequest: Pick<PaymentRequestForOrder, "id" | "grossAmount" | "refundAmount"> & {
    status: PaymentRequestStatus;
    paidAt?: Date | null;
    stripeProcessingFeeAmount?: number | null;
  },
  eventSource: "paid" | "refund" | "dispute" | "cancelled",
) {
  const order = await tx.tradeOrder.findUnique({
    where: { paymentRequestId: paymentRequest.id },
    select: { id: true, payoutStatus: true, payout: { select: { status: true } } },
  });
  if (!order) return null;

  let data: Prisma.TradeOrderUpdateInput;
  let eventType: TradeOrderEventType;
  let message: string;
  const requiresManualReconciliation =
    order.payout?.status === "SENT" &&
    (paymentRequest.status === PaymentRequestStatus.PARTIALLY_REFUNDED ||
      paymentRequest.status === PaymentRequestStatus.REFUNDED ||
      paymentRequest.status === PaymentRequestStatus.DISPUTED);

  switch (paymentRequest.status) {
    case PaymentRequestStatus.PAID:
      data = {
        paymentStatus: OrderPaymentStatus.PAID,
        orderStatus: TradeOrderStatus.PAID,
        paidAt: paymentRequest.paidAt ?? new Date(),
        ...(paymentRequest.stripeProcessingFeeAmount !== undefined
          ? { stripeProcessingFeeAmount: paymentRequest.stripeProcessingFeeAmount }
          : {}),
      };
      eventType = TradeOrderEventType.PAYMENT_PAID;
      message = "Payment confirmed by Stripe.";
      break;
    case PaymentRequestStatus.PARTIALLY_REFUNDED:
      data = {
        paymentStatus: OrderPaymentStatus.PARTIALLY_REFUNDED,
        payoutStatus: OrderPayoutStatus.HOLD,
        refundAmount: paymentRequest.refundAmount,
      };
      eventType = TradeOrderEventType.REFUND_COMPLETED;
      message = requiresManualReconciliation
        ? "A partial refund requires manual reconciliation of an external payout already recorded as sent."
        : "A partial refund placed the payout on hold.";
      break;
    case PaymentRequestStatus.REFUNDED:
      data = {
        paymentStatus: OrderPaymentStatus.REFUNDED,
        orderStatus: TradeOrderStatus.REFUNDED,
        payoutStatus: order.payout?.status === "SENT" ? OrderPayoutStatus.HOLD : OrderPayoutStatus.CANCELLED,
        refundAmount: paymentRequest.refundAmount,
        refundedAt: new Date(),
      };
      eventType = TradeOrderEventType.REFUND_COMPLETED;
      message = requiresManualReconciliation
        ? "A full refund requires manual reconciliation of an external payout already recorded as sent."
        : "A full refund updated the order.";
      break;
    case PaymentRequestStatus.DISPUTED:
      data = {
        paymentStatus: OrderPaymentStatus.DISPUTED,
        orderStatus: TradeOrderStatus.DISPUTED,
        payoutStatus: OrderPayoutStatus.HOLD,
        disputedAt: new Date(),
      };
      eventType = TradeOrderEventType.DISPUTE_OPENED;
      message = requiresManualReconciliation
        ? "A payment dispute requires manual reconciliation of an external payout already recorded as sent."
        : "A payment dispute placed the payout on hold.";
      break;
    case PaymentRequestStatus.CANCELLED:
      data = {
        paymentStatus: OrderPaymentStatus.FAILED,
        orderStatus: TradeOrderStatus.CANCELLED,
        payoutStatus: OrderPayoutStatus.CANCELLED,
      };
      eventType = TradeOrderEventType.ORDER_CANCELLED;
      message = "The payment request was cancelled.";
      break;
    default:
      return null;
  }

  await tx.tradeOrder.update({ where: { id: order.id }, data });
  if (
    paymentRequest.status === PaymentRequestStatus.PARTIALLY_REFUNDED ||
    paymentRequest.status === PaymentRequestStatus.REFUNDED ||
    paymentRequest.status === PaymentRequestStatus.DISPUTED
  ) {
    await tx.sellerPayout.updateMany({
      where: { orderId: order.id, status: { in: ["READY", "PROCESSING"] } },
      data: { status: "HOLD" },
    });
  }
  await appendTradeOrderEvent(tx, {
    orderId: order.id,
    eventType,
    message,
    metadata: { source: eventSource, ...(requiresManualReconciliation ? { reconciliationRequired: true } : {}) },
  });
  return order.id;
}
