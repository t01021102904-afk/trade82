import "server-only";

import type Stripe from "stripe";
import { getStripeSecretKey } from "@/lib/stripe";

export type StripeConnectRuntimeMode = "live" | "test";

const runtimeConfigurationMessage = "Stripe Connect runtime configuration is invalid.";

export class StripeConnectRuntimeConfigurationError extends Error {
  constructor() {
    super(runtimeConfigurationMessage);
    this.name = "StripeConnectRuntimeConfigurationError";
  }
}

export function getStripeConnectRuntimeMode(
  value = process.env.STRIPE_CONNECT_RUNTIME_MODE,
): StripeConnectRuntimeMode | null {
  const normalized = value?.trim();
  return normalized === "live" || normalized === "test" ? normalized : null;
}

export function assertStripeConnectRuntimeMode(
  value = process.env.STRIPE_CONNECT_RUNTIME_MODE,
): StripeConnectRuntimeMode {
  const mode = getStripeConnectRuntimeMode(value);
  if (!mode) throw new StripeConnectRuntimeConfigurationError();
  return mode;
}

function readStripeSecretKey() {
  try {
    return getStripeSecretKey();
  } catch {
    throw new StripeConnectRuntimeConfigurationError();
  }
}

function getStripeCredentialRuntime(secretKey: string | undefined): StripeConnectRuntimeMode | null {
  if (!secretKey) return null;
  if (secretKey.startsWith("sk_live_") || secretKey.startsWith("rk_live_")) return "live";
  if (secretKey.startsWith("sk_test_") || secretKey.startsWith("rk_test_")) return "test";
  return null;
}

export function assertStripeCredentialMatchesRuntime({
  runtimeMode = assertStripeConnectRuntimeMode(),
  secretKey = readStripeSecretKey(),
}: {
  runtimeMode?: StripeConnectRuntimeMode;
  secretKey?: string;
} = {}) {
  if (getStripeCredentialRuntime(secretKey) !== runtimeMode) {
    throw new StripeConnectRuntimeConfigurationError();
  }
  return runtimeMode;
}

export function assertStripeConnectRuntimeConfiguration() {
  const runtimeMode = assertStripeConnectRuntimeMode();
  assertStripeCredentialMatchesRuntime({ runtimeMode });
  return runtimeMode;
}

export function stripeEventMatchesConfiguredRuntime(
  event: Pick<Stripe.Event, "livemode">,
  runtimeMode = assertStripeConnectRuntimeMode(),
) {
  return event.livemode === (runtimeMode === "live");
}

export function isStripeConnectRuntimeConfigurationError(error: unknown) {
  return error instanceof StripeConnectRuntimeConfigurationError;
}
