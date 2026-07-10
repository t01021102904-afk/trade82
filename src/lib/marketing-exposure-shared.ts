export const MARKETING_EXPOSURE_FEATURE = "marketing_exposure";
export const MARKETING_EXPOSURE_PLACEMENT = "landing_page";

export const MARKETING_EXPOSURE_PLAN_IDS = [
  "landing_7d",
  "landing_30d",
  "landing_90d",
] as const;

export type MarketingExposurePlanId =
  (typeof MARKETING_EXPOSURE_PLAN_IDS)[number];

export type MarketingExposurePlan = {
  id: MarketingExposurePlanId;
  dbPlan: "LANDING_7D" | "LANDING_30D" | "LANDING_90D";
  envName: string;
  durationDays: number;
  price: number;
};

export const MARKETING_EXPOSURE_PLANS: MarketingExposurePlan[] = [
  {
    id: "landing_7d",
    dbPlan: "LANDING_7D",
    envName: "STRIPE_MARKETING_LANDING_7D_PRICE_ID",
    durationDays: 7,
    price: 49,
  },
  {
    id: "landing_30d",
    dbPlan: "LANDING_30D",
    envName: "STRIPE_MARKETING_LANDING_30D_PRICE_ID",
    durationDays: 30,
    price: 149,
  },
  {
    id: "landing_90d",
    dbPlan: "LANDING_90D",
    envName: "STRIPE_MARKETING_LANDING_90D_PRICE_ID",
    durationDays: 90,
    price: 349,
  },
];

export function isMarketingExposurePlanId(
  value: string | null | undefined,
): value is MarketingExposurePlanId {
  return MARKETING_EXPOSURE_PLAN_IDS.includes(
    value as MarketingExposurePlanId,
  );
}

export function marketingExposurePlanById(
  planId: string | null | undefined,
) {
  return isMarketingExposurePlanId(planId)
    ? MARKETING_EXPOSURE_PLANS.find((plan) => plan.id === planId) ?? null
    : null;
}

export function marketingExposurePlanByDbPlan(
  dbPlan: string | null | undefined,
) {
  return MARKETING_EXPOSURE_PLANS.find((plan) => plan.dbPlan === dbPlan) ?? null;
}
