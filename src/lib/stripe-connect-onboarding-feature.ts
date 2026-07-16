import "server-only";

export type StripeConnectOnboardingMode = "off" | "on";

// Do not normalize this value. Production enablement must be explicit.
export function getStripeConnectOnboardingMode(
  value = process.env.STRIPE_CONNECT_ONBOARDING_MODE,
): StripeConnectOnboardingMode {
  return value === "on" ? "on" : "off";
}

export function isStripeConnectOnboardingEnabled(
  value = process.env.STRIPE_CONNECT_ONBOARDING_MODE,
) {
  return getStripeConnectOnboardingMode(value) === "on";
}
