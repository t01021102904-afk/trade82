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

export function getSignedInHeaderAction({
  role,
  isAdmin,
  isPartnerOnly,
}: {
  role: AccountRole | null | undefined;
  isAdmin: boolean;
  isPartnerOnly: boolean;
}) {
  if (isAdmin || isPartnerOnly) return null;
  if (role === "seller" || role === "both") {
    return { href: "/dashboard/seller/products/new", labelKey: "nav.listProduct" } as const;
  }
  if (role === "buyer") {
    return { href: "/dashboard/rfqs/new", labelKey: "nav.createRfq" } as const;
  }
  return null;
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
