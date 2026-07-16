type ReferralSubjectType = "BUYER" | "SELLER";

export type LockedReferralAttributionCandidate = {
  id: string;
  referredUserId: string;
  lockedAt: Date;
  subjectType: ReferralSubjectType;
};

// A transaction can have at most one referral commission. The stable sort keeps
// webhook retries deterministic when both parties have locked attributions.
export function selectLockedReferralAttribution(
  candidates: readonly LockedReferralAttributionCandidate[],
) {
  return [...candidates].sort((left, right) => {
    const lockedAtDifference = left.lockedAt.getTime() - right.lockedAt.getTime();
    if (lockedAtDifference !== 0) return lockedAtDifference;
    if (left.id === right.id) {
      return left.subjectType === right.subjectType
        ? 0
        : left.subjectType === "BUYER"
          ? -1
          : 1;
    }
    return left.id < right.id ? -1 : 1;
  })[0] ?? null;
}
