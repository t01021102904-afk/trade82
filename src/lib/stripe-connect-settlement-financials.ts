import "server-only";

export const REFERRAL_PARTNER_SHARE_OF_PLATFORM_FEE_BPS = 1_000;
export const SETTLEMENT_BASIS_POINTS_DENOMINATOR = 10_000;
const PLATFORM_FEE_BPS = 500;

export type StripeConnectSettlementFinancials = {
  grossAmount: number;
  platformFeeAmount: number;
  sellerPayableAmount: number;
  partnerReferralAmount: number;
  trade82NetAmount: number;
  currency: "usd";
};

function assertMinorUnits(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer minor-unit amount.`);
  }
}

// Uses quotient/remainder arithmetic so a safe gross amount is never multiplied
// into an unsafe JavaScript integer before applying basis points.
export function calculateBasisPointShare(amount: number, basisPoints: number) {
  assertMinorUnits(amount, "Amount");
  if (!Number.isInteger(basisPoints) || basisPoints < 0 || basisPoints > SETTLEMENT_BASIS_POINTS_DENOMINATOR) {
    throw new Error("Basis points must be an integer from 0 through 10000.");
  }

  const whole = Math.floor(amount / SETTLEMENT_BASIS_POINTS_DENOMINATOR);
  const remainder = amount % SETTLEMENT_BASIS_POINTS_DENOMINATOR;
  return whole * basisPoints + Math.floor((remainder * basisPoints + 5_000) / SETTLEMENT_BASIS_POINTS_DENOMINATOR);
}

export function calculateStripeConnectSettlementFinancials({
  grossAmount,
  currency,
  hasReferralAttribution,
}: {
  grossAmount: number;
  currency: string;
  hasReferralAttribution: boolean;
}): StripeConnectSettlementFinancials {
  assertMinorUnits(grossAmount, "Gross amount");
  if (currency.trim().toLowerCase() !== "usd") {
    throw new Error("Settlement currency must be usd.");
  }
  const platformFeeAmount = calculateBasisPointShare(grossAmount, PLATFORM_FEE_BPS);
  const sellerPayableAmount = grossAmount - platformFeeAmount;
  const partnerReferralAmount = hasReferralAttribution
    ? calculateBasisPointShare(platformFeeAmount, REFERRAL_PARTNER_SHARE_OF_PLATFORM_FEE_BPS)
    : 0;
  const trade82NetAmount = platformFeeAmount - partnerReferralAmount;

  if (trade82NetAmount < 0 || sellerPayableAmount + partnerReferralAmount + trade82NetAmount !== grossAmount) {
    throw new Error("Settlement financials do not balance.");
  }

  return {
    grossAmount,
    platformFeeAmount,
    sellerPayableAmount,
    partnerReferralAmount,
    trade82NetAmount,
    currency: "usd",
  };
}
