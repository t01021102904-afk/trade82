import type { Locale } from "@/lib/i18n";

type Translate = (key: string, fallback?: string) => string;

const statusKeys = {
  paymentRequest: {
    PENDING: "payments.paymentPending",
    PAID: "payments.paymentPaid",
    RELEASED: "payments.paymentReleased",
    CANCELLED: "payments.paymentCancelled",
    PARTIALLY_REFUNDED: "payments.paymentPartiallyRefunded",
    REFUNDED: "payments.paymentRefunded",
    DISPUTED: "payments.paymentDisputed",
  },
  order: {
    PAYMENT_PENDING: "orders.status.order.PAYMENT_PENDING",
    PAID: "orders.status.order.PAID",
    PROCESSING: "orders.status.order.PROCESSING",
    READY_TO_SHIP: "orders.status.order.READY_TO_SHIP",
    SHIPPED: "orders.status.order.SHIPPED",
    DELIVERED: "orders.status.order.DELIVERED",
    COMPLETED: "orders.status.order.COMPLETED",
    CANCELLED: "orders.status.order.CANCELLED",
    REFUNDED: "orders.status.order.REFUNDED",
    DISPUTED: "orders.status.order.DISPUTED",
  },
  orderPayment: {
    UNPAID: "orders.status.payment.UNPAID",
    PENDING: "orders.status.payment.PENDING",
    PAID: "orders.status.payment.PAID",
    PARTIALLY_REFUNDED: "orders.status.payment.PARTIALLY_REFUNDED",
    REFUNDED: "orders.status.payment.REFUNDED",
    FAILED: "orders.status.payment.FAILED",
    DISPUTED: "orders.status.payment.DISPUTED",
  },
  shipment: {
    NOT_READY: "orders.status.shipment.NOT_READY",
    READY: "orders.status.shipment.READY",
    BOOKED: "orders.status.shipment.BOOKED",
    SHIPPED: "orders.status.shipment.SHIPPED",
    IN_TRANSIT: "orders.status.shipment.IN_TRANSIT",
    DELIVERED: "orders.status.shipment.DELIVERED",
    EXCEPTION: "orders.status.shipment.EXCEPTION",
    CANCELLED: "orders.status.shipment.CANCELLED",
  },
  payout: {
    NOT_READY: "payouts.status.NOT_READY",
    HOLD: "payouts.status.HOLD",
    READY: "payouts.status.READY",
    PROCESSING: "payouts.status.PROCESSING",
    SENT: "payouts.status.SENT",
    FAILED: "payouts.status.FAILED",
    RETURNED: "payouts.status.RETURNED",
    CANCELLED: "payouts.status.CANCELLED",
  },
  profile: {
    DRAFT: "payouts.profileStatus.DRAFT",
    PENDING_VERIFICATION: "payouts.profileStatus.PENDING_VERIFICATION",
    VERIFIED: "payouts.profileStatus.VERIFIED",
    REJECTED: "payouts.profileStatus.REJECTED",
    DISABLED: "payouts.profileStatus.DISABLED",
  },
  adjustment: {
    CREDIT: "payouts.adjustmentType.CREDIT",
    DEBIT: "payouts.adjustmentType.DEBIT",
    REFUND_RECOVERY: "payouts.adjustmentType.REFUND_RECOVERY",
    BANK_FEE: "payouts.adjustmentType.BANK_FEE",
    FX_ADJUSTMENT: "payouts.adjustmentType.FX_ADJUSTMENT",
    OTHER: "payouts.adjustmentType.OTHER",
  },
  stripeFee: {
    PENDING: "payments.stripeFeeStatus.PENDING",
    SYNCED: "payments.stripeFeeStatus.SYNCED",
    FAILED: "payments.stripeFeeStatus.FAILED",
  },
  dispute: {
    needs_response: "payments.disputeStatus.needs_response",
    under_review: "payments.disputeStatus.under_review",
    won: "payments.disputeStatus.won",
    lost: "payments.disputeStatus.lost",
    prevented: "payments.disputeStatus.prevented",
    warning_closed: "payments.disputeStatus.warning_closed",
    charge_refunded: "payments.disputeStatus.charge_refunded",
  },
  orderEvent: {
    ORDER_CREATED: "orders.event.ORDER_CREATED",
    PAYMENT_REQUESTED: "orders.event.PAYMENT_REQUESTED",
    CHECKOUT_STARTED: "orders.event.CHECKOUT_STARTED",
    PAYMENT_PAID: "orders.event.PAYMENT_PAID",
    PAYMENT_FAILED: "orders.event.PAYMENT_FAILED",
    REFUND_CREATED: "orders.event.REFUND_CREATED",
    REFUND_COMPLETED: "orders.event.REFUND_COMPLETED",
    DISPUTE_OPENED: "orders.event.DISPUTE_OPENED",
    DISPUTE_CLOSED: "orders.event.DISPUTE_CLOSED",
    PROCESSING_STARTED: "orders.event.PROCESSING_STARTED",
    SHIPMENT_UPDATED: "orders.event.SHIPMENT_UPDATED",
    SHIPPED: "orders.event.SHIPPED",
    DELIVERED: "orders.event.DELIVERED",
    PAYOUT_HOLD: "orders.event.PAYOUT_HOLD",
    PAYOUT_READY: "orders.event.PAYOUT_READY",
    PAYOUT_PROCESSING: "orders.event.PAYOUT_PROCESSING",
    PAYOUT_SENT: "orders.event.PAYOUT_SENT",
    PAYOUT_FAILED: "orders.event.PAYOUT_FAILED",
    ORDER_CANCELLED: "orders.event.ORDER_CANCELLED",
    ORDER_COMPLETED: "orders.event.ORDER_COMPLETED",
    ADMIN_NOTE: "orders.event.ADMIN_NOTE",
  },
} as const;

