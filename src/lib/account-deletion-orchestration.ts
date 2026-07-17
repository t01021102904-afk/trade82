import "server-only";

import type { AccountDeletionCleanupResult } from "@/lib/account-deletion";
import {
  canReportAccountDeletionSuccess,
  isAlreadyDeletedInClerk,
} from "@/lib/account-deletion-rules";

type AccountDeletionDependencies = {
  markPending: () => Promise<unknown>;
  deleteClerkUser: () => Promise<unknown>;
  cleanup: () => Promise<AccountDeletionCleanupResult>;
};

export type AccountDeletionAttempt =
  | { ok: true; cleanup: AccountDeletionCleanupResult }
  | { ok: false; stage: "clerk" | "cleanup"; error: unknown };

/**
 * Local cleanup is intentionally unavailable until Clerk confirms deletion.
 * A Clerk 404 is safe only because it proves the identity is already gone.
 */
export async function deleteAccountAfterVerifiedClerk(
  dependencies: AccountDeletionDependencies,
): Promise<AccountDeletionAttempt> {
  await dependencies.markPending();

  try {
    await dependencies.deleteClerkUser();
  } catch (error) {
    if (!isAlreadyDeletedInClerk(error)) {
      return { ok: false, stage: "clerk", error };
    }
  }

  try {
    const cleanup = await dependencies.cleanup();
    if (!canReportAccountDeletionSuccess({
      clerkDeletionConfirmed: true,
      deletionStatus: cleanup.deletionStatus,
    })) {
      return {
        ok: false,
        stage: "cleanup",
        error: new Error("Account deletion cleanup did not reach DELETED."),
      };
    }
    return { ok: true, cleanup };
  } catch (error) {
    return { ok: false, stage: "cleanup", error };
  }
}
