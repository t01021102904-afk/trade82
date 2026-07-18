const MAX_REVERSAL_ATTEMPTS = 5;
const REVERSAL_LOCK_TIMEOUT_MS = 10 * 60 * 1000;

export function isStaleSettlementReversal(
  reversal: {
    status: string;
    reversalAttemptCount: number;
    reversalLockedAt: Date | string | null | undefined;
    nextReversalAttemptAt?: Date | string | null | undefined;
    reversalLastError?: string | null | undefined;
  },
  now: Date,
) {
  if (reversal.status !== "PENDING") return false;
  if (reversal.nextReversalAttemptAt) {
    const retryAt = reversal.nextReversalAttemptAt instanceof Date
      ? reversal.nextReversalAttemptAt.getTime()
      : Date.parse(reversal.nextReversalAttemptAt);
    if (!Number.isFinite(retryAt) || retryAt > now.getTime()) return false;
  }
  if (reversal.reversalLockedAt) {
    const lockedAt = reversal.reversalLockedAt instanceof Date
      ? reversal.reversalLockedAt.getTime()
      : Date.parse(reversal.reversalLockedAt);
    if (!Number.isFinite(lockedAt) || now.getTime() - lockedAt < REVERSAL_LOCK_TIMEOUT_MS) return false;
    return true;
  }
  return reversal.reversalAttemptCount >= MAX_REVERSAL_ATTEMPTS
    || reversal.reversalLastError?.startsWith("uncertain:") === true;
}
