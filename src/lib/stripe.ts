import "server-only";

import Stripe from "stripe";

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

export function getAppUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}
