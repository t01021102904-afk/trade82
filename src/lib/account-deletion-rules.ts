import { AccountDeletionStatus } from "@/generated/prisma/client";

type ClerkDeletionError = {
  status?: unknown;
  errors?: Array<{ code?: unknown }>;
};

/** A Clerk 404 is idempotent evidence that this identity is already gone. */
export function isAlreadyDeletedInClerk(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as ClerkDeletionError;
  return candidate.status === 404 || candidate.errors?.some(
    (item) => item.code === "resource_not_found" || item.code === "user_not_found",
  ) === true;
}

export function canReportAccountDeletionSuccess({
  clerkDeletionConfirmed,
  deletionStatus,
}: {
  clerkDeletionConfirmed: boolean;
  deletionStatus: AccountDeletionStatus | null;
}) {
  return clerkDeletionConfirmed && deletionStatus === AccountDeletionStatus.DELETED;
}
