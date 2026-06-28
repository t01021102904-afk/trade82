import "server-only";

import type { CompanyRole } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";

const TEAM_CLERK_USER_ID = "trade82-team-system";
const TEAM_EMAIL = "team@trade82.local";
const TEAM_NAME = "Trade82 team";

export function isTrade82TeamCompanyName(name: string | null | undefined) {
  return name === TEAM_NAME;
}

export async function getOrCreateTrade82TeamCompany(companyRole: CompanyRole) {
  const db = getDb();
  const existingProfile =
    (await db.userProfile.findUnique({
      where: { clerkUserId: TEAM_CLERK_USER_ID },
    })) ??
    (await db.userProfile.findUnique({
      where: { email: TEAM_EMAIL },
    }));
  const profile = existingProfile
    ? await db.userProfile.update({
        where: { id: existingProfile.id },
        data: {
          clerkUserId: TEAM_CLERK_USER_ID,
          displayName: TEAM_NAME,
          role: "admin",
        },
      })
    : await db.userProfile.create({
        data: {
          clerkUserId: TEAM_CLERK_USER_ID,
          email: TEAM_EMAIL,
          displayName: TEAM_NAME,
          role: "admin",
          preferredLanguage: "en",
        },
      });

  return db.company.upsert({
    where: {
      ownerUserId_companyRole: {
        ownerUserId: profile.id,
        companyRole,
      },
    },
    update: {
      legalName: TEAM_NAME,
      tradeName: TEAM_NAME,
      useDefaultLogo: true,
      verificationStatus: "unverified",
    },
    create: {
      ownerUserId: profile.id,
      companyRole,
      legalName: TEAM_NAME,
      tradeName: TEAM_NAME,
      useDefaultLogo: true,
      website: "https://trade82.com",
      country: companyRole === "buyer" ? "United States" : "South Korea",
      city: "",
      stateOrProvince: "",
      businessAddress: "Trade82 team account",
      description: "Trade82 marketplace operator account.",
      categories: [],
      verificationStatus: "unverified",
    },
  });
}
