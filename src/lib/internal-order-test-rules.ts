import { calculateOrderFinancials } from "@/lib/order-financials";

export const INTERNAL_ORDER_TEST_LABEL = "INTERNAL_PRODUCTION_TEST";

export const INTERNAL_ORDER_TEST_STATUSES = [
  "CREATED",
  "SIMULATED_PAID",
  "SIMULATED_PARTIALLY_REFUNDED",
  "SIMULATED_REFUNDED",
  "CANCELLED",
] as const;

export type InternalOrderTestStatusValue = (typeof INTERNAL_ORDER_TEST_STATUSES)[number];

export class InternalOrderTestError extends Error {
  readonly status: number;

  constructor(message: string, status = 409) {
    super(message);
    this.status = status;
  }
}

function assertMinorUnits(value: number, label: string, minimum: number) {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new InternalOrderTestError(`${label} must be an integer minor-unit amount.`, 400);
  }
}

export function calculateInternalOrderTestFinancials(productAmount: number, shippingAmount: number) {
  const financials = calculateOrderFinancials(productAmount, shippingAmount);
  return { ...financials, currency: "usd" as const };
}

export function eligibleInternalOrderTestPayout(
  sellerPayableAmount: number,
  simulatedRefundAmount: number,
) {
  assertMinorUnits(sellerPayableAmount, "Seller payable amount", 0);
  assertMinorUnits(simulatedRefundAmount, "Simulated refund amount", 0);
  return Math.max(0, sellerPayableAmount - simulatedRefundAmount);
}

export function assertCanSimulatePayment(
  status: InternalOrderTestStatusValue,
  payoutPreviewGeneratedAt: Date | null,
) {
  if (status !== "CREATED" || payoutPreviewGeneratedAt) {
    throw new InternalOrderTestError("This test order cannot be marked as simulated paid.");
  }
}

export function assertCanSimulateRefund(
  status: InternalOrderTestStatusValue,
  simulatedPaidAmount: number,
  refundAmount: number,
  payoutPreviewGeneratedAt: Date | null,
) {
  if (status !== "SIMULATED_PAID" || payoutPreviewGeneratedAt) {
    throw new InternalOrderTestError("This test order cannot accept a simulated refund.");
  }
  assertMinorUnits(simulatedPaidAmount, "Simulated paid amount", 1);
  assertMinorUnits(refundAmount, "Simulated refund amount", 1);
  if (refundAmount > simulatedPaidAmount) {
    throw new InternalOrderTestError("A simulated refund cannot exceed the simulated paid amount.", 400);
  }
}

export function refundStatusForInternalOrderTest(
  simulatedPaidAmount: number,
  refundAmount: number,
): InternalOrderTestStatusValue {
  if (refundAmount === simulatedPaidAmount) return "SIMULATED_REFUNDED";
  return "SIMULATED_PARTIALLY_REFUNDED";
}

export function assertCanGenerateInternalOrderTestPayoutPreview(input: {
  status: InternalOrderTestStatusValue;
  simulatedPaidAmount: number;
  sellerPayableAmount: number;
  simulatedRefundAmount: number;
}) {
  if (!["SIMULATED_PAID", "SIMULATED_PARTIALLY_REFUNDED"].includes(input.status)) {
    throw new InternalOrderTestError("A payout preview requires a simulated paid test order.");
  }
  assertMinorUnits(input.simulatedPaidAmount, "Simulated paid amount", 1);
  const eligibleAmount = eligibleInternalOrderTestPayout(
    input.sellerPayableAmount,
    input.simulatedRefundAmount,
  );
  if (eligibleAmount <= 0) {
    throw new InternalOrderTestError("This test order has no eligible seller proceeds for a payout preview.");
  }
  return eligibleAmount;
}

export function assertCanCancelInternalOrderTest(status: InternalOrderTestStatusValue) {
  if (status !== "CREATED") {
    throw new InternalOrderTestError("Only an unstarted test order can be cancelled.");
  }
}

export function assertInternalOrderTestNeverExecutesFinancialOperation(run: {
  isInternalTest: boolean;
  testLabel: string;
}) {
  if (run.isInternalTest && run.testLabel === INTERNAL_ORDER_TEST_LABEL) {
    throw new InternalOrderTestError(
      "Internal test records cannot execute payments, refunds, transfers, payouts, or financial notifications.",
      403,
    );
  }
  throw new InternalOrderTestError("This record is not a valid internal test record.", 403);
}