function readableStatus(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function localizeStatus(
  status: string,
  group: Record<string, string>,
  t: Translate,
) {
  return t(group[status] ?? "", readableStatus(status));
}

export function paymentRequestStatusLabel(status: string, t: Translate) {
  return localizeStatus(status, statusKeys.paymentRequest, t);
}

export function tradeOrderStatusLabel(status: string, t: Translate) {
  return localizeStatus(status, statusKeys.order, t);
}

export function orderPaymentStatusLabel(status: string, t: Translate) {
  return localizeStatus(status, statusKeys.orderPayment, t);
}

export function shipmentStatusLabel(status: string, t: Translate) {
  return localizeStatus(status, statusKeys.shipment, t);
}

export function payoutStatusLabel(status: string, t: Translate) {
  return localizeStatus(status, statusKeys.payout, t);
}

export function payoutProfileStatusLabel(status: string, t: Translate) {
  return localizeStatus(status, statusKeys.profile, t);
}

export function payoutAdjustmentTypeLabel(status: string, t: Translate) {
  return localizeStatus(status, statusKeys.adjustment, t);
}

export function stripeFeeSyncStatusLabel(status: string, t: Translate) {
  return localizeStatus(status, statusKeys.stripeFee, t);
}

export function paymentDisputeStatusLabel(status: string, t: Translate) {
  return localizeStatus(status, statusKeys.dispute, t);
}

export function tradeOrderEventLabel(status: string, t: Translate) {
  return localizeStatus(status, statusKeys.orderEvent, t);
}

export function formatTradeMoney(amount: number, currency: string, locale: Locale) {
  return new Intl.NumberFormat(locale === "ko" ? "ko-KR" : "en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

export function formatTradeDate(value: string | null | undefined, locale: Locale) {
  return value
    ? new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US").format(new Date(value))
    : "—";
}

export function formatTradeDateTime(value: string | null | undefined, locale: Locale) {
  return value
    ? new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "—";
}
