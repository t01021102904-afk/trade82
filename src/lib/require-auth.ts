import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { getCurrentUserProfile, isAdminUser } from "@/lib/authz";
import { getDb } from "@/lib/db";
import {
  getOnboardingCompanyState,
  hasAnyOnboardingCompany,
  inferRoleFromCompanyState,
  isOnboardingCompleteForRole,
  onboardingRoleSegment,
  ROLE_SELECTION_SOURCE,
} from "@/lib/onboarding-status";
import type { AccountRole } from "@/lib/types";
import { safeInternalPath } from "@/lib/url-security";

type PublicMetadata = {
  role?: unknown;
  onboardingComplete?: unknown;
  roleSelectionSource?: unknown;
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
  metadata: PublicMetadata = {},
) {
  const companyState = profile
    ? await getOnboardingCompanyState(profile.id)
    : {
        hasBuyerCompany: false,
        hasSellerCompany: false,
        hasSellerPayoutProfile: false,
      };
  const inferredRole = inferRoleFromCompanyState(companyState);
  let role = profile?.role ?? "user";

  if (profile && role === "user" && inferredRole) {
    role = inferredRole;
    await getDb().userProfile.update({
      where: { id: profile.id },
      data: { role },
    });
  }

  if (
    profile &&
    role !== "user" &&
    role !== "admin" &&
    !inferredRole &&
    !(
      metadata.role === role &&
      metadata.roleSelectionSource === ROLE_SELECTION_SOURCE
    )
  ) {
    role = "user";
    await getDb().userProfile.update({
      where: { id: profile.id },
      data: { role },
    });
  }

  return {
    role,
    canChangeRole: role !== "admin" && !hasAnyOnboardingCompany(companyState),
    onboardingComplete: isOnboardingCompleteForRole(role, companyState),
    companyState,
  };
}

async function syncClerkOnboardingMetadata(
  clerkUserId: string | undefined,
  metadata: PublicMetadata,
  role: AccountRole,
  onboardingComplete: boolean,
) {
  if (!clerkUserId) return;
  const hasStaleRoleSelectionSource =
    role === "user" && metadata.roleSelectionSource !== undefined;
  if (
    metadata.role === role &&
    metadata.onboardingComplete === onboardingComplete &&
    !hasStaleRoleSelectionSource
  ) {
    return;
  }

  try {
    const client = await clerkClient();
    const nextMetadata: Record<string, unknown> = {
      ...(metadata as Record<string, unknown>),
      role,
      onboardingComplete,
    };
    if (role === "user") {
      delete nextMetadata.roleSelectionSource;
    }

    await client.users.updateUserMetadata(clerkUserId, {
      publicMetadata: nextMetadata,
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

export async function redirectSignedInUserFromSignup(
  basePath: "" | "/en" | "/ko",
) {
  const { userId } = await auth();
  if (!userId) return;

  const [clerkUser, profile] = await Promise.all([
    currentUser(),
    getCurrentUserProfile(),
  ]);
  const metadata = (clerkUser?.publicMetadata ?? {}) as PublicMetadata;
  const { role, canChangeRole, onboardingComplete } = await resolveOnboardingState(
    profile,
    metadata,
  );

  await syncClerkOnboardingMetadata(
    clerkUser?.id,
    metadata,
    role,
    onboardingComplete,
  );

  if (role === "user" || canChangeRole) {
    redirect(`${basePath}/onboarding/role`);
  }

  if (role === "admin") {
    redirect(`${basePath}/admin`);
  }

  if (
    (role === "seller" || role === "buyer" || role === "both") &&
    !onboardingComplete
  ) {
    redirect(`${basePath}/onboarding/${onboardingRoleSegment(role)}`);
  }

  redirect(`${basePath}/dashboard`);
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

  await syncClerkOnboardingMetadata(
    clerkUser?.id,
    metadata,
    role,
    onboardingComplete,
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
  const { role, canChangeRole, onboardingComplete } = await resolveOnboardingState(
    profile,
    metadata,
  );

  await syncClerkOnboardingMetadata(
    clerkUser?.id,
    metadata,
    role,
    onboardingComplete,
  );

  if (role === "user" || canChangeRole) {
    return { role, canChangeRole };
  }
  if (role === "admin") redirect(`${prefix}/admin`);

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
  const { role, canChangeRole, onboardingComplete, companyState } =
    await resolveOnboardingState(
    profile,
    metadata,
  );

  await syncClerkOnboardingMetadata(
    clerkUser?.id,
    metadata,
    role,
    onboardingComplete,
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

  if (onboardingComplete) {
    redirect(`${prefix}/dashboard`);
  }

  return { role, canChangeRole, hasSellerCompany: companyState.hasSellerCompany };
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
