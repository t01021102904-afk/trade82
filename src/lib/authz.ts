import "server-only";

import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";

import type {
  AccountRole,
  Company,
  CompanyRole,
  Product,
  UserProfile,
} from "@/generated/prisma/client";
import { AccountDeletionStatus } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import {
  createFreshUserProfile,
  isActiveUserProfile,
} from "@/lib/fresh-user-profile";
import { REFERRAL_CLAIM_COOKIE } from "@/lib/partner-referrals";
import {
  getOnboardingCompanyState,
  inferRoleFromCompanyState,
} from "@/lib/onboarding-status";
import {
  resolveCurrentClerkUser,
  type ResolvedClerkUser,
} from "@/lib/clerk-identity";

type CompanyWithOwner = Company & {
  owner?: Pick<UserProfile, "id">;
};

type PublicProduct = Pick<Product, "status"> & {
  sellerCompany: Pick<Company, "verificationStatus">;
};

function roleFromMetadata(value: unknown): AccountRole {
  return value === "seller" ||
    value === "buyer" ||
    value === "both" ||
    value === "admin"
    ? value
    : "user";
}

function roleForExistingProfile(
  existingRole: AccountRole,
  metadataRole: AccountRole,
  admin: boolean,
  inferredRole: AccountRole | null,
  relinkingDifferentClerkUser: boolean,
) {
  if (admin) return "admin";
  if (existingRole === "admin") return metadataRole === "admin" ? "admin" : "user";
  if (relinkingDifferentClerkUser && !inferredRole) return "user";
  if (existingRole === "user") return inferredRole ?? "user";
  return existingRole;
}

export { createFreshUserProfile, isActiveUserProfile } from "@/lib/fresh-user-profile";

export function adminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter((email, index, emails) => Boolean(email) && emails.indexOf(email) === index);
}

export function isAdminEmail(email: string | null | undefined) {
  return Boolean(email && adminEmails().includes(email.toLowerCase()));
}

export async function isAdminUser(clerkUser?: ResolvedClerkUser | null) {
  const resolvedClerkUser =
    clerkUser === undefined ? await resolveCurrentClerkUser() : clerkUser;
  return isAdminEmail(resolvedClerkUser?.primaryEmailAddress?.emailAddress);
}

export async function getCurrentUserProfile(
  resolvedClerkUser?: ResolvedClerkUser | null,
) {
  const clerkUser =
    resolvedClerkUser === undefined
      ? await resolveCurrentClerkUser()
      : resolvedClerkUser;
  const primaryEmail = clerkUser?.primaryEmailAddress?.emailAddress;
  if (!clerkUser || !primaryEmail) return null;

  const userId = clerkUser.id;

  const admin = isAdminEmail(primaryEmail);
  const metadataRole = roleFromMetadata(clerkUser.publicMetadata.role);
  const createRole: AccountRole = admin ? "admin" : "user";
  const preferredLanguage =
    clerkUser.publicMetadata.preferredLanguage === "ko" ? "ko" : "en";
  const email = primaryEmail.toLowerCase();
  const displayName =
    clerkUser.fullName || primaryEmail.split("@")[0] || "Trade82 User";
  const db = getDb();

  const updateExistingProfile = async (profile: UserProfile) => {
    const companyState = await getOnboardingCompanyState(profile.id);
    const inferredRole = inferRoleFromCompanyState(companyState);
    const relinkingDifferentClerkUser = profile.clerkUserId !== userId;

    return db.userProfile.update({
      where: { id: profile.id },
      data: {
        clerkUserId: userId,
        email,
        displayName: profile.displayName || displayName,
        role: roleForExistingProfile(
          profile.role,
          metadataRole,
          admin,
          inferredRole,
          relinkingDifferentClerkUser,
        ),
        preferredLanguage,
      },
    });
  };

  const existingByClerkId = await db.userProfile.findUnique({
    where: { clerkUserId: userId },
  });
  if (existingByClerkId) {
    // A pending/deleted account is never allowed to reconnect to an active
    // Clerk identity. Final deletion replaces the Clerk identifier, while a
    // pending deletion stays blocked until the trusted deletion path finishes.
    if (!isActiveUserProfile(existingByClerkId)) {
      return null;
    }
    return await updateExistingProfile(existingByClerkId);
  }

  // Referral evidence can only be consumed while this identity receives its
  // first local profile. Existing profiles never enter here, and a new Clerk
  // identity is never relinked by email to an older profile.
  const referralClaimToken = (await cookies()).get(REFERRAL_CLAIM_COOKIE)?.value;
  return createFreshUserProfile(db, {
    clerkUserId: userId,
    email,
    displayName,
    role: createRole,
    preferredLanguage,
    referralClaimToken,
  });
}

