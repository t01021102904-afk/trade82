import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { PartnerProfileStatus, Prisma, ReferralAttributionStatus } from "@/generated/prisma/client";
import { isPartnerProgramEnabled } from "@/lib/partner-program-feature";

type TransactionDb = Prisma.TransactionClient;

export const REFERRAL_CLAIM_COOKIE = "trade82_referral_claim";
export const REFERRAL_CLAIM_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const REFERRAL_CODE_PATTERN = /^[A-Z0-9_-]{10,80}$/;
const MAX_REFERRAL_CODE_ATTEMPTS = 8;

export function normalizeReferralCode(value: string | null | undefined) {
  const code = value?.trim().toUpperCase() ?? "";
  return REFERRAL_CODE_PATTERN.test(code) ? code : null;
}

export function hashReferralClaimToken(rawToken: string) {
  return createHash("sha256").update(rawToken).digest("hex");
}

export function createReferralClaimSecret() {
  return randomBytes(32).toString("base64url");
}

export function createReferralCode() {
  return `T82-${randomBytes(12).toString("base64url").toUpperCase()}`;
}

function isUniqueConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function createOrGetPartnerProfile(
  db: {
    partnerProfile: {
      findUnique: (args: { where: { userId: string } }) => Promise<{
        id: string;
        userId: string;
        referralCode: string;
        status: PartnerProfileStatus;
        createdAt: Date;
      } | null>;
      create: (args: { data: { userId: string; referralCode: string } }) => Promise<{
        id: string;
        userId: string;
        referralCode: string;
        status: PartnerProfileStatus;
        createdAt: Date;
      }>;
    };
  },
  userId: string,
) {
  const existing = await db.partnerProfile.findUnique({ where: { userId } });
  if (existing) return { partnerProfile: existing, created: false };

  for (let attempt = 0; attempt < MAX_REFERRAL_CODE_ATTEMPTS; attempt += 1) {
    try {
      const partnerProfile = await db.partnerProfile.create({
        data: { userId, referralCode: createReferralCode() },
      });
      return { partnerProfile, created: true };
    } catch (error) {
      if (!isUniqueConflict(error)) throw error;
      const concurrent = await db.partnerProfile.findUnique({ where: { userId } });
      if (concurrent) return { partnerProfile: concurrent, created: false };
    }
  }

  throw new Error("Unable to allocate a unique referral code.");
}

export async function createReferralClaimForCode(
  db: {
    partnerProfile: {
      findUnique: (args: {
        where: { referralCode: string };
        select: { id: true; status: true };
      }) => Promise<{ id: string; status: PartnerProfileStatus } | null>;
    };
    referralClaimToken: {
      create: (args: {
        data: { tokenHash: string; partnerProfileId: string; expiresAt: Date };
      }) => Promise<unknown>;
    };
  },
  referralCode: string,
  now = new Date(),
) {
  if (!isPartnerProgramEnabled()) return null;
  const normalizedCode = normalizeReferralCode(referralCode);
  if (!normalizedCode) return null;

  const partner = await db.partnerProfile.findUnique({
    where: { referralCode: normalizedCode },
    select: { id: true, status: true },
  });
  if (!partner || partner.status !== PartnerProfileStatus.ACTIVE) return null;

  const rawToken = createReferralClaimSecret();
  await db.referralClaimToken.create({
    data: {
      tokenHash: hashReferralClaimToken(rawToken),
      partnerProfileId: partner.id,
      expiresAt: new Date(now.getTime() + REFERRAL_CLAIM_MAX_AGE_SECONDS * 1000),
    },
  });
  return rawToken;
}

// Called inside the same transaction that creates a new UserProfile. Invalid
// referral evidence is intentionally non-blocking; database errors propagate.
export async function consumeReferralClaimForNewUser(
  tx: TransactionDb,
  {
    rawToken,
    referredUserId,
    now = new Date(),
  }: {
    rawToken: string | null | undefined;
    referredUserId: string;
    now?: Date;
  },
) {
  if (!isPartnerProgramEnabled() || !rawToken) return { consumed: false, reason: "disabled-or-missing" as const };
  if (!/^[A-Za-z0-9_-]{32,256}$/.test(rawToken)) {
    return { consumed: false, reason: "invalid" as const };
  }

  const tokenHash = hashReferralClaimToken(rawToken);
  const claim = await tx.referralClaimToken.findUnique({
    where: { tokenHash },
    include: { partnerProfile: { select: { id: true, status: true, userId: true, referralCode: true } } },
  });
  if (
    !claim ||
    claim.consumedAt ||
    claim.expiresAt.getTime() <= now.getTime() ||
    claim.partnerProfile.status !== PartnerProfileStatus.ACTIVE ||
    claim.partnerProfile.userId === referredUserId
  ) {
    return { consumed: false, reason: "invalid" as const };
  }

  const updated = await tx.referralClaimToken.updateMany({
    where: {
      id: claim.id,
      consumedAt: null,
      expiresAt: { gt: now },
      partnerProfile: { status: PartnerProfileStatus.ACTIVE },
    },
    data: { consumedAt: now, consumedByUserId: referredUserId },
  });
  if (updated.count !== 1) return { consumed: false, reason: "already-consumed" as const };

  try {
    const attribution = await tx.referralAttribution.create({
      data: {
        referredUserId,
        partnerProfileId: claim.partnerProfileId,
        referralCode: claim.partnerProfile.referralCode,
        status: ReferralAttributionStatus.LOCKED,
        lockedAt: now,
      },
    });
    return { consumed: true, attribution };
  } catch (error) {
    if (!isUniqueConflict(error)) throw error;
    // The transaction will keep the first immutable attribution and the token
    // consumption remains auditable without replacing it.
    return { consumed: false, reason: "attribution-exists" as const };
  }
}
