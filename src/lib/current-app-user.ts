import { currentUser } from "@clerk/nextjs/server";

import {
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
