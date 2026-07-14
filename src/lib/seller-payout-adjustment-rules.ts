export const SELLER_PAYOUT_ADJUSTMENT_TYPES = [
  "CREDIT",
  "DEBIT",
  "REFUND_RECOVERY",
  "BANK_FEE",
  "FX_ADJUSTMENT",
  "OTHER",
] as const;

export type SellerPayoutAdjustmentType = (typeof SELLER_PAYOUT_ADJUSTMENT_TYPES)[number];

export type PayoutAdjustmentEntry = {
  adjustmentType: SellerPayoutAdjustmentType;
  amount: number;
};

function assertSafeInteger(value: number, label: string, minimum: number) {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${label} must be an integer minor-unit amount.`);
  }
}

function safeAdd(left: number, right: number, label: string) {
  const result = left + right;
  if (!Number.isSafeInteger(result)) {
    throw new Error(`${label} exceeds the supported integer range.`);
  }
  return result;
}

export function isSellerPayoutAdjustmentType(value: unknown): value is SellerPayoutAdjustmentType {
  return typeof value === "string" && SELLER_PAYOUT_ADJUSTMENT_TYPES.includes(value as SellerPayoutAdjustmentType);
}

// Credits are the only adjustment type that increases a pending payout. Every
// other type represents a deduction/recovery and is stored as a positive amount
// so the ledger is unambiguous and never accepts a negative input value.
export function signedAdjustmentAmount(entry: PayoutAdjustmentEntry) {
  assertSafeInteger(entry.amount, "Adjustment amount", 1);
  if (!isSellerPayoutAdjustmentType(entry.adjustmentType)) {
    throw new Error("Adjustment type is invalid.");
  }
  return entry.adjustmentType === "CREDIT" ? entry.amount : -entry.amount;
}

export function calculatePayoutAdjustmentTotals(input: {
  sellerPayableAmount: number;
  refundAdjustmentAmount: number;
  adjustments: PayoutAdjustmentEntry[];
}) {
  assertSafeInteger(input.sellerPayableAmount, "Seller payable amount", 0);
  assertSafeInteger(input.refundAdjustmentAmount, "Refund adjustment amount", 0);

  let manualAdjustmentAmount = 0;
  for (const adjustment of input.adjustments) {
    manualAdjustmentAmount = safeAdd(
      manualAdjustmentAmount,
      signedAdjustmentAmount(adjustment),
      "Manual adjustment total",
    );
  }

  const afterRefunds = safeAdd(
    input.sellerPayableAmount,
    -input.refundAdjustmentAmount,
    "Payout total",
  );
  const finalPayoutAmount = safeAdd(afterRefunds, manualAdjustmentAmount, "Payout total");
  if (finalPayoutAmount < 0) {
    throw new Error("The adjustment would make the final payout amount negative.");
  }

  return { manualAdjustmentAmount, finalPayoutAmount };
}
