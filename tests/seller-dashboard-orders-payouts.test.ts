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

test("seller payout section is a settlement account form without Stripe setup", () => {
  const client = source("src/components/payout-information-client.tsx");
  const en = JSON.parse(source("messages/en.json")).payouts;
  const ko = JSON.parse(source("messages/ko.json")).payouts;

  assert.match(client, /@\/components\/ui\/field/);
  assert.match(client, /@\/components\/ui\/checkbox/);
  assert.match(client, /@\/components\/ui\/select/);
  assert.match(client, /@\/components\/ui\/input/);
  assert.match(client, /@\/components\/ui\/button/);
  assert.match(client, /FieldLegend/);
  assert.match(client, /FieldSeparator/);
  assert.doesNotMatch(client, /StripeConnectOnboardingPanel/);
  assert.doesNotMatch(client, /payouts\.sellerSettings/);
  assert.doesNotMatch(
    client,
    /theme-|bm-|#34B386|#34b386|emerald-|green-|zinc-|slate-/,
  );

  assert.equal(en.informationTitle, "Settlement account");
  assert.equal(ko.informationTitle, "정산 계좌");
  assert.equal(en.sellerSettings, undefined);
  assert.equal(ko.sellerSettings, undefined);
});
