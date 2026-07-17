import { currentUser } from "@clerk/nextjs/server";

import {
  getCurrentDeletionProfile,
  getCurrentUserProfile,
  isAdminEmail,
  requireAuth,
} from "@/lib/authz";

export async function getCurrentAppUser() {
  return getCurrentUserProfile();
}

export async function requireCurrentAppUser() {
  return requireAuth();
}

export async function requireCurrentDeletionAppUser() {
  const user = await getCurrentDeletionProfile();
  if (!user) throw new Response("Unauthorized", { status: 401 });
  return user;
}

export function getClerkEmails(
  clerkUser: Awaited<ReturnType<typeof currentUser>>,
) {
  const primaryEmail = clerkUser?.primaryEmailAddress?.emailAddress;
  return primaryEmail ? [primaryEmail.toLowerCase()] : [];
}

export function isCurrentUserAdmin(
  clerkUser: Awaited<ReturnType<typeof currentUser>>,
) {
  return isAdminEmail(clerkUser?.primaryEmailAddress?.emailAddress);
}

export { isAdminEmail };
