import "server-only";

import { PartnerProfileStatus } from "@/generated/prisma/client";
import { getCurrentUserProfile } from "@/lib/authz";
import { getDb } from "@/lib/db";

export async function getCurrentPartnerProfile() {
  const user = await getCurrentUserProfile();
  if (!user) return null;
  return getDb().partnerProfile.findUnique({
    where: { userId: user.id },
    include: { stripeConnectedAccount: true },
  });
}

export async function requireActivePartnerProfile() {
  const user = await getCurrentUserProfile();
  if (!user) throw new Response("Unauthorized", { status: 401 });

  const partner = await getDb().partnerProfile.findUnique({
    where: { userId: user.id },
    include: { stripeConnectedAccount: true },
  });
  if (!partner) throw new Response("Partner profile required", { status: 403 });
  if (partner.status !== PartnerProfileStatus.ACTIVE) {
    throw new Response("Partner profile is suspended", { status: 403 });
  }
  return { user, partner };
}
