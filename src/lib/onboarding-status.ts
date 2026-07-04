import "server-only";

import { getDb } from "@/lib/db";
import type { AccountRole } from "@/lib/types";

export type CompanyRoleState = {
  hasBuyerCompany: boolean;
  hasSellerCompany: boolean;
};

export const ROLE_SELECTION_SOURCE = "trade82-role-picker";

export async function getOnboardingCompanyState(
  userProfileId: string,
): Promise<CompanyRoleState> {
  const companies = await getDb().company.findMany({
    where: { ownerUserId: userProfileId },
    select: { companyRole: true },
  });

  return {
    hasBuyerCompany: companies.some((company) => company.companyRole === "buyer"),
    hasSellerCompany: companies.some((company) => company.companyRole === "seller"),
  };
}

export function inferRoleFromCompanyState(
  companyState: CompanyRoleState,
): AccountRole | null {
  if (companyState.hasBuyerCompany && companyState.hasSellerCompany) return "both";
  if (companyState.hasBuyerCompany) return "buyer";
  if (companyState.hasSellerCompany) return "seller";
  return null;
}

export function hasAnyOnboardingCompany(companyState: CompanyRoleState) {
  return companyState.hasBuyerCompany || companyState.hasSellerCompany;
}

export function isOnboardingCompleteForRole(
  role: AccountRole,
  companyState: CompanyRoleState,
) {
  if (role === "admin") return true;
  if (role === "buyer") return companyState.hasBuyerCompany;
  if (role === "seller") return companyState.hasSellerCompany;
  if (role === "both") {
    return companyState.hasBuyerCompany || companyState.hasSellerCompany;
  }
  return false;
}

export function onboardingRoleSegment(role: AccountRole) {
  return role === "buyer" ? "buyer" : "seller";
}
