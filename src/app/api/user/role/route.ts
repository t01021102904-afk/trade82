import { auth, clerkClient } from "@clerk/nextjs/server";

import { rateLimitOrResponse } from "@/lib/api-security";
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
  isOnboardingCompleteForRole,
  ROLE_SELECTION_SOURCE,
} from "@/lib/onboarding-status";

const validRoles = new Set(["buyer", "seller"] as const);
type ValidRole = typeof validRoles extends Set<infer Role> ? Role : never;

function isValidRole(role: unknown): role is ValidRole {
  return typeof role === "string" && validRoles.has(role as ValidRole);
}

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rateLimited = rateLimitOrResponse({
    request,
    scope: "user-role",
    userId,
    limit: 10,
    windowMs: 60 * 60_000,
  });
  if (rateLimited) return rateLimited;

  const body = (await request.json().catch(() => null)) as { role?: unknown } | null;
  const role = body?.role;

  if (!isValidRole(role)) {
    return Response.json({ error: "Invalid role" }, { status: 400 });
  }
  if (await isAdminUser()) {
    return Response.json({ error: "Admin role is managed by ADMIN_EMAILS." }, { status: 403 });
  }

  const deletionProfile = await getCurrentDeletionProfile();
  if (deletionProfile?.deletionStatus === AccountDeletionStatus.DELETION_PENDING) {
    return Response.json(
      { error: "Account deletion is pending and cannot be resumed." },
      { status: 409 },
    );
  }

  const profile = await getCurrentUserProfile();
  if (profile) {
    const companyState = await getOnboardingCompanyState(profile.id);
    if (hasAnyOnboardingCompany(companyState)) {
      const onboardingComplete = isOnboardingCompleteForRole(
        profile.role,
        companyState,
      );
      const client = await clerkClient();

      await client.users.updateUserMetadata(userId, {
        publicMetadata: {
          role: profile.role,
          onboardingComplete,
        },
      });

      return Response.json(
        {
          error: "Role cannot be changed after a company profile is created.",
          role: profile.role,
          onboardingComplete,
        },
        { status: 409 },
      );
    }
  }

  if (profile && profile.role !== "user" && profile.role !== role) {
    const companyState = await getOnboardingCompanyState(profile.id);
    const onboardingComplete = isOnboardingCompleteForRole(
      profile.role,
      companyState,
    );

    if (onboardingComplete) {
      return Response.json(
        {
          error: "Role cannot be changed after onboarding is complete.",
          role: profile.role,
          onboardingComplete,
        },
        { status: 409 },
      );
    }
  }

  const client = await clerkClient();

  await client.users.updateUserMetadata(userId, {
    publicMetadata: {
      role,
      onboardingComplete: false,
      roleSelectionSource: ROLE_SELECTION_SOURCE,
    },
  });
  if (profile) {
    await getDb().userProfile.update({
      where: { id: profile.id },
      data: { role },
    });
  }

  return Response.json({
    ok: true,
    role,
    onboardingComplete: false,
  });
}
