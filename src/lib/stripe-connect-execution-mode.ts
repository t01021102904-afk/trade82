import "server-only";

export type StripeConnectExecutionMode = "off" | "manual" | "auto";

export function parseStripeConnectExecutionMode(value?: string): StripeConnectExecutionMode {
  switch (value?.trim().toLowerCase()) {
    case "manual":
      return "manual";
    case "auto":
      return "auto";
    default:
      return "off";
  }
}
