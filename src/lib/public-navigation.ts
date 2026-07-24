import type { AccountRole } from "@/lib/types";
import { isPartnerOnlyAccount } from "@/lib/partner-account-routing";

export { isPartnerOnlyAccount } from "@/lib/partner-account-routing";

const basePublicNavigationLinks = [
  { href: "/marketplace", labelKey: "nav.marketplace" },
  { href: "/sellers", labelKey: "nav.sellers" },
] as const;

export function getPublicNavigationLinks() {
  return [...basePublicNavigationLinks];
}

export function isPartnerOnlyNavigationAccount({
  isSignedIn,
  role,
  partnerProfile,
  companies,
}: {
  isSignedIn: boolean;
  role: AccountRole | null | undefined;
  partnerProfile: { id: string } | null | undefined;
  companies: ReadonlyArray<{ companyRole: "seller" | "buyer" }>;
}) {
  return (
    isSignedIn &&
    role !== "admin" &&
    isPartnerOnlyAccount({
      partnerProfile,
      companyState: {
        hasBuyerCompany: companies.some((company) => company.companyRole === "buyer"),
        hasSellerCompany: companies.some((company) => company.companyRole === "seller"),
      },
    })
  );
}

// Keep a static export for consumers that need the public link list.
export const publicNavigationLinks = getPublicNavigationLinks();
