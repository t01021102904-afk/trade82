import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";

export async function POST() {
  const { userId } = await auth();

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await currentUser();
  const role = user?.publicMetadata?.role;

  if (role !== "buyer" && role !== "seller") {
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
