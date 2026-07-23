const basePublicNavigationLinks = [
  { href: "/marketplace", labelKey: "nav.marketplace" },
  { href: "/sellers", labelKey: "nav.sellers" },
] as const;

export function getPublicNavigationLinks() {
  return [...basePublicNavigationLinks];
}

// Keep a static export for consumers that need the public link list.
export const publicNavigationLinks = getPublicNavigationLinks();
