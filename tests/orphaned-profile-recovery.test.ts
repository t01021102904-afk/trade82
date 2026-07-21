import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const { AccountDeletionStatus } = await import(
  new URL("../src/generated/prisma/client.ts", import.meta.url).href,
);
const freshProfile = await import(
  new URL("../src/lib/fresh-user-profile.ts", import.meta.url).href,
);
const recovery = await import(
  new URL("../src/lib/orphaned-profile-recovery.ts", import.meta.url).href,
);

function profile({
  id = "profile-1",
  clerkUserId = "clerk-old",
  email = "owner@example.test",
  deletionStatus = AccountDeletionStatus.ACTIVE,
}: {
  id?: string;
  clerkUserId?: string;
  email?: string;
  deletionStatus?: string;
} = {}) {
  return {
    id,
    clerkUserId,
    email,
    displayName: "Owner",
    role: "user",
    preferredLanguage: "en",
    deletionStatus,
    deletedAt: deletionStatus === AccountDeletionStatus.ACTIVE ? null : new Date(),
  };
}

function p2002WithoutTarget() {
  return {
    code: "P2002",
    modelName: "UserProfile",
    driverAdapterError: { name: "UniqueConstraintViolation" },
  };
}

test("adapter-pg P2002 without meta.target becomes a typed recovery conflict", async () => {
  const existing = profile();
  const db = {
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        userProfile: {
          create: async () => {
            throw p2002WithoutTarget();
          },
        },
      }),
    userProfile: {
      findUnique: async ({ where }: { where: Record<string, string> }) =>
        where.email ? existing : null,
    },
  };

  await assert.rejects(
    freshProfile.createFreshUserProfile(db as never, {
      clerkUserId: "clerk-new",
      email: " OWNER@example.test ",
      displayName: "New owner",
      role: "user",
      preferredLanguage: "en",
      referralClaimToken: undefined,
    }),
    (error: unknown) =>
      freshProfile.isExistingEmailDifferentClerkIdentityError(error),
  );
});

test("a concurrent same-Clerk insert returns the active profile", async () => {
  const existing = profile({ clerkUserId: "clerk-new" });
  const db = {
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        userProfile: {
          create: async () => {
            throw p2002WithoutTarget();
          },
        },
      }),
    userProfile: {
      findUnique: async ({ where }: { where: Record<string, string> }) =>
        where.clerkUserId ? existing : null,
    },
  };

  const result = await freshProfile.createFreshUserProfile(db as never, {
    clerkUserId: "clerk-new",
    email: "owner@example.test",
    displayName: "New owner",
    role: "user",
    preferredLanguage: "en",
    referralClaimToken: undefined,
  });
  assert.equal(result, existing);
});

test("recovery and context responses use controlled, non-secret outcomes", async () => {
  const [route, context] = await Promise.all([
    readFile(
      new URL("../src/app/api/account/recover-orphaned-profile/route.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../src/app/api/user/context/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(route, /errorCode: "existing_active_account"/);
  assert.match(route, /errorCode: "recovery_in_progress"/);
  assert.match(route, /errorCode: "recovery_unavailable"/);
  assert.doesNotMatch(route, /error\.message/);
  assert.doesNotMatch(route, /console\.(log|error).*email/);
  assert.match(context, /status: 409/);
  assert.match(context, /Account recovery is required before continuing/);
});

test("recovery requires the existing account cleanup to finish before creation", () => {
  assert.match(
    recovery.recoverOrphanedUserProfile.toString(),
    /deletionStatus !== AccountDeletionStatus\.DELETED/,
  );
  assert.match(
    recovery.recoverOrphanedUserProfile.toString(),
    /replacementProfileId/,
  );
  assert.match(
    recovery.recoverOrphanedUserProfile.toString(),
    /onBeforeCommit/,
  );
});

test("recovery uses a bounded lease for pending profiles", () => {
  assert.equal(recovery.ORPHANED_PROFILE_RECOVERY_LEASE_MS, 5 * 60_000);
  assert.match(recovery.recoverOrphanedUserProfile.toString(), /hasRecentRecoveryLease/);
});
