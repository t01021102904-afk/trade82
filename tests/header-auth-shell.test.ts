import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const repositoryRoot = process.cwd();

function readSource(relativePath: string) {
  return readFileSync(path.join(repositoryRoot, relativePath), "utf8");
}

test("public header navigation only exposes Marketplace and Sellers", () => {
  const navigationSource = readSource("src/lib/public-navigation.ts");
  const headerSource = readSource("src/components/site-header.tsx");

  assert.match(navigationSource, /href: "\/marketplace"/);
  assert.match(navigationSource, /href: "\/sellers"/);
  assert.doesNotMatch(navigationSource, /href: "\/buyers"/);
  assert.doesNotMatch(navigationSource, /href: "\/pricing"/);
  assert.match(headerSource, /publicNavigationLinks/);
  assert.match(headerSource, /locale\.english/);
  assert.match(headerSource, /locale\.korean/);
  assert.match(headerSource, /common\.signIn/);
  assert.match(headerSource, /common\.signUp/);
});

test("all localized auth routes render the shared Clerk auth shell", () => {
  const authShell = readSource("src/components/auth-shell.tsx");

  assert.match(authShell, /import \{ SignIn, SignUp \} from "@clerk\/nextjs"/);
  assert.match(authShell, /<SignIn/);
  assert.match(authShell, /<SignUp/);
  assert.match(authShell, /routing="path"/);
  assert.match(authShell, /signUpForceRedirectUrl=\{rolePath\}/);
  assert.match(authShell, /forceRedirectUrl=\{rolePath\}/);
  assert.match(authShell, /redirectSignedInUserFromSignup/);

  for (const [relativePath, locale, mode, basePath] of [
    ["src/app/login/[[...sign-in]]/page.tsx", "en", "login", ""],
    ["src/app/signup/[[...sign-up]]/page.tsx", "en", "signup", ""],
    ["src/app/ko/login/[[...sign-in]]/page.tsx", "ko", "login", "/ko"],
    ["src/app/ko/signup/[[...sign-up]]/page.tsx", "ko", "signup", "/ko"],
  ] as const) {
    const routeSource = readSource(relativePath);

    assert.match(routeSource, /<AuthShell/);
    assert.match(routeSource, new RegExp(`locale="${locale}"`));
    assert.match(routeSource, new RegExp(`mode="${mode}"`));
    assert.match(routeSource, new RegExp(`basePath="${basePath}"`));
  }
});

test("favicon assets use the configured paths and required dimensions", () => {
  const layoutSource = readSource("src/app/layout.tsx");
  const manifestSource = readSource("src/app/manifest.ts");
  const favicon = readFileSync(path.join(repositoryRoot, "src/app/favicon.ico"));

  assert.match(layoutSource, /url: "\/favicon\.ico"/);
  assert.match(layoutSource, /url: "\/icon\.png"/);
  assert.match(layoutSource, /url: "\/apple-touch-icon\.png"/);
  assert.match(manifestSource, /src: "\/icon\.png"/);
  assert.match(manifestSource, /src: "\/apple-touch-icon\.png"/);

  assert.equal(favicon.readUInt16LE(0), 0);
  assert.equal(favicon.readUInt16LE(2), 1);
  assert.equal(favicon.readUInt16LE(4), 3);

  const faviconSizes = Array.from({ length: favicon.readUInt16LE(4) }, (_, index) =>
    favicon.readUInt8(6 + index * 16),
  );
  assert.deepEqual(faviconSizes, [16, 32, 48]);

  for (const [relativePath, expectedWidth, expectedHeight] of [
    ["src/app/icon.png", 512, 512],
    ["public/icon.png", 512, 512],
    ["src/app/apple-icon.png", 180, 180],
    ["public/apple-touch-icon.png", 180, 180],
  ] as const) {
    const image = readFileSync(path.join(repositoryRoot, relativePath));

    assert.equal(image.readUInt32BE(16), expectedWidth);
    assert.equal(image.readUInt32BE(20), expectedHeight);
  }
});
