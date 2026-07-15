import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  canonicalPublicPath,
  getUnprefixedEnglishPath,
  publicLocaleAlternatePaths,
} from "../src/lib/english-canonical-path.ts";
import {
  localizedSitemapPaths,
  staticSitemapPaths,
} from "../src/lib/sitemap-routes.ts";

const repositoryRoot = process.cwd();

function readSource(relativePath: string) {
  return readFileSync(path.join(repositoryRoot, relativePath), "utf8");
}

test("legacy /en paths use an unprefixed English canonical path", () => {
  assert.equal(getUnprefixedEnglishPath("/en"), "/");
  assert.equal(getUnprefixedEnglishPath("/en/marketplace"), "/marketplace");
  assert.equal(getUnprefixedEnglishPath("/en/products/product-123"), "/products/product-123");
  assert.equal(getUnprefixedEnglishPath("/environments"), null);
  assert.equal(getUnprefixedEnglishPath("/ko/marketplace"), null);
  assert.equal(canonicalPublicPath("/en/sellers"), "/sellers");

  const proxySource = readSource("src/proxy.ts");
  assert.match(proxySource, /getUnprefixedEnglishPath\(request\.nextUrl\.pathname\)/);
  assert.match(proxySource, /NextResponse\.redirect\(redirectUrl, 308\)/);
  assert.match(proxySource, /const redirectUrl = request\.nextUrl\.clone\(\)/);
});

test("canonical hreflang pairs use unprefixed English, Korean, and x-default paths", () => {
  assert.deepEqual(publicLocaleAlternatePaths("/marketplace"), {
    en: "/marketplace",
    ko: "/ko/marketplace",
    "x-default": "/marketplace",
  });
  assert.deepEqual(publicLocaleAlternatePaths("/ko/products/product-123"), {
    en: "/products/product-123",
    ko: "/ko/products/product-123",
    "x-default": "/products/product-123",
  });
  assert.deepEqual(publicLocaleAlternatePaths("/en/sellers"), {
    en: "/sellers",
    ko: "/ko/sellers",
    "x-default": "/sellers",
  });

  const seoSource = readSource("src/lib/seo.ts");
  assert.match(seoSource, /canonical: url/);
  assert.match(seoSource, /publicLocaleAlternates\(canonicalPath\)/);
  assert.match(seoSource, /email: "contact@trade82\.com"/);
  assert.match(seoSource, /alternateName: "trade82\.com"/);
});

test("sitemap only emits canonical English and Korean variants with stable static entries", () => {
  const sitemapSource = readSource("src/app/sitemap.ts");
  const sitemapRoutesSource = readSource("src/lib/sitemap-routes.ts");

  assert.equal(new Set(staticSitemapPaths).size, staticSitemapPaths.length);
  assert.equal(
    staticSitemapPaths.map(String).some((path) => path === "/en" || path.startsWith("/en/")),
    false,
  );
  assert.deepEqual(localizedSitemapPaths("/companies/company-123"), [
    "/companies/company-123",
    "/ko/companies/company-123",
  ]);
  assert.deepEqual(localizedSitemapPaths("/en/stores/store-123"), [
    "/stores/store-123",
    "/ko/stores/store-123",
  ]);

  assert.match(sitemapRoutesSource, /"\/marketplace"/);
  assert.match(sitemapRoutesSource, /"\/ko\/marketplace"/);
  assert.doesNotMatch(sitemapSource, /new Date\(\)/);
  assert.doesNotMatch(sitemapSource, /changeFrequency|priority/);
  assert.match(sitemapSource, /lastModified: Date/);
});

test("public navigation and JSON-LD emphasize public discovery pages instead of auth routes", () => {
  const navigationSource = readSource("src/lib/public-navigation.ts");
  const headerSource = readSource("src/components/site-header.tsx");
  const seoSource = readSource("src/lib/seo.ts");

  for (const href of ["/marketplace", "/sellers", "/buyers", "/pricing"]) {
    assert.match(navigationSource, new RegExp(`href: "${href}"`));
  }
  assert.match(headerSource, /publicNavigationLinks/);

  const navigationJsonLd = seoSource.slice(seoSource.indexOf("export function siteNavigationJsonLd"));
  assert.match(navigationJsonLd, /"Marketplace"/);
  assert.match(navigationJsonLd, /"Sellers"/);
  assert.match(navigationJsonLd, /"Buyers"/);
  assert.match(navigationJsonLd, /"Pricing"/);
  assert.doesNotMatch(navigationJsonLd, /Login|Sign up|Signup/);
});

test("private auth routes remain noindex and robots exclude private application areas", () => {
  const robotsSource = readSource("src/app/robots.ts");
  const loginSource = readSource("src/app/login/[[...sign-in]]/page.tsx");
  const signupSource = readSource("src/app/signup/[[...sign-up]]/page.tsx");

  for (const privatePath of ["/login", "/signup", "/dashboard", "/messages", "/settings", "/admin", "/onboarding"]) {
    assert.match(robotsSource, new RegExp(`"${privatePath}"`));
  }
  assert.match(loginSource, /privatePageMetadata/);
  assert.match(signupSource, /privatePageMetadata/);
});
