import "server-only";

export type StripeConnectSettlementMode = "off" | "on";

type SettlementEnvironment = {
  STRIPE_CONNECT_SETTLEMENT_MODE?: string;
};

function runtimeEnvironment(): SettlementEnvironment {
  return {
    STRIPE_CONNECT_SETTLEMENT_MODE: process.env.STRIPE_CONNECT_SETTLEMENT_MODE,
  };
}

// Settlement transfers must remain fail-closed until the dedicated rollout is
// explicitly enabled. This PR creates only ledger records and never invokes the
// Stripe Connect API.
export function getStripeConnectSettlementMode(
  env: SettlementEnvironment = runtimeEnvironment(),
): StripeConnectSettlementMode {
  return env.STRIPE_CONNECT_SETTLEMENT_MODE?.trim().toLowerCase() === "on"
    ? "on"
    : "off";
}

export function isStripeConnectSettlementLedgerEnabled(
  env: SettlementEnvironment = runtimeEnvironment(),
) {
  return getStripeConnectSettlementMode(env) === "on";
}
