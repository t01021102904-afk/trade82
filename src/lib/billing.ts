export const VERIFIED_SELLER_PLAN = "verified_seller";

export function isVerifiedSellerSubscription(
  status: string | null | undefined,
  plan: string | null | undefined,
) {
  return (
    plan === VERIFIED_SELLER_PLAN &&
    (status === "active" || status === "trialing")
  );
}

export function hasBillingPaymentIssue(status: string | null | undefined) {
  return status === "past_due" || status === "unpaid";
}
