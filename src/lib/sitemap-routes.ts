import { canonicalPublicPath } from "@/lib/english-canonical-path";

export const staticSitemapPaths = [
  "/",
  "/ko",
  "/marketplace",
  "/ko/marketplace",
  "/sellers",
  "/ko/sellers",
  "/buyers",
  "/ko/buyers",
  "/pricing",
  "/ko/pricing",
  "/sourcing-terms",
  "/ko/sourcing-terms",
  "/business",
  "/ko/business",
] as const;

export function localizedSitemapPaths(englishPath: string) {
  const canonicalEnglishPath = canonicalPublicPath(englishPath);
  const koreanPath =
    canonicalEnglishPath === "/"
      ? "/ko"
      : `/ko${canonicalEnglishPath}`;

  return [canonicalEnglishPath, koreanPath] as const;
}
