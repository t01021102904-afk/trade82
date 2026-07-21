import "server-only";

import { AccountDeletionStatus } from "@/generated/prisma/client";
import {
  cleanupTrade82AccountData,
  type AccountDeletionCleanupResult,
} from "@/lib/account-deletion";
import { isConfirmedMissingClerkUserError } from "@/lib/clerk-identity-resolver";
import { createFreshUserProfile } from "@/lib/fresh-user-profile";
import { getDb } from "@/lib/db";

type RecoveryDatabase = ReturnType<typeof getDb>;

type RecoveryProfile = {
  id: string;
  clerkUserId: string;
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
  }) => Promise<AccountDeletionCleanupResult>;
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

function isDeletedAndAnonymized(
  profile: Pick<RecoveryProfile, "id" | "clerkUserId" | "deletionStatus"> & {
    email: string;
  },
) {
  return (
    profile.deletionStatus === AccountDeletionStatus.DELETED &&
    profile.clerkUserId === `deleted:${profile.id}` &&
    profile.email === `deleted-${profile.id}@deleted.trade82.local`
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
}: RecoveryOptions): Promise<OrphanedProfileRecoveryResult> {
  const normalizedEmail = normalizeEmail(email);
  const currentProfile = await db.userProfile.findUnique({
    where: { clerkUserId: currentClerkUserId },
    select: { id: true, deletionStatus: true },
  });
  if (currentProfile && isActive(currentProfile)) {
    return { kind: "already_recovered", profileId: currentProfile.id };
  }
  if (currentProfile) return { kind: "not_available" };

  const candidate = await db.userProfile.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      clerkUserId: true,
      deletionStatus: true,
      email: true,
    },
  });
  if (!candidate) return { kind: "not_found" };
  if (candidate.clerkUserId === currentClerkUserId) {
    return isActive(candidate)
      ? { kind: "already_recovered", profileId: candidate.id }
      : { kind: "not_available" };
  }
  if (isPending(candidate)) return { kind: "recovery_in_progress" };
  if (!isActive(candidate)) return { kind: "not_available" };

  try {
    await assertOldClerkIdentityMissing(findClerkUser, candidate.clerkUserId);
  } catch (error) {
    if (error instanceof ExistingClerkIdentityError) {
      return { kind: "old_clerk_identity_exists" };
    }
    throw error;
  }

  const claim = await db.$transaction(async (tx) => {
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
      select: { id: true, clerkUserId: true, deletionStatus: true },
    });
    if (!existing) return { kind: "not_found" as const };
    if (existing.clerkUserId === currentClerkUserId) {
      return isActive(existing)
        ? { kind: "already_recovered" as const, profileId: existing.id }
        : { kind: "not_available" as const };
    }
    if (isPending(existing)) return { kind: "recovery_in_progress" as const };
    if (!isActive(existing)) return { kind: "not_available" as const };

    const updated = await tx.userProfile.updateMany({
      where: {
        id: existing.id,
        deletionStatus: AccountDeletionStatus.ACTIVE,
      },
      data: {
        deletionStatus: AccountDeletionStatus.DELETION_PENDING,
        deletionRequestedAt: new Date(),
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

  if (claim.kind !== "claimed") return claim;

  const cleanupResult = await cleanup({
    userProfileId: claim.userProfileId,
    clerkUserId: claim.clerkUserId,
  });
  if (cleanupResult.deletionStatus !== AccountDeletionStatus.DELETED) {
    throw new OrphanedProfileRecoveryCleanupError();
  }

  const deletedProfile = await db.userProfile.findUnique({
    where: { id: claim.userProfileId },
    select: {
      id: true,
      clerkUserId: true,
      email: true,
      deletionStatus: true,
    },
  });
  if (!deletedProfile || !isDeletedAndAnonymized(deletedProfile)) {
    throw new OrphanedProfileRecoveryCleanupError();
  }

  const freshProfile = await createFreshUserProfile(db, {
    clerkUserId: currentClerkUserId,
    email: normalizedEmail,
    displayName,
    role: "user",
    preferredLanguage,
    referralClaimToken: undefined,
  });
  if (!freshProfile) {
    throw new OrphanedProfileRecoveryCleanupError();
  }
  return { kind: "recovered", profileId: freshProfile.id };
}
