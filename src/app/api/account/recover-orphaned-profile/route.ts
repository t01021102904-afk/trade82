import { clerkClient } from "@clerk/nextjs/server";

import {
  ApiValidationError,
  assertSameOrigin,
  rateLimitOrResponse,
  readJsonObject,
  rejectUnexpectedFields,
} from "@/lib/api-security";
import { apiError, logSafeApiError } from "@/lib/api-response";
import {
  resolveCurrentClerkUser,
  isConfirmedMissingClerkUserError,
} from "@/lib/clerk-identity";
import {
  OrphanedProfileRecoveryCleanupError,
  OrphanedProfileRecoveryClerkError,
  recoverOrphanedUserProfile,
} from "@/lib/orphaned-profile-recovery";

export const runtime = "nodejs";

function verifiedPrimaryEmail(user: Awaited<ReturnType<typeof resolveCurrentClerkUser>>) {
  const address = user?.primaryEmailAddress;
  const verification = address as
    | { verification?: { status?: unknown } }
    | null
    | undefined;
  if (
    !address?.emailAddress ||
    verification?.verification?.status !== "verified"
  ) {
    return null;
  }
  return address.emailAddress.trim().toLowerCase();
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const clerkUser = await resolveCurrentClerkUser();
    if (!clerkUser) {
      return Response.json(
        { errorCode: "authentication_required" },
        { status: 401 },
      );
    }

    const email = verifiedPrimaryEmail(clerkUser);
    if (!email) {
      return Response.json(
        { errorCode: "verified_email_required" },
        { status: 403 },
      );
    }

    const rateLimited = rateLimitOrResponse({
      request,
      scope: "account-recovery",
      userId: clerkUser.id,
      limit: 5,
      windowMs: 60 * 60_000,
    });
    if (rateLimited) return rateLimited;

    const body = await readJsonObject(request);
    rejectUnexpectedFields(body, new Set());

    const result = await recoverOrphanedUserProfile({
      currentClerkUserId: clerkUser.id,
      email,
      displayName:
        clerkUser.fullName || email.split("@")[0] || "Trade82 User",
      preferredLanguage:
        clerkUser.publicMetadata.preferredLanguage === "ko" ? "ko" : "en",
      findClerkUser: async (clerkUserId) => {
        const client = await clerkClient();
        return client.users.getUser(clerkUserId);
      },
    });

    switch (result.kind) {
      case "recovered":
      case "already_recovered":
        return Response.json({ ok: true });
      case "old_clerk_identity_exists":
        return Response.json(
          { errorCode: "existing_active_account" },
          { status: 409 },
        );
      case "recovery_in_progress":
        return Response.json(
          { errorCode: "recovery_in_progress" },
          { status: 409 },
        );
      case "not_found":
        return Response.json(
          { errorCode: "recovery_not_found" },
          { status: 404 },
        );
      case "not_available":
        return Response.json(
          { errorCode: "recovery_not_available" },
          { status: 409 },
        );
    }
  } catch (error) {
    if (error instanceof ApiValidationError) {
      return Response.json(
        { errorCode: "invalid_request" },
        { status: 400 },
      );
    }
    if (
      error instanceof OrphanedProfileRecoveryClerkError ||
      error instanceof OrphanedProfileRecoveryCleanupError ||
      isConfirmedMissingClerkUserError(error)
    ) {
      logSafeApiError(error);
      return Response.json(
        { errorCode: "recovery_unavailable" },
        { status: 503 },
      );
    }
    return apiError(error);
  }
}
