import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const rules = await import(
  new URL("../src/lib/account-deletion-rules.ts", import.meta.url).href,
);
const orchestration = await import(
  new URL("../src/lib/account-deletion-orchestration.ts", import.meta.url).href,
);
const [deleteRoute, authz, onboardingStatus, deletionUi] = await Promise.all([
  readFile(new URL("../src/app/api/account/delete/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/authz.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/onboarding-status.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/components/delete-account-danger-zone.tsx", import.meta.url), "utf8"),
]);

test("only a verified Clerk deletion and a DELETED tombstone can report success", () => {
  assert.equal(rules.canReportAccountDeletionSuccess({ clerkDeletionConfirmed: true, deletionStatus: "DELETED" }), true);
  assert.equal(rules.canReportAccountDeletionSuccess({ clerkDeletionConfirmed: false, deletionStatus: "DELETED" }), false);
  assert.equal(rules.canReportAccountDeletionSuccess({ clerkDeletionConfirmed: true, deletionStatus: "DELETION_PENDING" }), false);
});

test("only Clerk not-found responses are idempotent deletion evidence", () => {
  assert.equal(rules.isAlreadyDeletedInClerk({ status: 404 }), true);
  assert.equal(rules.isAlreadyDeletedInClerk({ errors: [{ code: "user_not_found" }] }), true);
  assert.equal(rules.isAlreadyDeletedInClerk({ status: 500 }), false);
  assert.equal(rules.isAlreadyDeletedInClerk({ errors: [{ code: "internal_error" }] }), false);
});

function deletedCleanupResult() {
  return {
    userProfileId: "profile-1",
    clerkUserId: "user_1",
    companyCount: 0,
    productCount: 0,
    messageAttachmentCount: 0,
    publicStorageDeleteCount: 0,
    privateStorageDeleteCount: 0,
    failedStorageDeleteCount: 0,
    deletionStatus: "DELETED" as const,
  };
}

test("Clerk deletion failure returns a non-success attempt without cleanup", async () => {
  const calls: string[] = [];
  const result = await orchestration.deleteAccountAfterVerifiedClerk({
    markPending: async () => { calls.push("pending"); },
    deleteClerkUser: async () => {
      calls.push("clerk");
      throw { status: 500 };
    },
    cleanup: async () => {
      calls.push("cleanup");
      return deletedCleanupResult();
    },
  });
  assert.deepEqual(calls, ["pending", "clerk"]);
  assert.deepEqual(result.ok, false);
  if (!result.ok) assert.equal(result.stage, "clerk");
});

test("only verified Clerk deletion can run cleanup and report success", async () => {
  const calls: string[] = [];
  const result = await orchestration.deleteAccountAfterVerifiedClerk({
    markPending: async () => { calls.push("pending"); },
    deleteClerkUser: async () => { calls.push("clerk"); },
    cleanup: async () => {
      calls.push("cleanup");
      return deletedCleanupResult();
    },
  });
  assert.deepEqual(calls, ["pending", "clerk", "cleanup"]);
  assert.equal(result.ok, true);
});

test("delete API returns a controlled non-2xx response for failed stages", () => {
  assert.match(deleteRoute, /deleteAccountAfterVerifiedClerk/);
  assert.match(deleteRoute, /status: 503/);
});

test("deleted and pending profiles are never relinked by Clerk ID or email", () => {
  assert.match(authz, /existingByClerkId\.deletionStatus !== AccountDeletionStatus\.ACTIVE/);
  assert.match(authz, /existingByEmail\.deletionStatus !== AccountDeletionStatus\.ACTIVE/);
  assert.match(onboardingStatus, /ownerUserId: userProfileId, deletedAt: null/);
});

test("successful deletion clears browser state then hard-redirects to role selection", () => {
  assert.match(deletionUi, /trade82_referral_claim=; Max-Age=0/);
  assert.match(deletionUi, /window\.localStorage/);
  assert.match(deletionUi, /window\.sessionStorage/);
  assert.match(deletionUi, /onboarding\/role/);
  assert.match(deletionUi, /window\.location\.replace\(redirectUrl\)/);
  assert.doesNotMatch(deletionUi, /setSuccess\(/);
});
