import "server-only";

import {
  parseStripeConnectExecutionMode,
  type StripeConnectExecutionMode,
} from "@/lib/stripe-connect-execution-mode";

export type StripeConnectTransferReversalExecutionMode = StripeConnectExecutionMode;

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
  return parseStripeConnectExecutionMode(env.STRIPE_CONNECT_REVERSAL_EXECUTION_MODE);
}
