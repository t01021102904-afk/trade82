import "server-only";

import { auth, currentUser } from "@clerk/nextjs/server";

import type {
  AccountRole,
  Company,
  CompanyRole,
  Product,
  UserProfile,
} from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";

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
) {
  if (admin) return "admin";
  if (existingRole === "admin") return metadataRole === "admin" ? "admin" : "user";
  if (existingRole === "user" && metadataRole !== "admin") return metadataRole;
  return existingRole;
}

function isEmailUniqueConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    Array.isArray(error.meta?.target) &&
    error.meta.target.includes("email")
  );
}

export function adminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined) {
  return Boolean(email && adminEmails().includes(email.toLowerCase()));
}

export async function isAdminUser() {
  const clerkUser = await currentUser();
  return isAdminEmail(clerkUser?.primaryEmailAddress?.emailAddress);
}

export async function getCurrentUserProfile() {
  const { userId } = await auth();
  if (!userId) return null;

  const clerkUser = await currentUser();
  const primaryEmail = clerkUser?.primaryEmailAddress?.emailAddress;
  if (!clerkUser || !primaryEmail) return null;

  const admin = isAdminEmail(primaryEmail);
  const metadataRole = roleFromMetadata(clerkUser.publicMetadata.role);
  const createRole: AccountRole = admin ? "admin" : metadataRole;
  const preferredLanguage =
    clerkUser.publicMetadata.preferredLanguage === "ko" ? "ko" : "en";
  const email = primaryEmail.toLowerCase();
  const displayName =
    clerkUser.fullName || primaryEmail.split("@")[0] || "Trade82 User";
  const db = getDb();

  const updateExistingProfile = (profile: UserProfile) =>
    db.userProfile.update({
      where: { id: profile.id },
      data: {
        clerkUserId: userId,
        email,
        displayName: profile.displayName || displayName,
        role: roleForExistingProfile(profile.role, metadataRole, admin),
        preferredLanguage,
      },
    });

  try {
    const existingByClerkId = await db.userProfile.findUnique({
      where: { clerkUserId: userId },
    });
    if (existingByClerkId) {
      return await updateExistingProfile(existingByClerkId);
    }

    const existingByEmail = await db.userProfile.findUnique({
      where: { email },
    });
    if (existingByEmail) {
      console.warn("Linking existing user profile to current auth identity.");
      return await updateExistingProfile(existingByEmail);
    }

    return await db.userProfile.create({
      data: {
        clerkUserId: userId,
        email,
        displayName,
        role: createRole,
        preferredLanguage,
      },
    });
  } catch (error) {
    if (!isEmailUniqueConflict(error)) throw error;

    console.warn("Recovered user profile after email uniqueness conflict.");
    const existingByEmail = await db.userProfile.findUnique({
      where: { email },
    });
    if (!existingByEmail) throw error;
    return updateExistingProfile(existingByEmail);
  }
}

export async function requireAuth() {
  const user = await getCurrentUserProfile();
  if (!user) throw new Response("Unauthorized", { status: 401 });
  return user;
}

export async function requireAdmin() {
  const user = await requireAuth();
  if (!(await isAdminUser())) {
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
  if (!company || company.ownerUserId !== user.id) {
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
  company: Pick<Company, "verificationStatus"> | null | undefined,
) {
  return company?.verificationStatus === "verified";
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
