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
  leg: { status: string; transferLockedAt: Date | string | null | undefined },
  now: Date,
) {
  if (leg.status !== "TRANSFER_PENDING" || !leg.transferLockedAt) return false;
  const lockTime = leg.transferLockedAt instanceof Date
    ? leg.transferLockedAt.getTime()
    : Date.parse(leg.transferLockedAt);
  return Number.isFinite(lockTime) && now.getTime() - lockTime >= TRANSFER_LOCK_TIMEOUT_MS;
}
