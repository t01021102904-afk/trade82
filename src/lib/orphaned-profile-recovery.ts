import "server-only";

import {
  AccountDeletionStatus,
  Prisma,
} from "@/generated/prisma/client";
import {
  type AccountDeletionTransactionFinalizer,
  cleanupTrade82AccountData,
  type AccountDeletionCleanupResult,
} from "@/lib/account-deletion";
import { isConfirmedMissingClerkUserError } from "@/lib/clerk-identity-resolver";
import { getDb } from "@/lib/db";

type RecoveryDatabase = ReturnType<typeof getDb>;

export const ORPHANED_PROFILE_RECOVERY_LEASE_MS = 5 * 60_000;

type RecoveryProfile = {
  id: string;
  clerkUserId: string;
  deletionRequestedAt: Date | null;
  deletionStatus: AccountDeletionStatus;
};

export type OrphanedProfileRecoveryResult =
  | { kind: "recovered"; profileId: string }
  | { kind: "already_recovered"; profileId: string }
  | { kind: "old_clerk_identity_exists" }
  | { kind: "recovery_in_progress" }
  | { kind: "not_found" }
  | { kind: "not_available" };

export class OrphanedProfileRecoveryClerkError extends Error {
  readonly code = "orphaned_profile_clerk_lookup_failed";

  constructor() {
    super("The previous account could not be safely verified.");
    this.name = "OrphanedProfileRecoveryClerkError";
  }
}

export class OrphanedProfileRecoveryCleanupError extends Error {
  readonly code = "orphaned_profile_cleanup_incomplete";

  constructor() {
    super("The previous account cleanup did not complete.");
    this.name = "OrphanedProfileRecoveryCleanupError";
  }
}

class ExistingClerkIdentityError extends Error {
  constructor() {
    super("The previous Clerk identity still exists.");
    this.name = "ExistingClerkIdentityError";
  }
}

type RecoveryOptions = {
  db?: RecoveryDatabase;
  currentClerkUserId: string;
  email: string;
  displayName: string;
  preferredLanguage: "en" | "ko";
  findClerkUser: (clerkUserId: string) => Promise<unknown>;
  cleanup?: (target: {
    userProfileId: string;
    clerkUserId: string;
    onBeforeCommit?: AccountDeletionTransactionFinalizer;
  }) => Promise<AccountDeletionCleanupResult>;
  createReplacementProfile?: (
    tx: Prisma.TransactionClient,
    data: {
      clerkUserId: string;
      email: string;
      displayName: string;
      preferredLanguage: "en" | "ko";
    },
  ) => Promise<{ id: string }>;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isActive(profile: Pick<RecoveryProfile, "deletionStatus"> | null) {
  return profile?.deletionStatus === AccountDeletionStatus.ACTIVE;
}

function isPending(profile: Pick<RecoveryProfile, "deletionStatus"> | null) {
  return profile?.deletionStatus === AccountDeletionStatus.DELETION_PENDING;
}

function hasRecentRecoveryLease(
  deletionRequestedAt: Date | null,
  now: Date,
) {
  return (
    deletionRequestedAt !== null &&
    now.getTime() - deletionRequestedAt.getTime() < ORPHANED_PROFILE_RECOVERY_LEASE_MS
  );
}

async function assertOldClerkIdentityMissing(
  findClerkUser: RecoveryOptions["findClerkUser"],
  clerkUserId: string,
) {
  try {
    await findClerkUser(clerkUserId);
  } catch (error) {
    if (isConfirmedMissingClerkUserError(error)) return;
    throw new OrphanedProfileRecoveryClerkError();
  }

  throw new ExistingClerkIdentityError();
}

export async function recoverOrphanedUserProfile({
  db = getDb(),
  currentClerkUserId,
  email,
  displayName,
  preferredLanguage,
  findClerkUser,
  cleanup = cleanupTrade82AccountData,
  createReplacementProfile = (tx, data) =>
    tx.userProfile.create({
      data: {
        ...data,
        role: "user",
      },
      select: { id: true },
    }),
}: RecoveryOptions): Promise<OrphanedProfileRecoveryResult> {
  const normalizedEmail = normalizeEmail(email);
  const now = new Date();
  let claim:
    | { kind: "claimed"; userProfileId: string; clerkUserId: string }
    | Exclude<OrphanedProfileRecoveryResult, { kind: "recovered" }>
    | { kind: "already_recovered"; profileId: string };

  try {
    claim = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${normalizedEmail}, 0))`;

      const current = await tx.userProfile.findUnique({
        where: { clerkUserId: currentClerkUserId },
        select: { id: true, deletionStatus: true },
      });
      if (current && isActive(current)) {
        return { kind: "already_recovered" as const, profileId: current.id };
      }

      const existing = await tx.userProfile.findUnique({
        where: { email: normalizedEmail },
        select: {
          id: true,
          clerkUserId: true,
          email: true,
          deletionStatus: true,
          deletionRequestedAt: true,
        },
      });
      if (!existing) return { kind: "not_found" as const };
      if (existing.clerkUserId === currentClerkUserId) {
        return isActive(existing)
          ? { kind: "already_recovered" as const, profileId: existing.id }
          : { kind: "not_available" as const };
      }
      if (isPending(existing)) {
        if (hasRecentRecoveryLease(existing.deletionRequestedAt, now)) {
          return { kind: "recovery_in_progress" as const };
        }
        await assertOldClerkIdentityMissing(findClerkUser, existing.clerkUserId);
        const renewed = await tx.userProfile.updateMany({
          where: {
            id: existing.id,
            deletionStatus: AccountDeletionStatus.DELETION_PENDING,
            deletionRequestedAt: existing.deletionRequestedAt,
          },
          data: { deletionRequestedAt: now },
        });
        return renewed.count === 1
          ? {
              kind: "claimed" as const,
              userProfileId: existing.id,
              clerkUserId: existing.clerkUserId,
            }
          : { kind: "recovery_in_progress" as const };
      }
      if (!isActive(existing)) return { kind: "not_available" as const };

      await assertOldClerkIdentityMissing(findClerkUser, existing.clerkUserId);

      const updated = await tx.userProfile.updateMany({
        where: {
          id: existing.id,
          deletionStatus: AccountDeletionStatus.ACTIVE,
        },
        data: {
          deletionStatus: AccountDeletionStatus.DELETION_PENDING,
          deletionRequestedAt: now,
        },
      });
      return updated.count === 1
        ? {
            kind: "claimed" as const,
            userProfileId: existing.id,
            clerkUserId: existing.clerkUserId,
          }
        : { kind: "recovery_in_progress" as const };
    });
  } catch (error) {
    if (error instanceof ExistingClerkIdentityError) {
      return { kind: "old_clerk_identity_exists" };
    }
    throw error;
  }

  if (claim.kind !== "claimed") return claim;

  const cleanupResult = await cleanup({
    userProfileId: claim.userProfileId,
    clerkUserId: claim.clerkUserId,
    onBeforeCommit: async (tx) => {
      const replacement = await createReplacementProfile(tx, {
        clerkUserId: currentClerkUserId,
        email: normalizedEmail,
        displayName,
        preferredLanguage,
      });
      return { replacementProfileId: replacement.id };
    },
  });
  if (cleanupResult.deletionStatus !== AccountDeletionStatus.DELETED) {
    throw new OrphanedProfileRecoveryCleanupError();
  }
  if (!cleanupResult.replacementProfileId) {
    throw new OrphanedProfileRecoveryCleanupError();
  }
  return { kind: "recovered", profileId: cleanupResult.replacementProfileId };
}
