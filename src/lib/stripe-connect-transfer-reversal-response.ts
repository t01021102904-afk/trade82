export type SettlementReversalExecutionStatus =
  | "disabled"
  | "reversed"
  | "retry_scheduled"
  | "failed"
  | "ineligible"
  | "claim_lost"
  | "persistence_failed"
  | "finalization_failed"
  | "needs_manual_review"
  | "recovery_pending"
  | "requeued";

export function settlementReversalHttpStatus({
  status,
  retryable,
}: {
  status: string;
  retryable: boolean;
}) {
  switch (status) {
    case "reversed":
      return 200;
    case "disabled":
      return 403;
    case "ineligible":
    case "claim_lost":
      return 409;
    case "retry_scheduled":
    case "recovery_pending":
      return 503;
    case "failed":
      return retryable ? 502 : 422;
    case "persistence_failed":
    case "finalization_failed":
      return 500;
    case "needs_manual_review":
      return 422;
    case "requeued":
      return 200;
    default:
      return 500;
  }
}
