import "server-only";

import {
  AccountDeletionStatus,
  Prisma,
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

function isEmailUniqueConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    Array.isArray(error.meta?.target) &&
    error.meta.target.includes("email")
  );
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
  try {
    return await db.$transaction(async (tx) => {
      const profile = await tx.userProfile.create({
        data: {
          clerkUserId,
          email,
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
    if (!isEmailUniqueConflict(error)) throw error;

    // A concurrent request for this same Clerk identity may have won the
    // unique insert. An email conflict from another identity is never a
    // relinking opportunity.
    const existingByClerkId = await db.userProfile.findUnique({
      where: { clerkUserId },
    });
    return isActiveUserProfile(existingByClerkId) ? existingByClerkId : null;
  }
}
