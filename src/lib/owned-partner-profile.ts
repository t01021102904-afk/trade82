import "server-only";

import { PartnerProfileStatus, type PrismaClient } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";

export type OwnedPartnerProfile = {
  id: string;
  status: PartnerProfileStatus;
};

export async function getOwnedPartnerProfile(
  userProfileId: string,
  db: PrismaClient = getDb(),
): Promise<OwnedPartnerProfile | null> {
  return db.partnerProfile.findFirst({
    where: { userId: userProfileId, deletedAt: null },
    select: { id: true, status: true },
  });
}
