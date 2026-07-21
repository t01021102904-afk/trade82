import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, test } from "node:test";

import type { StorageFileTarget } from "../src/lib/account-deletion.ts";
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
const {
  ORPHANED_PROFILE_RECOVERY_LEASE_MS,
  recoverOrphanedUserProfile,
  OrphanedProfileRecoveryClerkError,
} =
  await import(new URL("../src/lib/orphaned-profile-recovery.ts", import.meta.url).href);
const { cleanupTrade82AccountData } = await import(
  new URL("../src/lib/account-deletion.ts", import.meta.url).href,
);

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
      cleanup: async (target: Parameters<typeof cleanupTrade82AccountData>[0]) => {
        cleanupCalls += 1;
        return cleanupTrade82AccountData(target);
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
      cleanup: async (target: Parameters<typeof cleanupTrade82AccountData>[0]) => {
        cleanupCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 50));
        return cleanupTrade82AccountData(target);
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

test("replacement failure rolls back anonymization and leaves no new profile", async () => {
  const id = suffix();
  const oldProfile = await createOldProfile(id);
  const currentClerkUserId = `clerk-new-${id}`;

  try {
    await assert.rejects(
      recoverOrphanedUserProfile({
        db: db as never,
        currentClerkUserId,
        email: oldProfile.email,
        displayName: "Fresh owner",
        preferredLanguage: "en",
        findClerkUser: async () => {
          throw missingClerkUser();
        },
        createReplacementProfile: async () => {
          throw new Error("injected replacement failure");
        },
      }),
    );

    const unchanged = await db.userProfile.findUnique({ where: { id: oldProfile.id } });
    assert.equal(unchanged?.deletionStatus, AccountDeletionStatus.DELETION_PENDING);
    assert.equal(unchanged?.email, oldProfile.email);
    assert.equal(unchanged?.clerkUserId, oldProfile.clerkUserId);
    assert.equal(
      await db.userProfile.count({ where: { clerkUserId: currentClerkUserId } }),
      0,
    );
  } finally {
    await db.userProfile.deleteMany({ where: { clerkUserId: currentClerkUserId } });
    await db.userProfile.delete({ where: { id: oldProfile.id } });
  }
});

test("recent pending leases block recovery without cleanup or Clerk lookup", async () => {
  const id = suffix();
  const oldProfile = await createOldProfile(id);
  const currentClerkUserId = `clerk-new-${id}`;
  const requestedAt = new Date(Date.now() - ORPHANED_PROFILE_RECOVERY_LEASE_MS + 1_000);
  let clerkLookups = 0;

  try {
    await db.userProfile.update({
      where: { id: oldProfile.id },
      data: {
        deletionStatus: AccountDeletionStatus.DELETION_PENDING,
        deletionRequestedAt: requestedAt,
      },
    });

    const result = await recoverOrphanedUserProfile({
      db: db as never,
      currentClerkUserId,
      email: oldProfile.email,
      displayName: "Fresh owner",
      preferredLanguage: "en",
      findClerkUser: async () => {
        clerkLookups += 1;
        throw missingClerkUser();
      },
    });
    assert.deepEqual(result, { kind: "recovery_in_progress" });
    assert.equal(clerkLookups, 0);
    assert.equal(await db.userProfile.count({ where: { clerkUserId: currentClerkUserId } }), 0);
  } finally {
    await db.userProfile.deleteMany({ where: { clerkUserId: currentClerkUserId } });
    await db.userProfile.delete({ where: { id: oldProfile.id } });
  }
});

test("expired pending leases reverify the old identity and resume recovery", async () => {
  const id = suffix();
  const oldProfile = await createOldProfile(id);
  const currentClerkUserId = `clerk-new-${id}`;
  const expiredAt = new Date(Date.now() - ORPHANED_PROFILE_RECOVERY_LEASE_MS - 1_000);
  let clerkLookups = 0;

  try {
    await db.userProfile.update({
      where: { id: oldProfile.id },
      data: {
        deletionStatus: AccountDeletionStatus.DELETION_PENDING,
        deletionRequestedAt: expiredAt,
      },
    });

    const result = await recoverOrphanedUserProfile({
      db: db as never,
      currentClerkUserId,
      email: oldProfile.email,
      displayName: "Fresh owner",
      preferredLanguage: "ko",
      findClerkUser: async () => {
        clerkLookups += 1;
        throw missingClerkUser();
      },
    });
    assert.equal(result.kind, "recovered");
    assert.equal(clerkLookups, 1);
    assert.equal(
      await db.userProfile.count({
        where: { email: oldProfile.email, deletionStatus: AccountDeletionStatus.ACTIVE },
      }),
      1,
    );
  } finally {
    await db.userProfile.deleteMany({ where: { clerkUserId: currentClerkUserId } });
    await db.userProfile.deleteMany({ where: { id: oldProfile.id } });
  }
});

