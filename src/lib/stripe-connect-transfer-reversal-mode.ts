import "server-only";

export type StripeConnectTransferReversalExecutionMode = "off" | "manual";

type ReversalExecutionEnvironment = {
  STRIPE_CONNECT_REVERSAL_EXECUTION_MODE?: string;
};

function runtimeEnvironment(): ReversalExecutionEnvironment {
  return {
    STRIPE_CONNECT_REVERSAL_EXECUTION_MODE: process.env.STRIPE_CONNECT_REVERSAL_EXECUTION_MODE,
  };
}

export function getStripeConnectTransferReversalExecutionMode(
  env: ReversalExecutionEnvironment = runtimeEnvironment(),
): StripeConnectTransferReversalExecutionMode {
  return env.STRIPE_CONNECT_REVERSAL_EXECUTION_MODE?.trim().toLowerCase() === "manual"
    ? "manual"
    : "off";
}
