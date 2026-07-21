import assert from "node:assert/strict";
import test from "node:test";

const { isConfirmedMissingClerkUserError, resolveClerkIdentity } = await import(
  new URL("../src/lib/clerk-identity-resolver.ts", import.meta.url).href,
);

function missingUserError(code = "resource_not_found") {
  return {
    status: 404,
    errors: [{ code }],
    isClerkAPIResponseError: () => true,
  };
}

function clerkUser(id: string) {
  return {
    id,
    primaryEmailAddress: { emailAddress: "fresh@example.test" },
    publicMetadata: {},
    fullName: "Fresh User",
  } as never;
}

test("a confirmed missing Clerk user is treated as a stale session", async () => {
  let currentUserCalls = 0;
  const result = await resolveClerkIdentity({
    getAuth: async () => ({ userId: "user_deleted" }),
    getCurrentUser: async () => {
      currentUserCalls += 1;
      throw missingUserError();
    },
  });

  assert.equal(result, null);
  assert.equal(currentUserCalls, 1);
  assert.equal(isConfirmedMissingClerkUserError(missingUserError()), true);
});

test("a valid Clerk user is returned and can be passed through once", async () => {
  const user = clerkUser("user_fresh");
  let currentUserCalls = 0;
  const result = await resolveClerkIdentity({
    getAuth: async () => ({ userId: "user_fresh" }),
    getCurrentUser: async () => {
      currentUserCalls += 1;
      return user;
    },
  });

  assert.equal(result, user);
  assert.equal(currentUserCalls, 1);
});

test("unknown Clerk failures are rethrown", async () => {
  const failure = new Error("Clerk service unavailable");

  await assert.rejects(
    resolveClerkIdentity({
      getAuth: async () => ({ userId: "user_unknown_failure" }),
      getCurrentUser: async () => {
        throw failure;
      },
    }),
    failure,
  );
  assert.equal(isConfirmedMissingClerkUserError({ status: 404 }), false);
});

test("unexpected Clerk 404 codes are not converted to signed-out state", async () => {
  const failure = {
    status: 404,
    errors: [{ code: "organization_not_found" }],
    isClerkAPIResponseError: () => true,
  };

  await assert.rejects(
    resolveClerkIdentity({
      getAuth: async () => ({ userId: "user_unexpected_404" }),
      getCurrentUser: async () => {
        throw failure;
      },
    }),
    failure,
  );
});

test("a mismatched Clerk identity is treated as invalid session state", async () => {
  const result = await resolveClerkIdentity({
    getAuth: async () => ({ userId: "user_from_session" }),
    getCurrentUser: async () => clerkUser("different_user"),
  });

  assert.equal(result, null);
});
