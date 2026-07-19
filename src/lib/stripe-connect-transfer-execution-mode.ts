import "server-only";

import {
  parseStripeConnectExecutionMode,
  type StripeConnectExecutionMode,
} from "@/lib/stripe-connect-execution-mode";

export type StripeConnectTransferExecutionMode = StripeConnectExecutionMode;

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
  return parseStripeConnectExecutionMode(env.STRIPE_CONNECT_TRANSFER_EXECUTION_MODE);
}