test("retry after a committed replacement returns already_recovered without cleanup", async () => {
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
      cleanup: async (target: Parameters<typeof cleanupTrade82AccountData>[0]) => {
        cleanupCalls += 1;
        return cleanupTrade82AccountData(target);
      },
    };

    const first = await recoverOrphanedUserProfile(options);
    const second = await recoverOrphanedUserProfile(options);
    assert.equal(first.kind, "recovered");
    assert.equal(second.kind, "already_recovered");
    assert.equal(cleanupCalls, 1);
    assert.equal(
      await db.userProfile.count({ where: { clerkUserId: currentClerkUserId } }),
      1,
    );
    assert.equal(
      await db.userProfile.count({
        where: {
          email: { startsWith: "deleted-" },
          clerkUserId: { startsWith: "deleted:" },
          deletionStatus: AccountDeletionStatus.DELETED,
        },
      }),
      1,
    );
  } finally {
    await db.userProfile.deleteMany({ where: { clerkUserId: currentClerkUserId } });
    await db.userProfile.deleteMany({ where: { id: oldProfile.id } });
  }
});

test("storage cleanup failure after commit preserves the replacement and is idempotent", async () => {
  const id = suffix();
  const oldProfile = await createOldProfile(id);
  const currentClerkUserId = `clerk-new-${id}`;
  let cleanupCalls = 0;
  let storageDeleteCalls = 0;
  let failedStorageDeleteCount = 0;

  await db.userProfile.update({
    where: { id: oldProfile.id },
    data: {
      avatarUrl: `https://storage.example.test/storage/v1/object/public/marketplace-assets/profile-avatars/${id}/avatar.webp`,
    },
  });

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
      cleanup: async (target: Parameters<typeof cleanupTrade82AccountData>[0]) => {
        cleanupCalls += 1;
        const result = await cleanupTrade82AccountData(target, {
          deleteStorageFiles: async (files: StorageFileTarget[]) => {
            storageDeleteCalls += 1;
            assert.equal(files.length, 1);
            const failed = files.length;
            failedStorageDeleteCount += failed;
            return {
              publicStorageDeleteCount: 0,
              privateStorageDeleteCount: 0,
              failedStorageDeleteCount: failed,
            };
          },
        });
        return result;
      },
    };

    const first = await recoverOrphanedUserProfile(options);
    assert.equal(first.kind, "recovered");
    assert.equal(cleanupCalls, 1);
    assert.equal(storageDeleteCalls, 1);
    assert.equal(failedStorageDeleteCount, 1);

    const [oldState, replacement] = await Promise.all([
      db.userProfile.findUnique({ where: { id: oldProfile.id } }),
      db.userProfile.findUnique({ where: { clerkUserId: currentClerkUserId } }),
    ]);
    assert.equal(oldState?.deletionStatus, AccountDeletionStatus.DELETED);
    assert.equal(oldState?.email, `deleted-${oldProfile.id}@deleted.trade82.local`);
    assert.equal(oldState?.clerkUserId, `deleted:${oldProfile.id}`);
    assert.equal(replacement?.deletionStatus, AccountDeletionStatus.ACTIVE);

    const second = await recoverOrphanedUserProfile(options);
    assert.deepEqual(second, { kind: "already_recovered", profileId: replacement?.id });
    assert.equal(cleanupCalls, 1);
    assert.equal(storageDeleteCalls, 1);
  } finally {
    await db.userProfile.deleteMany({ where: { clerkUserId: currentClerkUserId } });
    await db.userProfile.deleteMany({ where: { id: oldProfile.id } });
  }
});
