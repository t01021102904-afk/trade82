export const SELLER_SUPPORT_PRODUCT_TYPE = "seller_support";

export const SELLER_SUPPORT_PLAN_IDS = ["starter", "growth", "full"] as const;

export type SellerSupportPlanId = (typeof SELLER_SUPPORT_PLAN_IDS)[number];

export type SellerSupportPlan = {
  id: SellerSupportPlanId;
  name: string;
  price: number;
  monthlyLimit: number;
  priority: boolean;
};

export const SELLER_SUPPORT_PLANS: SellerSupportPlan[] = [
  {
    id: "starter",
    name: "Starter Plan",
    price: 99,
    monthlyLimit: 3,
    priority: false,
  },
  {
    id: "growth",
    name: "Growth Plan",
    price: 179,
    monthlyLimit: 6,
    priority: false,
  },
  {
    id: "full",
    name: "Full Support Plan",
    price: 349,
    monthlyLimit: 12,
    priority: true,
  },
];

export function isSellerSupportPlanId(
  value: string | null | undefined,
): value is SellerSupportPlanId {
  return SELLER_SUPPORT_PLAN_IDS.includes(value as SellerSupportPlanId);
}

export function sellerSupportPlanById(
  planId: string | null | undefined,
) {
  return isSellerSupportPlanId(planId)
    ? SELLER_SUPPORT_PLANS.find((plan) => plan.id === planId) ?? null
    : null;
}

export function sellerSupportMonthlyLimit(planId: string | null | undefined) {
  return sellerSupportPlanById(planId)?.monthlyLimit ?? 0;
}

export function isActiveSellerSupportSubscription(
  status: string | null | undefined,
  plan: string | null | undefined,
) {
  return (
    isSellerSupportPlanId(plan) &&
    (status === "active" || status === "trialing")
  );
}
