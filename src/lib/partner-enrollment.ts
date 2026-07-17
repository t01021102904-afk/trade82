import "server-only";

import { Prisma, type PreferredLanguage, type PrismaClient } from "@/generated/prisma/client";
import { validationError } from "@/lib/api-security";
import { getDb } from "@/lib/db";
import { createOrGetPartnerProfile } from "@/lib/partner-referrals";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PARTNER_TERMS_VERSION = "partner-program-2026-07";
const PRIVACY_VERSION = "privacy-2026-07";

export type PartnerEnrollmentInput = {
  legalName: string;
  displayName?: string | null;
  email: string;
  phone: string;
  country: string;
  preferredLanguage: PreferredLanguage;
  organizationName?: string | null;
  websiteOrSocialUrl?: string | null;
  promotionDescription?: string | null;
  agreeToTerms: boolean;
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
  const legalName = input.legalName.trim();
  const email = input.email.trim().toLowerCase();
  const country = input.country.trim();
  const displayName = input.displayName?.trim() || null;
  const organizationName = input.organizationName?.trim() || null;
  const promotionDescription = input.promotionDescription?.trim() || null;
  const websiteOrSocialUrl = input.websiteOrSocialUrl?.trim() || null;

  if (!legalName || legalName.length > 160) {
    throw validationError("legalName is required.");
  }
  if (!EMAIL_PATTERN.test(email) || email.length > 320) {
    throw validationError("email must be valid.");
  }
  if (!country || country.length > 100) {
    throw validationError("country is required.");
  }
  if (displayName && displayName.length > 120) throw validationError("displayName is too long.");
  if (organizationName && organizationName.length > 160) throw validationError("organizationName is too long.");
  if (promotionDescription && promotionDescription.length > 1_500) throw validationError("promotionDescription is too long.");
  if (websiteOrSocialUrl) {
    try {
      const url = new URL(websiteOrSocialUrl);
      if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Unsupported protocol");
    } catch {
      throw validationError("websiteOrSocialUrl must be a valid URL.");
    }
  }
  if (!input.agreeToTerms || !input.acknowledgePrivacy) {
    throw validationError("Partner Program Terms and Privacy Policy consent are required.");
  }

  return {
    legalName,
    displayName,
    email,
    phone: normalizePartnerPhone(input.phone),
    country,
    preferredLanguage: input.preferredLanguage,
    organizationName,
    websiteOrSocialUrl,
    promotionDescription,
  };
}

function isUniqueConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function enrollPartnerProfile({
  userId,
  input,
  db = getDb(),
  now = new Date(),
}: {
  userId: string;
  input: PartnerEnrollmentInput;
  db?: PrismaClient;
  now?: Date;
}) {
  const data = normalizePartnerEnrollment(input);

  // The user id comes exclusively from the authenticated server session. The
  // mutation upserts the existing profile so retrying a submit never issues a
  // second referral identity or a Stripe account.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await db.$transaction(async (tx) => {
      const existing = await tx.partnerProfile.findUnique({ where: { userId } });
      if (existing?.status === "SUSPENDED") {
        throw new Response("Partner profile is suspended", { status: 403 });
      }
      const profile = existing
        ? existing
        : (await createOrGetPartnerProfile(tx, userId)).partnerProfile;

      const partnerProfile = await tx.partnerProfile.update({
        where: { id: profile.id },
        data: {
          legalName: data.legalName,
          displayName: data.displayName,
          contactEmail: data.email,
          contactPhone: data.phone,
          country: data.country,
          preferredLanguage: data.preferredLanguage,
          organizationName: data.organizationName,
          websiteOrSocialUrl: data.websiteOrSocialUrl,
          promotionDescription: data.promotionDescription,
          termsConsentVersion: PARTNER_TERMS_VERSION,
          termsConsentedAt:
            existing?.termsConsentVersion === PARTNER_TERMS_VERSION &&
            existing.termsConsentedAt
              ? existing.termsConsentedAt
              : now,
          privacyConsentVersion: PRIVACY_VERSION,
          privacyConsentedAt:
            existing?.privacyConsentVersion === PRIVACY_VERSION &&
            existing.privacyConsentedAt
              ? existing.privacyConsentedAt
              : now,
        },
        select: { id: true, referralCode: true, status: true, createdAt: true },
      });

      // Keep the account's safe contact defaults current without changing its
      // role. Partner enrollment is available to base, buyer, seller, and both
      // accounts alike.
      await tx.userProfile.update({
        where: { id: userId },
        data: {
          displayName: data.displayName ?? data.legalName,
          phoneNumber: data.phone,
          country: data.country,
          preferredLanguage: data.preferredLanguage,
        },
      });
      return { partnerProfile, created: !existing };
      });
    } catch (error) {
      if (!isUniqueConflict(error) || attempt === 1) throw error;
      // A concurrent browser retry can race on PartnerProfile.userId. A single
      // bounded retry resolves the now-created record without unbounded work.
    }
  }

  throw new Error("Partner enrollment retry was exhausted.");
}

export const partnerConsentVersions = {
  terms: PARTNER_TERMS_VERSION,
  privacy: PRIVACY_VERSION,
} as const;
