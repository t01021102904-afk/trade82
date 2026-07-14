export type PayoutEligibility = { ready: true } | { ready: false; reasons: string[] };

export function sellerPayoutEligibility(input: {
  paymentStatus: string;
  orderPaymentStatus: string;
  orderStatus: string;
  orderPayoutStatus: string;
  refundAmount: number;
  hasActiveDispute: boolean;
  payoutProfileStatus: string | null;
  sellerPayableAmount: number;
  existingPayoutStatus: string | null;
}): PayoutEligibility {
  const reasons: string[] = [];
  if (input.paymentStatus !== "PAID") reasons.push("Payment is not paid.");
  if (input.orderPaymentStatus !== "PAID") reasons.push("Order payment status is not paid.");
  if (input.orderStatus === "CANCELLED") reasons.push("Order is cancelled.");
  if (input.orderPayoutStatus === "HOLD") reasons.push("Order payout is on hold.");
  if (input.refundAmount > 0) reasons.push("A refund requires manual reconciliation.");
  if (input.hasActiveDispute) reasons.push("An active dispute requires resolution.");
  if (input.payoutProfileStatus !== "VERIFIED") reasons.push("Seller payout profile is not verified.");
  if (input.sellerPayableAmount <= 0) reasons.push("Seller payable amount must be greater than zero.");
  if (input.existingPayoutStatus) reasons.push("A payout already exists for this order.");
  return reasons.length ? { ready: false, reasons } : { ready: true };
}
