const basePublicNavigationLinks = [
  { href: "/marketplace", labelKey: "nav.marketplace" },
  { href: "/sellers", labelKey: "nav.sellers" },
  { href: "/partner", labelKey: "nav.partnerProgram" },
] as const;

// The public landing page remains discoverable independently of the gated
// partner enrollment and dashboard flows.
export function getPublicNavigationLinks(_partnerProgramEnabled: boolean) {
  return [...basePublicNavigationLinks];
}

// A static consumer is fail-closed. The root layout opts in explicitly only
// after resolving the server-only feature flag.
export const publicNavigationLinks = getPublicNavigationLinks(false);
