import { auth } from "@clerk/nextjs/server";

import { PartnerProgramLanding } from "@/components/partner-program-landing";
import { getCurrentUserProfile } from "@/lib/authz";
import { getDb } from "@/lib/db";
import { isPartnerProgramEnabled } from "@/lib/partner-program-feature";

export const dynamic = "force-dynamic";

export default async function PartnerPage() {
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
  const state = !partner
    ? "eligible"
    : partner.status === "PENDING_REVIEW"
      ? "pendingReview"
      : partner.status === "REJECTED"
        ? "rejected"
        : partner.status === "ACTIVE"
          ? "active"
          : "suspended";
  return <PartnerProgramLanding state={state} />;
}
