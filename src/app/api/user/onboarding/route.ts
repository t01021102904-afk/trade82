import { auth, clerkClient } from "@clerk/nextjs/server";

import { rateLimitOrResponse } from "@/lib/api-security";
import { getCurrentUserProfile } from "@/lib/authz";

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rateLimited = rateLimitOrResponse({
    request,
    scope: "user-onboarding",
    userId,
    limit: 20,
    windowMs: 60 * 60_000,
  });
  if (rateLimited) return rateLimited;

  const profile = await getCurrentUserProfile();
  const role = profile?.role;

  if (role !== "buyer" && role !== "seller" && role !== "both") {
    return Response.json({ error: "Missing role" }, { status: 400 });
  }

  const client = await clerkClient();

  await client.users.updateUserMetadata(userId, {
    publicMetadata: {
      role,
      onboardingComplete: true,
    },
  });

  return Response.json({ ok: true, role });
}
