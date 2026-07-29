import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function source(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test("seller orders and payouts stay inside the dashboard shell", () => {
  const sidebar = source("src/components/app-sidebar.tsx");
  const shell = source("src/components/seller-dashboard-shell.tsx");
  const dashboard = source("src/components/dashboard-client.tsx");
  const orders = source("src/components/seller-orders-section.tsx");
  const payouts = source(
    "src/components/seller-payout-information-section.tsx",
  );

  assert.match(sidebar, /\?section=orders/);
  assert.match(sidebar, /\?section=payouts/);
  assert.doesNotMatch(
    sidebar,
    /navOrders"\), url: href\("\/orders"\)/,
  );
  assert.doesNotMatch(
    sidebar,
    /navPayouts"\), url: href\("\/settings\/payout-information"\)/,
  );

  assert.match(shell, /"orders"/);
  assert.match(shell, /"payouts"/);

  assert.match(dashboard, /\| "orders"/);
  assert.match(dashboard, /\| "payouts"/);
  assert.match(
    dashboard,
    /activeSection === "orders"[\s\S]*?<SellerOrdersSection/,
  );
  assert.match(
    dashboard,
    /activeSection === "payouts"[\s\S]*?<SellerPayoutInformationSection/,
  );

  assert.match(orders, /OrdersClient/);
  assert.match(orders, /locale=\{locale\}/);
  assert.match(orders, /\[&>main\]:max-w-none/);
  assert.match(payouts, /payout-information-client/);
  assert.match(payouts, /\[&>main\]:max-w-none/);
});
