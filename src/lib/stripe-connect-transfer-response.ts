export type SettlementTransferResponseStatus =
  | "disabled"
  | "transferred"
  | "retry_scheduled"
  | "failed"
  | "ineligible"
  | "claim_lost"
  | "persistence_failed"
  | "finalization_failed";

export function settlementTransferHttpStatus({
  status,
  retryable,
}: {
  status: string;
  retryable: boolean;
}) {
  switch (status) {
    case "transferred":
      return 200;
    case "disabled":
      return 403;
    case "ineligible":
    case "claim_lost":
      return 409;
    case "retry_scheduled":
      return 503;
    case "failed":
      return retryable ? 502 : 422;
    case "persistence_failed":
    case "finalization_failed":
      return 500;
    default:
      return 500;
  }
}
