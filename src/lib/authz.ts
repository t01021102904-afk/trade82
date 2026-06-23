import "server-only";

import { auth, currentUser } from "@clerk/nextjs/server";

import type {
  AccountRole,
  Company,
  CompanyRole,
  Product,
  UserProfile,
} from "@/generated/prisma/client";
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
  const role: AccountRole = admin
    ? "admin"
    : roleFromMetadata(clerkUser.publicMetadata.role);
  const preferredLanguage =
    clerkUser.publicMetadata.preferredLanguage === "ko" ? "ko" : "en";

  return getDb().userProfile.upsert({
    where: { clerkUserId: userId },
    create: {
      clerkUserId: userId,
      email: primaryEmail.toLowerCase(),
      displayName:
        clerkUser.fullName || primaryEmail.split("@")[0] || "BridgeMarket User",
      role,
      preferredLanguage,
    },
    update: {
      email: primaryEmail.toLowerCase(),
      displayName:
        clerkUser.fullName || primaryEmail.split("@")[0] || "BridgeMarket User",
      role,
      preferredLanguage,
    },
  });
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
    throw new Response("Verified seller required", { status: 403 });
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
