import { PartnerProfileStatus, Prisma } from "@/generated/prisma/client";

type PartnerProfileLockRow = {
  id: string;
  status: PartnerProfileStatus;
};

type PartnerProfileLockDb = Pick<Prisma.TransactionClient, "$queryRaw">;

export async function lockOwnedPartnerProfile(
  tx: PartnerProfileLockDb,
  userId: string,
) {
  const rows = await tx.$queryRaw<PartnerProfileLockRow[]>(
    Prisma.sql`
      SELECT "id", "status"
      FROM "PartnerProfile"
      WHERE "userId" = ${userId}
        AND "deletedAt" IS NULL
      FOR UPDATE
    `,
  );
  return rows[0] ?? null;
}

export async function lockPartnerProfileById(
  tx: PartnerProfileLockDb,
  partnerProfileId: string,
) {
  const rows = await tx.$queryRaw<PartnerProfileLockRow[]>(
    Prisma.sql`
      SELECT "id", "status"
      FROM "PartnerProfile"
      WHERE "id" = ${partnerProfileId}
        AND "deletedAt" IS NULL
      FOR UPDATE
    `,
  );
  return rows[0] ?? null;
}

export type PartnerPayoutWriteAuthorization =
  | {
      ok: true;
      partnerProfileId: string;
      status: Extract<PartnerProfileStatus, "ACTIVE" | "PENDING_REVIEW">;
    }
  | { ok: false; status: 403 | 409; error: string };

export function authorizePartnerPayoutWrite(
  partner: PartnerProfileLockRow | null,
): PartnerPayoutWriteAuthorization {
  if (!partner) {
    return { ok: false, status: 403, error: "Partner profile is required." };
  }

  switch (partner.status) {
    case PartnerProfileStatus.ACTIVE:
    case PartnerProfileStatus.PENDING_REVIEW:
      return { ok: true, partnerProfileId: partner.id, status: partner.status };
    case PartnerProfileStatus.SUSPENDED:
      return {
        ok: false,
        status: 403,
        error: "Payout information cannot be changed while the partner profile is suspended.",
      };
    case PartnerProfileStatus.REJECTED:
      return {
        ok: false,
        status: 409,
        error: "Resubmit partner enrollment before changing payout information.",
      };
    default:
      return { ok: false, status: 403, error: "Partner profile status is not eligible for payout updates." };
  }
}
