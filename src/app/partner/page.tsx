import { auth } from "@clerk/nextjs/server";

import { PartnerProgramLanding } from "@/components/partner-program-landing";
import { getCurrentUserProfile } from "@/lib/authz";
import { getDb } from "@/lib/db";
import { PartnerProfileStatus } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export default async function PartnerPage() {
  const { userId } = await auth();
  if (!userId) return <PartnerProgramLanding state="guest" />;

  const profile = await getCurrentUserProfile();
  const partner = profile
    ? await getDb().partnerProfile.findUnique({ where: { userId: profile.id }, select: { status: true } })
    : null;
  return <PartnerProgramLanding state={partner?.status === PartnerProfileStatus.ACTIVE ? "active" : partner ? "suspended" : "eligible"} />;
}
