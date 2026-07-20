import { auth } from "@clerk/nextjs/server";

import { PartnerProgramLanding } from "@/components/partner-program-landing";
import { PartnerProfileStatus } from "@/generated/prisma/client";
import { getCurrentUserProfile } from "@/lib/authz";
import { getDb } from "@/lib/db";
import { isPartnerProgramEnabled } from "@/lib/partner-program-feature";

export const dynamic = "force-dynamic";

export default async function KoPartnerPage() {
  if (!isPartnerProgramEnabled())
    return <PartnerProgramLanding state="unavailable" />;

  const { userId } = await auth();
  if (!userId) return <PartnerProgramLanding state="guest" />;

  const profile = await getCurrentUserProfile();
  const partner = profile
    ? await getDb().partnerProfile.findFirst({
        where: { userId: profile.id, deletedAt: null },
        select: { status: true },
      })
    : null;
  return (
    <PartnerProgramLanding
      state={
        partner?.status === PartnerProfileStatus.ACTIVE
          ? "active"
          : partner
            ? "suspended"
            : "eligible"
      }
    />
  );
}
