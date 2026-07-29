import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function source(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test("sidebar footer user menu uses one direct Base UI trigger button", () => {
  const navUser = source("src/components/nav-user.tsx");

  assert.match(navUser, /<DropdownMenuTrigger\s+type="button"/);
  assert.match(navUser, /data-\[popup-open\]:bg-sidebar-accent/);
  assert.doesNotMatch(navUser, /SidebarMenuButton/);
  assert.doesNotMatch(
    navUser,
    /<DropdownMenuTrigger[\s\S]*?render=\{/,
  );
});

test("sidebar footer menu contains profile, settings, help, and sign out actions", () => {
  const navUser = source("src/components/nav-user.tsx");
  const sidebar = source("src/components/app-sidebar.tsx");

  assert.match(navUser, /router\.push\(companyProfileUrl\)/);
  assert.match(navUser, /router\.push\(settingsUrl\)/);
  assert.match(navUser, /router\.push\(helpUrl\)/);
  assert.match(navUser, /signOut/);
  assert.match(sidebar, /helpUrl=\{href\("\/how-it-works"\)\}/);
});

test("company profile routes remain available", () => {
  for (const route of [
    "src/app/settings/company/page.tsx",
    "src/app/en/settings/company/page.tsx",
    "src/app/ko/settings/company/page.tsx",
  ]) {
    assert.match(source(route), /CompanyProfileSettings/);
  }
});
