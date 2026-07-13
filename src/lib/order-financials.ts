export const PLATFORM_FEE_BPS = 500;
export const BASIS_POINTS_DENOMINATOR = 10_000;

export type OrderFinancials = {
  grossAmount: number;
  platformFeeAmount: number;
  sellerPayableAmount: number;
};

const PLATFORM_FEE_DIVISOR = BASIS_POINTS_DENOMINATOR / PLATFORM_FEE_BPS;

function assertMinorUnits(value: number, label: string, minimum: number) {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${label} must be an integer minor-unit amount.`);
  }
}

export function assertUsdCurrency(currency: string) {
  if (currency.trim().toLowerCase() !== "usd") {
    throw new Error("Order currency must be usd.");
  }
  return "usd" as const;
}

function roundedPlatformFee(grossAmount: number) {
  // 500 bps is exactly one twentieth. Dividing before rounding prevents a
  // large-but-safe integer gross amount from overflowing during multiplication.
  const wholeUnits = Math.floor(grossAmount / PLATFORM_FEE_DIVISOR);
  const remainder = grossAmount % PLATFORM_FEE_DIVISOR;
  return wholeUnits + (remainder * 2 >= PLATFORM_FEE_DIVISOR ? 1 : 0);
}

// This is the sole platform-fee calculation. Stripe processing fees intentionally
// remain separate so they do not reduce the seller's initial 95% payable amount.
export function calculateOrderFinancials(
  productAmount: number,
  shippingAmount: number,
): OrderFinancials {
  assertMinorUnits(productAmount, "Product amount", 1);
  assertMinorUnits(shippingAmount, "Shipping amount", 0);

  const grossAmount = productAmount + shippingAmount;
  assertMinorUnits(grossAmount, "Gross amount", 1);

  const platformFeeAmount = roundedPlatformFee(grossAmount);
  const sellerPayableAmount = grossAmount - platformFeeAmount;
  assertMinorUnits(sellerPayableAmount, "Seller payable amount", 0);

  return { grossAmount, platformFeeAmount, sellerPayableAmount };
}
