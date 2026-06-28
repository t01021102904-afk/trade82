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
import { requireCurrentAppUser } from "@/lib/current-app-user";
import { cleanupTrade82AccountData } from "@/lib/account-deletion";

export const runtime = "nodejs";

const CONFIRMATION_PHRASES = new Set(["DELETE MY ACCOUNT", "계정 탈퇴"]);

function logSafeClerkDeletionFailure(error: unknown) {
  console.warn("Clerk account deletion failed after Trade82 cleanup.", {
    error: error instanceof Error ? error.name : typeof error,
  });
}

export async function POST(request: Request) {
  try {
    const user = await requireCurrentAppUser();
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
    const cleanup = await cleanupTrade82AccountData({
      userProfileId: user.id,
      clerkUserId,
    });

    let clerkDeleted = false;
    try {
      const client = await clerkClient();
      await client.users.deleteUser(clerkUserId);
      clerkDeleted = true;
    } catch (error) {
      logSafeClerkDeletionFailure(error);
    }

    return Response.json({
      ok: true,
      clerkDeleted,
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
