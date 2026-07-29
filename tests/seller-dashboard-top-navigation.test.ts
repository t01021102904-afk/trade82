import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

test("seller dashboard exposes standalone messages in the top navigation", () => {
  const shell = readFileSync(
    path.join(root, "src/components/seller-dashboard-shell.tsx"),
    "utf8",
  );
  const sidebar = readFileSync(
    path.join(root, "src/components/app-sidebar.tsx"),
    "utf8",
  );
  const header = readFileSync(
    path.join(root, "src/components/seller-dashboard-site-header.tsx"),
    "utf8",
  );

  assert.doesNotMatch(shell, /MessagesClient/);
  assert.doesNotMatch(shell, /activeSection === "messages"/);
  assert.doesNotMatch(shell, /\?section=messages/);
  assert.match(shell, /withLocale\("\/messages", locale\)/);
  assert.match(shell, /actionHref: `\$\{messagesUrl\}\?inquiryId=/);

  assert.doesNotMatch(sidebar, /section=messages/);

  for (const label of [
    "Marketplace",
    "Sellers",
    "List product",
    "Dashboard",
    "Messages",
  ]) {
    assert.match(header, new RegExp(`label: "${label}"`));
  }

  assert.match(header, /href: "\/messages"/);
  assert.match(header, />\s*EN\s*</);
  assert.match(header, />\s*KO\s*</);
});
