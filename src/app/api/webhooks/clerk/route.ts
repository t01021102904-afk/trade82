import { verifyWebhook } from "@clerk/nextjs/webhooks";

import { apiError } from "@/lib/api-response";
import {
  cleanupTrade82AccountData,
  markAccountDeletionPending,
} from "@/lib/account-deletion";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const event = await verifyWebhook(
      request as Parameters<typeof verifyWebhook>[0],
    );

    if (event.type === "user.deleted" && event.data.id) {
      const profile = await getDb().userProfile.findUnique({
        where: { clerkUserId: event.data.id },
        select: { id: true },
      });
      if (profile) {
        await markAccountDeletionPending(profile.id);
        await cleanupTrade82AccountData({
          userProfileId: profile.id,
          clerkUserId: event.data.id,
        });
      }
    }

    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof Error) {
      console.warn("Clerk webhook rejected.", { error: error.name });
    }
    return apiError(new Response("Forbidden", { status: 403 }));
  }
}
