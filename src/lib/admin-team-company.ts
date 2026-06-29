import "server-only";

import type { CompanyRole } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";

export const TRADE82_TEAM_NAME = "Trade82 team";

export function isTrade82TeamCompanyName(name: string | null | undefined) {
  return name === TRADE82_TEAM_NAME;
}

export async function getOrCreateTrade82TeamCompany(
  ownerUserId: string,
  companyRole: CompanyRole,
) {
  const db = getDb();
  return db.company.upsert({
    where: {
      ownerUserId_companyRole: {
        ownerUserId,
        companyRole,
      },
    },
    update: {
      legalName: TRADE82_TEAM_NAME,
      tradeName: TRADE82_TEAM_NAME,
      useDefaultLogo: true,
      verificationStatus: "unverified",
    },
    create: {
      ownerUserId,
      companyRole,
      legalName: TRADE82_TEAM_NAME,
      tradeName: TRADE82_TEAM_NAME,
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
