import "server-only";

import { PartnerProfileStatus, Prisma, type PreferredLanguage, type PrismaClient } from "@/generated/prisma/client";
import { validationError } from "@/lib/api-security";
import { getDb } from "@/lib/db";
import { createOrGetPartnerProfile } from "@/lib/partner-referrals";
import { savePartnerPayoutProfile } from "@/lib/partner-payout-profiles";

const PARTNER_TERMS_VERSION = "partner-program-2026-07";
const PARTNER_PAYOUT_TERMS_VERSION = "partner-payout-terms-2026-07";
const PRIVACY_VERSION = "privacy-2026-07";

export type PartnerEnrollmentInput = {
  fullName: string;
  phone: string;
  preferredLanguage: PreferredLanguage;
  bankDirectoryId: string;
  accountHolder: string;
  accountNumber: string;
  accountBelongsToPartner: boolean;
  agreeToTerms: boolean;
  acknowledgePayoutTerms: boolean;
  acknowledgePrivacy: boolean;
};

export function normalizePartnerPhone(value: string) {
  const trimmed = value.trim();
  const normalized = trimmed.replace(/[\s().-]/g, "");
  if (!/^\+?[0-9]{7,15}$/.test(normalized)) {
    throw validationError("phone must be a valid mobile phone number.");
  }
  return normalized;
}

export function normalizePartnerEnrollment(input: PartnerEnrollmentInput) {
  const fullName = input.fullName.trim();
  const accountHolder = input.accountHolder.trim();
  if (!fullName || fullName.length > 160) throw validationError("fullName is required.");
  if (!accountHolder || accountHolder.length > 240) throw validationError("accountHolder is required.");
  if (!input.agreeToTerms || !input.acknowledgePayoutTerms || !input.acknowledgePrivacy) {
    throw validationError("All required partner terms and privacy acknowledgements are required.");
  }
  return {
    fullName,
    accountHolder,
    phone: normalizePartnerPhone(input.phone),
    preferredLanguage: input.preferredLanguage,
    bankDirectoryId: input.bankDirectoryId.trim(),
    accountNumber: input.accountNumber.trim(),
    accountBelongsToPartner: input.accountBelongsToPartner,
  };
}

function isUniqueConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function enrollPartnerProfile({
  userId,
  email,
  input,
  db = getDb(),
  now = new Date(),
}: {
  userId: string;
  email: string;
  input: PartnerEnrollmentInput;
  db?: PrismaClient;
  now?: Date;
}) {
  const data = normalizePartnerEnrollment(input);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await db.$transaction(async (tx) => {
        const existing = await tx.partnerProfile.findUnique({
          where: { userId },
          select: {
            id: true,
            status: true,
            termsConsentVersion: true,
            termsConsentedAt: true,
            privacyConsentVersion: true,
            privacyConsentedAt: true,
          },
        });
        if (existing?.status === PartnerProfileStatus.SUSPENDED) {
          throw new Response("Partner profile is suspended", { status: 403 });
        }

        const profileResult = existing
          ? { partnerProfile: { id: existing.id }, created: false }
          : await createOrGetPartnerProfile(tx, userId, { status: PartnerProfileStatus.PENDING_REVIEW });

        const partnerProfile = await tx.partnerProfile.update({
          where: { id: profileResult.partnerProfile.id },
          data: {
            legalName: data.fullName,
            displayName: data.fullName,
            contactEmail: email.trim().toLowerCase(),
            contactPhone: data.phone,
            country: "KR",
            preferredLanguage: data.preferredLanguage,
            termsConsentVersion: PARTNER_TERMS_VERSION,
            termsConsentedAt:
              existing?.termsConsentVersion === PARTNER_TERMS_VERSION && existing.termsConsentedAt
                ? existing.termsConsentedAt
                : now,
            payoutTermsConsentVersion: PARTNER_PAYOUT_TERMS_VERSION,
            payoutTermsConsentedAt: now,
            privacyConsentVersion: PRIVACY_VERSION,
            privacyConsentedAt:
              existing?.privacyConsentVersion === PRIVACY_VERSION && existing.privacyConsentedAt
                ? existing.privacyConsentedAt
                : now,
            ...(existing?.status === PartnerProfileStatus.REJECTED
              ? { status: PartnerProfileStatus.PENDING_REVIEW }
              : {}),
          },
          select: { id: true, status: true, createdAt: true },
        });

        const payoutProfile = await savePartnerPayoutProfile({
          db: tx,
          partnerProfileId: partnerProfile.id,
          actorUserId: userId,
          input: {
            bankDirectoryId: data.bankDirectoryId,
            accountHolder: data.accountHolder,
            accountNumber: data.accountNumber,
            accountBelongsToPartner: data.accountBelongsToPartner,
          },
        });

        await tx.userProfile.update({
          where: { id: userId },
          data: {
            displayName: data.fullName,
            phoneNumber: data.phone,
            country: "KR",
            preferredLanguage: data.preferredLanguage,
          },
        });
        await tx.partnerProfileAuditEvent.create({
          data: {
            partnerProfileId: partnerProfile.id,
            actorUserId: userId,
            action: profileResult.created ? "APPLICATION_SUBMITTED" : "APPLICATION_UPDATED",
            metadata: {
              status: partnerProfile.status,
              payoutProfileStatus: payoutProfile.status,
            },
          },
        });

        return {
          partnerProfile,
          payoutProfile,
          created: profileResult.created,
        };
      });
    } catch (error) {
      if (!isUniqueConflict(error) || attempt === 1) throw error;
    }
  }
  throw new Error("Partner enrollment retry was exhausted.");
}

export const partnerConsentVersions = {
  terms: PARTNER_TERMS_VERSION,
  payoutTerms: PARTNER_PAYOUT_TERMS_VERSION,
  privacy: PRIVACY_VERSION,
} as const;
