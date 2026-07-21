import { getCurrentUserProfile, isAdminUser } from "@/lib/authz";
import { rateLimitOrResponse } from "@/lib/api-security";
import { getDb } from "@/lib/db";
import { isExistingEmailDifferentClerkIdentityError } from "@/lib/fresh-user-profile";

export async function GET(request: Request) {
  try {
    const profile = await getCurrentUserProfile();
    if (!profile) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const rateLimited = rateLimitOrResponse({
      request,
      scope: "user-context",
      userId: profile.id,
      limit: 120,
      windowMs: 60_000,
    });
    if (rateLimited) return rateLimited;

    const companies = await getDb().company.findMany({
      where: { ownerUserId: profile.id, deletedAt: null },
      select: {
        id: true,
        companyRole: true,
        verificationStatus: true,
        legalName: true,
        tradeName: true,
      },
    });

    return Response.json({
      role: profile.role,
      isAdmin: await isAdminUser(),
      companies,
    });
  } catch (error) {
    if (isExistingEmailDifferentClerkIdentityError(error)) {
      return Response.json(
        { error: "Account recovery is required before continuing." },
        { status: 409 },
      );
    }
    console.error("Unable to load user context.");
    return Response.json(
      { error: "Unable to load user context." },
      { status: 500 },
    );
  }
}
