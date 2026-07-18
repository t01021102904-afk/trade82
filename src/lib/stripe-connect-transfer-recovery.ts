export const TRANSFER_LOCK_TIMEOUT_MS = 10 * 60 * 1000;

export function isTransferLockActive(
  lockedAt: Date | string | null | undefined,
  now: Date,
) {
  if (!lockedAt) return false;
  const lockTime = lockedAt instanceof Date ? lockedAt.getTime() : Date.parse(lockedAt);
  return Number.isFinite(lockTime) && now.getTime() - lockTime < TRANSFER_LOCK_TIMEOUT_MS;
}

export function isStaleTransferPending(
  leg: {
    status: string;
    transferLockedAt: Date | string | null | undefined;
    nextTransferAttemptAt?: Date | string | null | undefined;
  },
  now: Date,
) {
  if (leg.status !== "TRANSFER_PENDING") return false;
  if (leg.nextTransferAttemptAt) {
    const retryTime = leg.nextTransferAttemptAt instanceof Date
      ? leg.nextTransferAttemptAt.getTime()
      : Date.parse(leg.nextTransferAttemptAt);
    if (!Number.isFinite(retryTime) || retryTime > now.getTime()) return false;
  }
  if (!leg.transferLockedAt) return true;
  const lockTime = leg.transferLockedAt instanceof Date
    ? leg.transferLockedAt.getTime()
    : Date.parse(leg.transferLockedAt);
  return Number.isFinite(lockTime) && now.getTime() - lockTime >= TRANSFER_LOCK_TIMEOUT_MS;
}
