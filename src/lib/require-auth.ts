import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { getCurrentUserProfile, isAdminUser } from "@/lib/authz";
import type { AccountRole } from "@/lib/types";
import { safeInternalPath } from "@/lib/url-security";

type PublicMetadata = {
  role?: unknown;
  onboardingComplete?: unknown;
};

function localePrefix(pathname: string) {
  if (pathname.startsWith("/ko")) {
    return "/ko";
  }

  if (pathname.startsWith("/en")) {
    return "/en";
  }

  return "";
}

export function getUserRole(metadata: PublicMetadata): AccountRole | null {
  return metadata.role === "user" ||
    metadata.role === "buyer" ||
    metadata.role === "seller" ||
    metadata.role === "both" ||
    metadata.role === "admin"
    ? metadata.role
    : null;
}

export async function requireAuth(redirectUrl: string) {
  const { userId } = await auth();

  if (!userId) {
    const prefix = localePrefix(redirectUrl);
    const fallback = `${prefix || ""}/dashboard`;
    const safeRedirectUrl = safeInternalPath(redirectUrl, fallback);
    redirect(`${prefix}/login?redirect_url=${encodeURIComponent(safeRedirectUrl)}`);
  }
}

export async function requireAppProfile(redirectUrl: string) {
  await requireAuth(redirectUrl);

  const [clerkUser, profile] = await Promise.all([
    currentUser(),
    getCurrentUserProfile(),
  ]);
  const prefix = localePrefix(redirectUrl);
  const metadata = (clerkUser?.publicMetadata ?? {}) as PublicMetadata;
  const role = profile?.role ?? "user";

  if (role === "user") {
    redirect(`${prefix}/onboarding/role`);
  }

  if (
    (role === "seller" || role === "buyer" || role === "both") &&
    metadata.onboardingComplete !== true
  ) {
    const onboardingRole = role === "both" ? "seller" : role;
    redirect(`${prefix}/onboarding/${onboardingRole}`);
  }

  return { role };
}

export async function requireOnboardingRole(
  redirectUrl: string,
  expectedRole: AccountRole,
) {
  await requireAuth(redirectUrl);

  const [clerkUser, profile] = await Promise.all([
    currentUser(),
    getCurrentUserProfile(),
  ]);
  const prefix = localePrefix(redirectUrl);
  const metadata = (clerkUser?.publicMetadata ?? {}) as PublicMetadata;
  const role = profile?.role ?? "user";

  if (role === "user") {
    redirect(`${prefix}/onboarding/role`);
  }

  if (role === "admin") {
    redirect(`${prefix}/admin`);
  }

  if (role !== expectedRole && role !== "both") {
    redirect(`${prefix}/onboarding/${role}`);
  }

  if (metadata.onboardingComplete === true) {
    redirect(`${prefix}/dashboard`);
  }

  return { role };
}

export async function requireDashboardRole(
  redirectUrl: string,
  expectedRole: "seller" | "buyer",
) {
  const { role } = await requireAppProfile(redirectUrl);

  if (role !== expectedRole && role !== "both") {
    const prefix = localePrefix(redirectUrl);
    redirect(`${prefix}/dashboard`);
  }

  return { role: expectedRole };
}

export async function requireAdmin(redirectUrl: string) {
  await requireAuth(redirectUrl);

  if (!(await isAdminUser())) {
    const prefix = localePrefix(redirectUrl);
    redirect(`${prefix}/dashboard`);
  }

  const user = await currentUser();
  return { email: user?.primaryEmailAddress?.emailAddress ?? "" };
}
