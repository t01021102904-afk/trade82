/**
 * English is served without a locale prefix. Keep this helper independent of
 * Next.js so redirects, metadata, and sitemap tests use the same rule.
 */
export function getUnprefixedEnglishPath(pathname: string): string | null {
  if (pathname === "/en") return "/";
  if (pathname.startsWith("/en/")) return pathname.slice(3) || "/";
  return null;
}

export function canonicalPublicPath(pathname: string): string {
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return getUnprefixedEnglishPath(normalizedPath) ?? normalizedPath;
}

export function publicLocaleAlternatePaths(pathname: string) {
  const canonicalPath = canonicalPublicPath(pathname);
  const englishPath =
    canonicalPath === "/ko"
      ? "/"
      : canonicalPath.startsWith("/ko/")
        ? canonicalPath.slice(3)
        : canonicalPath;
  const koreanPath = englishPath === "/" ? "/ko" : `/ko${englishPath}`;

  return {
    en: englishPath,
    ko: koreanPath,
    "x-default": englishPath,
  };
}
