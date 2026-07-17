import { clerkClient } from "@clerk/nextjs/server";

import { apiError } from "@/lib/api-response";
import {
  ApiValidationError,
  rateLimitOrResponse,
  readJsonObject,
  rejectUnexpectedFields,
  stringField,
  validationError,
  validationErrorResponse,
} from "@/lib/api-security";
import { requireCurrentDeletionAppUser } from "@/lib/current-app-user";
import {
  cleanupTrade82AccountData,
  markAccountDeletionPending,
} from "@/lib/account-deletion";
import {
  canReportAccountDeletionSuccess,
  isAlreadyDeletedInClerk,
} from "@/lib/account-deletion-rules";

export const runtime = "nodejs";

const CONFIRMATION_PHRASES = new Set(["DELETE MY ACCOUNT", "계정 탈퇴"]);

function logSafeAccountDeletionFailure(error: unknown) {
  console.warn("Trade82 account deletion could not be finalized.", {
    error: error instanceof Error ? error.name : typeof error,
  });
}

export async function POST(request: Request) {
  try {
    const user = await requireCurrentDeletionAppUser();
    const rateLimited = rateLimitOrResponse({
      request,
      scope: "account-delete",
      userId: user.id,
      limit: 3,
      windowMs: 60 * 60_000,
    });
    if (rateLimited) return rateLimited;

    const body = await readJsonObject(request);
    rejectUnexpectedFields(body, new Set(["confirmation"]));
    const confirmation = stringField(body, "confirmation", {
      max: 64,
      required: true,
    }) as string;
    if (!CONFIRMATION_PHRASES.has(confirmation)) {
      throw validationError("Confirmation text does not match.");
    }

    const clerkUserId = user.clerkUserId;
    await markAccountDeletionPending(user.id);
    try {
      const client = await clerkClient();
      await client.users.deleteUser(clerkUserId);
    } catch (error) {
      if (!isAlreadyDeletedInClerk(error)) {
        logSafeAccountDeletionFailure(error);
        return Response.json(
          { error: "Account deletion could not be completed. Please try again." },
          { status: 503 },
        );
      }
      // A verified 404 is idempotent: Clerk already removed this identity, so
      // it is safe to finish the local tombstone cleanup.
    }

    let cleanup;
    try {
      cleanup = await cleanupTrade82AccountData({
        userProfileId: user.id,
        clerkUserId,
      });
    } catch (error) {
      logSafeAccountDeletionFailure(error);
      return Response.json(
        { error: "Account deletion is being finalized. Please contact support if this persists." },
        { status: 503 },
      );
    }

    if (!canReportAccountDeletionSuccess({
      clerkDeletionConfirmed: true,
      deletionStatus: cleanup.deletionStatus,
    })) {
      return Response.json(
        { error: "Account deletion is being finalized. Please contact support if this persists." },
        { status: 503 },
      );
    }

    return Response.json({
      ok: true,
      deletionStatus: "DELETED",
      cleanup: {
        companyCount: cleanup.companyCount,
        productCount: cleanup.productCount,
        messageAttachmentCount: cleanup.messageAttachmentCount,
        publicStorageDeleteCount: cleanup.publicStorageDeleteCount,
        privateStorageDeleteCount: cleanup.privateStorageDeleteCount,
        failedStorageDeleteCount: cleanup.failedStorageDeleteCount,
      },
    });
  } catch (error) {
    if (error instanceof ApiValidationError) {
      return validationErrorResponse(error);
    }
    return apiError(error);
  }
}
