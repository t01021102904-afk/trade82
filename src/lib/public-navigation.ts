import type { AccountRole } from "@/lib/types";

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
}: {
  isSignedIn: boolean;
  role: AccountRole | null | undefined;
  partnerProfile: { id: string } | null | undefined;
}) {
  return isSignedIn && role === "user" && partnerProfile != null;
}

// Keep a static export for consumers that need the public link list.
export const publicNavigationLinks = getPublicNavigationLinks();
