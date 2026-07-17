const basePublicNavigationLinks = [
  { href: "/marketplace", labelKey: "nav.marketplace" },
  { href: "/sellers", labelKey: "nav.sellers" },
] as const;

const partnerProgramNavigationLink = {
  href: "/partner",
  labelKey: "nav.partnerProgram",
} as const;

// The server resolves the feature flag and passes this boolean to the client
// header. Do not read process.env from public navigation code.
export function getPublicNavigationLinks(partnerProgramEnabled: boolean) {
  return partnerProgramEnabled
    ? [...basePublicNavigationLinks, partnerProgramNavigationLink]
    : [...basePublicNavigationLinks];
}

// A static consumer is fail-closed. The root layout opts in explicitly only
// after resolving the server-only feature flag.
export const publicNavigationLinks = getPublicNavigationLinks(false);
