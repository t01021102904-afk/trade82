import { PartnerProfileStatus } from "@/generated/prisma/client";

export type PartnerLifecycleAction =
  | "approve"
  | "reject"
  | "suspend"
  | "reactivate";

export function getPartnerLifecycleTransition(
  action: PartnerLifecycleAction,
  currentStatus: PartnerProfileStatus,
) {
  if (action === "approve" && currentStatus === PartnerProfileStatus.PENDING_REVIEW) {
    return PartnerProfileStatus.ACTIVE;
  }
  if (action === "reject" && currentStatus === PartnerProfileStatus.PENDING_REVIEW) {
    return PartnerProfileStatus.REJECTED;
  }
  if (action === "suspend" && currentStatus === PartnerProfileStatus.ACTIVE) {
    return PartnerProfileStatus.SUSPENDED;
  }
  if (action === "reactivate" && currentStatus === PartnerProfileStatus.SUSPENDED) {
    return PartnerProfileStatus.ACTIVE;
  }
  if (action === "reactivate" && currentStatus === PartnerProfileStatus.REJECTED) {
    return PartnerProfileStatus.PENDING_REVIEW;
  }
  return null;
}
