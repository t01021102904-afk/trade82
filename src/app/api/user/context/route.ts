import { getCurrentUserProfile, isAdminUser } from "@/lib/authz";
import { getDb } from "@/lib/db";

export async function GET() {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const companies = await getDb().company.findMany({
    where: { ownerUserId: profile.id },
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
}
