import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { getCurrentUserProfile, isAdminUser } from "@/lib/authz";
import { getDb } from "@/lib/db";
import {
  getOnboardingCompanyState,
  inferRoleFromCompanyState,
  isOnboardingCompleteForRole,
  onboardingRoleSegment,
} from "@/lib/onboarding-status";
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

async function resolveOnboardingState(
  profile: Awaited<ReturnType<typeof getCurrentUserProfile>>,
  metadata: PublicMetadata,
) {
  const metadataComplete = metadata.onboardingComplete === true;
  const companyState = profile
    ? await getOnboardingCompanyState(profile.id)
    : { hasBuyerCompany: false, hasSellerCompany: false };
  const inferredRole = inferRoleFromCompanyState(companyState);
  let role = profile?.role ?? "user";

  if (profile && role === "user" && inferredRole) {
    role = inferredRole;
    await getDb().userProfile.update({
      where: { id: profile.id },
      data: { role },
    });
  }

  return {
    role,
    onboardingComplete: isOnboardingCompleteForRole(
      role,
      companyState,
      metadataComplete,
    ),
  };
}

async function syncClerkOnboardingMetadata(
  clerkUserId: string | undefined,
  metadata: PublicMetadata,
  role: AccountRole,
  onboardingComplete: boolean,
) {
  if (!clerkUserId || role === "user") return;
  if (
    metadata.role === role &&
    metadata.onboardingComplete === onboardingComplete
  ) {
    return;
  }

  try {
    const client = await clerkClient();
    await client.users.updateUserMetadata(clerkUserId, {
      publicMetadata: {
        ...(metadata as Record<string, unknown>),
        role,
        onboardingComplete,
      },
    });
  } catch {
    console.warn("Unable to sync Clerk onboarding metadata from app profile.");
  }
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
  const { role, onboardingComplete } = await resolveOnboardingState(
    profile,
    metadata,
  );

  if (role === "user") {
    redirect(`${prefix}/onboarding/role`);
  }

  if (
    (role === "seller" || role === "buyer" || role === "both") &&
    !onboardingComplete
  ) {
    const onboardingRole = onboardingRoleSegment(role);
    redirect(`${prefix}/onboarding/${onboardingRole}`);
  }

  await syncClerkOnboardingMetadata(
    clerkUser?.id,
    metadata,
    role,
    onboardingComplete,
  );

  return { role };
}

export async function requireOnboardingEntry(redirectUrl: string) {
  await requireAuth(redirectUrl);

  const [clerkUser, profile] = await Promise.all([
    currentUser(),
    getCurrentUserProfile(),
  ]);
  const prefix = localePrefix(redirectUrl);
  const metadata = (clerkUser?.publicMetadata ?? {}) as PublicMetadata;
  const { role, onboardingComplete } = await resolveOnboardingState(
    profile,
    metadata,
  );

  if (role === "user") return { role };
  if (role === "admin") redirect(`${prefix}/admin`);

  await syncClerkOnboardingMetadata(
    clerkUser?.id,
    metadata,
    role,
    onboardingComplete,
  );

  if (onboardingComplete) {
    redirect(`${prefix}/dashboard`);
  }

  redirect(`${prefix}/onboarding/${onboardingRoleSegment(role)}`);
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
  const { role, onboardingComplete } = await resolveOnboardingState(
    profile,
    metadata,
  );

  if (role === "user") {
    redirect(`${prefix}/onboarding/role`);
  }

  if (role === "admin") {
    redirect(`${prefix}/admin`);
  }

  if (role !== expectedRole && role !== "both") {
    redirect(`${prefix}/onboarding/${role}`);
  }

  await syncClerkOnboardingMetadata(
    clerkUser?.id,
    metadata,
    role,
    onboardingComplete,
  );

  if (onboardingComplete) {
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
