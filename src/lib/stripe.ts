import "server-only";

import Stripe from "stripe";
import {
  SELLER_SUPPORT_PLANS,
  type SellerSupportPlanId,
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

export function getVerifiedSellerPriceId() {
  const priceId = process.env.STRIPE_VERIFIED_SELLER_PRICE_ID;
  if (!priceId) {
    throw new Error("Verified Seller Stripe price is not configured.");
  }
  return priceId;
}

const supportPriceEnvByPlan: Record<SellerSupportPlanId, string> = {
  starter: "STRIPE_SUPPORT_STARTER_PRICE_ID",
  growth: "STRIPE_SUPPORT_GROWTH_PRICE_ID",
  full: "STRIPE_SUPPORT_FULL_PRICE_ID",
};

export function getSellerSupportPriceId(planId: SellerSupportPlanId) {
  const envName = supportPriceEnvByPlan[planId];
  const priceId = process.env[envName];
  if (!priceId) {
    throw new Error("Seller Support Stripe price is not configured.");
  }
  return priceId;
}

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
