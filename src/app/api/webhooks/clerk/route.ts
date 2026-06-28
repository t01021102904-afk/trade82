import { verifyWebhook } from "@clerk/nextjs/webhooks";

import { apiError } from "@/lib/api-response";
import { cleanupTrade82AccountData } from "@/lib/account-deletion";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const event = await verifyWebhook(
      request as Parameters<typeof verifyWebhook>[0],
    );

    if (event.type === "user.deleted" && event.data.id) {
      await cleanupTrade82AccountData({ clerkUserId: event.data.id });
    }

    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof Error) {
      console.warn("Clerk webhook rejected.", { error: error.name });
    }
    return apiError(new Response("Forbidden", { status: 403 }));
  }
}
