import "server-only";

import { getDb } from "@/lib/db";
import { adminEmails } from "@/lib/authz";

export const TRADE82_SUPPORT_TEAM_NAME = "Trade82 Support Team";

export async function getOrCreateTrade82SupportTeamCompany() {
  const emails = adminEmails();
  if (!emails.length) return null;

  const db = getDb();
  const owner = await db.userProfile.findFirst({
    where: { email: { in: emails } },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!owner) return null;

  const existingSupportCompany = await db.company.findFirst({
    where: {
      ownerUserId: owner.id,
      companyRole: "buyer",
      OR: [
        { legalName: TRADE82_SUPPORT_TEAM_NAME },
        { tradeName: TRADE82_SUPPORT_TEAM_NAME },
      ],
    },
  });
  if (existingSupportCompany) return existingSupportCompany;

  const existingBuyerCompany = await db.company.findUnique({
    where: {
      ownerUserId_companyRole: {
        ownerUserId: owner.id,
        companyRole: "buyer",
      },
    },
    select: { id: true },
  });
  if (existingBuyerCompany) return null;

  return db.company.create({
    data: {
      ownerUserId: owner.id,
      companyRole: "buyer",
      legalName: TRADE82_SUPPORT_TEAM_NAME,
      tradeName: TRADE82_SUPPORT_TEAM_NAME,
      useDefaultLogo: true,
      website: "https://trade82.com",
      country: "United States",
      city: "",
      stateOrProvince: "",
      businessAddress: "Trade82 support team account",
      description: "Trade82 seller support team account.",
      categories: [],
      verificationStatus: "unverified",
    },
  });
}
