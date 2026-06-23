import { auth, clerkClient } from "@clerk/nextjs/server";

import { getCurrentUserProfile, isAdminUser } from "@/lib/authz";
import { getDb } from "@/lib/db";

const validRoles = new Set(["buyer", "seller"]);

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { role?: unknown } | null;
  const role = body?.role;

  if (typeof role !== "string" || !validRoles.has(role)) {
    return Response.json({ error: "Invalid role" }, { status: 400 });
  }
  if (await isAdminUser()) {
    return Response.json({ error: "Admin role is managed by ADMIN_EMAILS." }, { status: 403 });
  }

  const client = await clerkClient();

  await client.users.updateUserMetadata(userId, {
    publicMetadata: {
      role,
      onboardingComplete: false,
    },
  });
  const profile = await getCurrentUserProfile();
  if (profile) {
    await getDb().userProfile.update({
      where: { id: profile.id },
      data: { role: role === "seller" ? "seller" : "buyer" },
    });
  }

  return Response.json({ ok: true, role });
}
