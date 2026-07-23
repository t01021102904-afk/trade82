import { PartnerProfileStatus } from "@/generated/prisma/client";

export type PartnerLifecycleAction =
  | "suspend"
  | "reactivate";

export function getPartnerLifecycleTransition(
  action: PartnerLifecycleAction,
  currentStatus: PartnerProfileStatus,
) {
  if (action === "suspend" && currentStatus === PartnerProfileStatus.ACTIVE) {
    return PartnerProfileStatus.SUSPENDED;
  }
  if (action === "reactivate" && currentStatus === PartnerProfileStatus.SUSPENDED) {
    return PartnerProfileStatus.ACTIVE;
  }
  return null;
}
