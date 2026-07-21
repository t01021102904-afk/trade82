import { clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import {
  getCurrentDeletionProfile,
  getCurrentUserProfile,
  isAdminUser,
} from "@/lib/authz";
import { AccountDeletionStatus } from "@/generated/prisma/client";
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
import {
  resolveCurrentClerkUser,
  type ResolvedClerkUser,
} from "@/lib/clerk-identity";
import { isExistingEmailDifferentClerkIdentityError } from "@/lib/fresh-user-profile";

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

function redirectToAccountRecovery(pathname: string): never {
  redirect(`${localePrefix(pathname)}/account-recovery`);
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

export async function requireAuth(
  redirectUrl: string,
): Promise<ResolvedClerkUser> {
  const clerkUser = await resolveCurrentClerkUser();
  if (clerkUser) return clerkUser;

  const prefix = localePrefix(redirectUrl);
  const fallback = `${prefix || ""}/dashboard`;
  const safeRedirectUrl = safeInternalPath(redirectUrl, fallback);
  redirect(`${prefix}/login?redirect_url=${encodeURIComponent(safeRedirectUrl)}`);
}

export async function redirectSignedInUserFromSignup(
  basePath: "" | "/en" | "/ko",
) {
  const clerkUser = await resolveCurrentClerkUser();
  if (!clerkUser) return;

  let profile;
  try {
    profile = await getCurrentUserProfile(clerkUser);
  } catch (error) {
    if (
      isExistingEmailDifferentClerkIdentityError(error)
    ) {
      return;
    }
    throw error;
  }
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
  const clerkUser = await requireAuth(redirectUrl);
  let profile;
  try {
    profile = await getCurrentUserProfile(clerkUser);
  } catch (error) {
    if (
      isExistingEmailDifferentClerkIdentityError(error)
    ) {
      redirectToAccountRecovery(redirectUrl);
    }
    throw error;
  }
  const prefix = localePrefix(redirectUrl);
  if (!profile) {
    redirect(`${prefix}/login`);
  }
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
  const deletionProfile = await getCurrentDeletionProfile();
  if (deletionProfile?.deletionStatus === AccountDeletionStatus.DELETION_PENDING) {
    return {
      role: "user" as const,
      canChangeRole: false,
      deletionPending: true,
    };
  }

  const clerkUser = await requireAuth(redirectUrl);
  let profile;
  try {
    profile = await getCurrentUserProfile(clerkUser);
  } catch (error) {
    if (
      isExistingEmailDifferentClerkIdentityError(error)
    ) {
      redirectToAccountRecovery(redirectUrl);
    }
    throw error;
  }
  const prefix = localePrefix(redirectUrl);
  if (!profile) {
    redirect(`${prefix}/login`);
  }
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
    return {
      role,
      canChangeRole,
      deletionPending: false,
    };
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
  const clerkUser = await requireAuth(redirectUrl);
  let profile;
  try {
    profile = await getCurrentUserProfile(clerkUser);
  } catch (error) {
    if (
      isExistingEmailDifferentClerkIdentityError(error)
    ) {
      redirectToAccountRecovery(redirectUrl);
    }
    throw error;
  }
  const prefix = localePrefix(redirectUrl);
  if (!profile) {
    redirect(`${prefix}/login`);
  }
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
  const clerkUser = await requireAuth(redirectUrl);

  if (!(await isAdminUser(clerkUser))) {
    const prefix = localePrefix(redirectUrl);
    redirect(`${prefix}/dashboard`);
  }

  return { email: clerkUser.primaryEmailAddress?.emailAddress ?? "" };
}
