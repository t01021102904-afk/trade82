import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function source(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test("seller dashboard reuses the real public header", () => {
  const layout = source("src/app/layout.tsx");
  const shell = source("src/components/seller-dashboard-shell.tsx");
  const sidebar = source("src/components/app-sidebar.tsx");
  const header = source("src/components/site-header.tsx");

  assert.match(layout, /<SiteHeader \/>/);
  assert.equal(
    existsSync(path.join(root, "src/components/seller-dashboard-site-header.tsx")),
    false,
  );

  assert.doesNotMatch(shell, /seller-dashboard-site-header/);
  assert.doesNotMatch(shell, /<SiteHeader/);
  assert.match(shell, /min-h-\[calc\(100svh-3\.5rem\)\]/);
  assert.match(shell, /md:top-14/);
  assert.match(shell, /md:h-\[calc\(100svh-3\.5rem\)\]/);
  assert.doesNotMatch(sidebar, /section=messages/);

  assert.doesNotMatch(header, /isSellerDashboard/);
  assert.doesNotMatch(header, /if \(.*dashboard.*\) return null/);
  assert.match(header, /src="\/trade82-logo\.png"/);
  assert.match(header, /getPublicNavigationLinks\(\)/);
  assert.match(header, /href: "\/dashboard"/);
  assert.match(header, /href: "\/messages"/);
  assert.match(header, /<ClerkUserButton \/>/);
  assert.match(header, /nextLocale === "en" \? "EN" : "KO"/);
  assert.match(header, /UnreadMessageBadge/);

  assert.match(shell, /withLocale\("\/messages", locale\)/);
  assert.match(shell, /actionHref: `\$\{messagesUrl\}\?inquiryId=/);
});
