import "server-only";

import Stripe from "stripe";
import {
  SELLER_SUPPORT_PLANS,
} from "@/lib/seller-support";

let stripeClient: Stripe | null = null;

export function getStripe() {
  if (stripeClient) return stripeClient;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Stripe secret key is not configured.");
  }

  stripeClient = new Stripe(secretKey, {
    apiVersion: "2026-06-24.dahlia",
    typescript: true,
  });

  return stripeClient;
}

const supportPriceEnvByPlan = {
  starter: "STRIPE_SUPPORT_STARTER_PRICE_ID",
  growth: "STRIPE_SUPPORT_GROWTH_PRICE_ID",
  full: "STRIPE_SUPPORT_FULL_PRICE_ID",
};

export function getSellerSupportPlanForPriceId(priceId: string | null | undefined) {
  if (!priceId) return null;
  return (
    SELLER_SUPPORT_PLANS.find(
      (plan) => process.env[supportPriceEnvByPlan[plan.id]] === priceId,
    )?.id ?? null
  );
}

export function getAppUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}
