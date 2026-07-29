import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function source(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test("seller sidebar account menu points to a real company profile route", () => {
  const sidebar = source("src/components/app-sidebar.tsx");
  const navUser = source("src/components/nav-user.tsx");

  assert.match(
    sidebar,
    /companyProfileUrl=\{href\("\/settings\/company"\)\}/,
  );
  assert.match(
    sidebar,
    /navCompanyProfile[\s\S]*href\("\/settings\/company"\)/,
  );

  assert.match(navUser, /type="button"/);
  assert.match(navUser, /router\.push\(companyProfileUrl\)/);
});

test("company profile settings routes exist for default, English, and Korean URLs", () => {
  const routes = [
    "src/app/settings/company/page.tsx",
    "src/app/en/settings/company/page.tsx",
    "src/app/ko/settings/company/page.tsx",
  ];

  for (const route of routes) {
    assert.equal(existsSync(path.join(root, route)), true, route);
    const page = source(route);
    assert.match(page, /CompanyProfileSettings/);
    assert.match(page, /<main/);
  }
});
