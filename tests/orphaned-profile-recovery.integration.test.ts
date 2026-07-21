import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, test } from "node:test";

import type { PrismaClient } from "../src/generated/prisma/client.ts";

const databaseUrl = process.env.DATABASE_URL;
assert.ok(databaseUrl, "DATABASE_URL is required for this integration suite.");
const database = new URL(databaseUrl);
assert.ok(
  ["127.0.0.1", "localhost", "::1"].includes(database.hostname),
  "The recovery integration suite must use localhost PostgreSQL.",
);
assert.match(
  database.pathname.slice(1),
  /^trade82_order_payout_test_[a-z0-9_-]+$/i,
  "The recovery integration database must be disposable.",
);
assert.doesNotMatch(database.hostname, /supabase|neon|aws|vercel|render|railway|fly/i);

const { getDb } = await import(new URL("../src/lib/db.ts", import.meta.url).href);
const { AccountDeletionStatus } = await import(
  new URL("../src/generated/prisma/client.ts", import.meta.url).href,
);
const { recoverOrphanedUserProfile, OrphanedProfileRecoveryClerkError } =
  await import(new URL("../src/lib/orphaned-profile-recovery.ts", import.meta.url).href);

const db = getDb() as PrismaClient;

after(async () => {
  await db.$disconnect();
});

function suffix() {
  return randomBytes(8).toString("hex");
}

function missingClerkUser() {
  return {
    status: 404,
    errors: [{ code: "resource_not_found" }],
    isClerkAPIResponseError: () => true,
  };
}

function cleanupResult(profileId: string, clerkUserId: string) {
  return {
    userProfileId: profileId,
    clerkUserId,
    companyCount: 0,
    productCount: 0,
    messageAttachmentCount: 0,
    publicStorageDeleteCount: 0,
    privateStorageDeleteCount: 0,
    failedStorageDeleteCount: 0,
    deletionStatus: AccountDeletionStatus.DELETED,
  };
}

async function createOldProfile(id: string) {
  return db.userProfile.create({
    data: {
      clerkUserId: `clerk-old-${id}`,
      email: `recovery-${id}@example.test`,
      displayName: "Old owner",
      role: "user",
    },
  });
}

test("missing old Clerk identity is anonymized before one fresh profile is created", async () => {
  const id = suffix();
  const oldProfile = await createOldProfile(id);
  const currentClerkUserId = `clerk-new-${id}`;
  let cleanupCalls = 0;

  try {
    const result = await recoverOrphanedUserProfile({
      db: db as never,
      currentClerkUserId,
      email: oldProfile.email,
      displayName: "Fresh owner",
      preferredLanguage: "en",
      findClerkUser: async () => {
        throw missingClerkUser();
      },
      cleanup: async ({ userProfileId, clerkUserId }: { userProfileId: string; clerkUserId: string }) => {
        cleanupCalls += 1;
        await db.userProfile.update({
          where: { id: userProfileId },
          data: {
            clerkUserId: `deleted:${userProfileId}`,
            email: `deleted-${userProfileId}@deleted.trade82.local`,
            deletionStatus: AccountDeletionStatus.DELETED,
            deletedAt: new Date(),
          },
        });
        return cleanupResult(userProfileId, clerkUserId);
      },
    });

    assert.equal(result.kind, "recovered");
    assert.equal(cleanupCalls, 1);
    const [oldState, activeProfiles] = await Promise.all([
      db.userProfile.findUnique({ where: { id: oldProfile.id } }),
      db.userProfile.findMany({
        where: { email: oldProfile.email, deletionStatus: AccountDeletionStatus.ACTIVE },
      }),
    ]);
    assert.equal(oldState?.deletionStatus, AccountDeletionStatus.DELETED);
    assert.equal(oldState?.clerkUserId, `deleted:${oldProfile.id}`);
    assert.equal(activeProfiles.length, 1);
    assert.equal(activeProfiles[0]?.clerkUserId, currentClerkUserId);
    assert.equal(activeProfiles[0]?.role, "user");
  } finally {
    const profiles = await db.userProfile.findMany({
      where: { OR: [{ id: oldProfile.id }, { email: oldProfile.email }] },
      select: { id: true },
    });
    await db.userProfile.deleteMany({ where: { id: { in: profiles.map((profile) => profile.id) } } });
  }
});

test("existing old Clerk identity and unknown Clerk failures do not mutate the profile", async () => {
  for (const mode of ["exists", "unknown"] as const) {
    const id = suffix();
    const oldProfile = await createOldProfile(id);
    try {
      if (mode === "exists") {
        const result = await recoverOrphanedUserProfile({
          db: db as never,
          currentClerkUserId: `clerk-new-${id}`,
          email: oldProfile.email,
          displayName: "Fresh owner",
          preferredLanguage: "en",
          findClerkUser: async () => ({ id: oldProfile.clerkUserId }),
        });
        assert.deepEqual(result, { kind: "old_clerk_identity_exists" });
      } else {
        await assert.rejects(
          recoverOrphanedUserProfile({
            db: db as never,
            currentClerkUserId: `clerk-new-${id}`,
            email: oldProfile.email,
            displayName: "Fresh owner",
            preferredLanguage: "en",
            findClerkUser: async () => {
              throw new Error("temporary Clerk failure");
            },
          }),
          OrphanedProfileRecoveryClerkError,
        );
      }
      const unchanged = await db.userProfile.findUnique({ where: { id: oldProfile.id } });
      assert.equal(unchanged?.deletionStatus, AccountDeletionStatus.ACTIVE);
      assert.equal(unchanged?.email, oldProfile.email);
    } finally {
      await db.userProfile.delete({ where: { id: oldProfile.id } });
    }
  }
});

test("two concurrent recoveries claim one old profile and create one new profile", async () => {
  const id = suffix();
  const oldProfile = await createOldProfile(id);
  const currentClerkUserId = `clerk-new-${id}`;
  let cleanupCalls = 0;

  try {
    const options = {
      db: db as never,
      currentClerkUserId,
      email: oldProfile.email,
      displayName: "Fresh owner",
      preferredLanguage: "en" as const,
      findClerkUser: async () => {
        throw missingClerkUser();
      },
      cleanup: async ({ userProfileId, clerkUserId }: { userProfileId: string; clerkUserId: string }) => {
        cleanupCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 50));
        await db.userProfile.update({
          where: { id: userProfileId },
          data: {
            clerkUserId: `deleted:${userProfileId}`,
            email: `deleted-${userProfileId}@deleted.trade82.local`,
            deletionStatus: AccountDeletionStatus.DELETED,
            deletedAt: new Date(),
          },
        });
        return cleanupResult(userProfileId, clerkUserId);
      },
    };

    const results = await Promise.all([
      recoverOrphanedUserProfile(options),
      recoverOrphanedUserProfile(options),
    ]);
    assert.equal(cleanupCalls, 1);
    assert.equal(results.filter((result) => result.kind === "recovered").length, 1);
    assert.equal(results.filter((result) => result.kind === "recovery_in_progress").length, 1);
    assert.equal(
      await db.userProfile.count({
        where: { email: oldProfile.email, deletionStatus: AccountDeletionStatus.ACTIVE },
      }),
      1,
    );
  } finally {
    await db.userProfile.deleteMany({ where: { email: oldProfile.email } });
    await db.userProfile.deleteMany({ where: { clerkUserId: `deleted:${oldProfile.id}` } });
  }
});
