import "server-only";

import {
  AccountDeletionStatus,
  type AccountRole,
  type UserProfile,
} from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { consumeReferralClaimForNewUser } from "@/lib/partner-referrals";

export function isActiveUserProfile(
  profile:
    | Pick<UserProfile, "deletionStatus" | "deletedAt">
    | null
    | undefined,
) {
  return (
    profile?.deletionStatus === AccountDeletionStatus.ACTIVE &&
    profile.deletedAt === null
  );
}

export class ExistingEmailDifferentClerkIdentityError extends Error {
  readonly code = "existing_email_different_clerk_identity";

  constructor() {
    super("Account recovery is required before this identity can continue.");
    this.name = "ExistingEmailDifferentClerkIdentityError";
  }
}

export function isExistingEmailDifferentClerkIdentityError(error: unknown) {
  return error instanceof ExistingEmailDifferentClerkIdentityError;
}

function isUniqueConstraintError(
  error: unknown,
): error is { code: "P2002" } {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return false;
  }
  return error.code === "P2002";
}

type FreshProfileDatabase = ReturnType<typeof getDb>;

export async function createFreshUserProfile(
  db: FreshProfileDatabase,
  {
    clerkUserId,
    email,
    displayName,
    role,
    preferredLanguage,
    referralClaimToken,
  }: {
    clerkUserId: string;
    email: string;
    displayName: string;
    role: AccountRole;
    preferredLanguage: "en" | "ko";
    referralClaimToken: string | undefined;
  },
) {
  const normalizedEmail = email.trim().toLowerCase();

  try {
    return await db.$transaction(async (tx) => {
      const profile = await tx.userProfile.create({
        data: {
          clerkUserId,
          email: normalizedEmail,
          displayName,
          role,
          preferredLanguage,
        },
      });
      await consumeReferralClaimForNewUser(tx, {
        rawToken: referralClaimToken,
        referredUserId: profile.id,
      });
      return profile;
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;

    // Prisma's adapter-pg errors do not always include meta.target. Resolve
    // the conflict from the authoritative unique columns instead of
    // guessing from provider-specific error metadata.
    const [existingByClerkId, existingByEmail] = await Promise.all([
      db.userProfile.findUnique({ where: { clerkUserId } }),
      db.userProfile.findUnique({ where: { email: normalizedEmail } }),
    ]);

    if (isActiveUserProfile(existingByClerkId)) {
      return existingByClerkId;
    }

    if (existingByEmail && existingByEmail.clerkUserId !== clerkUserId) {
      throw new ExistingEmailDifferentClerkIdentityError();
    }

    // A non-active row or an unexplained unique conflict must not be treated
    // as permission to relink an identity or create an ambiguous profile.
    throw error;
  }
}
