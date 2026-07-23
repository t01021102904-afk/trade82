const basePublicNavigationLinks = [
  { href: "/marketplace", labelKey: "nav.marketplace" },
  { href: "/sellers", labelKey: "nav.sellers" },
] as const;

// Partner onboarding is reached from the authenticated role-selection flow,
// never from the public navigation surface.
export function getPublicNavigationLinks(_partnerProgramEnabled: boolean) {
  return [...basePublicNavigationLinks];
}

// A static consumer is fail-closed. The root layout opts in explicitly only
// after resolving the server-only feature flag.
export const publicNavigationLinks = getPublicNavigationLinks(false);