/**
 * Used only by the delete-account endpoint. It intentionally does not fall
 * back to email matching, so a different Clerk identity can never finalize or
 * resume another person's deletion.
 */
export async function getCurrentDeletionProfile() {
  const { userId } = await auth();
  if (!userId) return null;

  const profile = await getDb().userProfile.findUnique({
    where: { clerkUserId: userId, deletedAt: null },
  });
  if (!profile || profile.deletionStatus === AccountDeletionStatus.DELETED) {
    return null;
  }
  return profile;
}

export async function requireAuth() {
  const user = await getCurrentUserProfile();
  if (!user) throw new Response("Unauthorized", { status: 401 });
  return user;
}

export async function requireAdmin() {
  const clerkUser = await resolveCurrentClerkUser();
  if (!clerkUser) {
    throw new Response("Unauthorized", { status: 401 });
  }
  const user = await getCurrentUserProfile(clerkUser);
  if (!user || !(await isAdminUser(clerkUser))) {
    throw new Response("Forbidden", { status: 403 });
  }
  return user;
}

export async function getUserCompany(
  userId: string,
  companyRole?: CompanyRole,
) {
  return getDb().company.findFirst({
    where: {
      ownerUserId: userId,
      deletedAt: null,
      ...(companyRole ? { companyRole } : {}),
    },
    include: {
      sellerProfile: true,
      buyerProfile: true,
      verificationRequests: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
}

export async function requireSeller() {
  const user = await requireAuth();
  if (user.role !== "seller" && user.role !== "both") {
    throw new Response("Seller role required", { status: 403 });
  }
  return { user, company: await getUserCompany(user.id, "seller") };
}

export async function requireBuyer() {
  const user = await requireAuth();
  if (user.role !== "buyer" && user.role !== "both") {
    throw new Response("Buyer role required", { status: 403 });
  }
  return { user, company: await getUserCompany(user.id, "buyer") };
}

export async function requireCompanyOwner(companyId: string) {
  const user = await requireAuth();
  const company = await getDb().company.findUnique({ where: { id: companyId } });
  if (!company || company.deletedAt || company.ownerUserId !== user.id) {
    throw new Response("Forbidden", { status: 403 });
  }
  return { user, company };
}

export async function requireVerifiedSeller() {
  const { user, company } = await requireSeller();
  if (!company || company.verificationStatus !== "verified") {
    throw new Response("Listed seller required", { status: 403 });
  }
  return { user, company };
}

export function canViewPublicCompany(
  company:
    | (Pick<Company, "verificationStatus"> & { deletedAt?: Date | null })
    | null
    | undefined,
) {
  return company?.verificationStatus === "verified" && !company.deletedAt;
}

export function canViewPublicProduct(
  product: PublicProduct | null | undefined,
) {
  return (
    product?.status === "active" &&
    canViewPublicCompany(product.sellerCompany)
  );
}

export function canContactSeller(
  user: Pick<UserProfile, "role" | "id">,
  buyerCompany: CompanyWithOwner | null | undefined,
) {
  return (
    (user.role === "buyer" || user.role === "both") &&
    buyerCompany?.companyRole === "buyer" &&
    buyerCompany.ownerUserId === user.id
  );
}

export function canManageProduct(
  user: Pick<UserProfile, "id" | "role">,
  product:
    | (Pick<Product, "sellerCompanyId"> & {
        sellerCompany: Pick<Company, "ownerUserId">;
      })
    | null
    | undefined,
) {
  return (
    (user.role === "seller" || user.role === "both") &&
    product?.sellerCompany.ownerUserId === user.id
  );
}

export async function canApproveVerification(
  user?: Pick<UserProfile, "id" | "role">,
) {
  void user;
  return isAdminUser();
}
