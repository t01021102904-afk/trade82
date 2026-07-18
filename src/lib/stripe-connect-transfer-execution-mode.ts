import "server-only";

export type StripeConnectTransferExecutionMode = "off" | "manual";

type TransferExecutionEnvironment = {
  STRIPE_CONNECT_TRANSFER_EXECUTION_MODE?: string;
};

function runtimeEnvironment(): TransferExecutionEnvironment {
  return {
    STRIPE_CONNECT_TRANSFER_EXECUTION_MODE: process.env.STRIPE_CONNECT_TRANSFER_EXECUTION_MODE,
  };
}

// This mode is intentionally separate from the ledger rollout. Missing or
// malformed configuration never permits transfer execution.
export function getStripeConnectTransferExecutionMode(
  env: TransferExecutionEnvironment = runtimeEnvironment(),
): StripeConnectTransferExecutionMode {
  switch (env.STRIPE_CONNECT_TRANSFER_EXECUTION_MODE?.trim().toLowerCase()) {
    case "manual":
      return "manual";
    default:
      return "off";
  }
}
