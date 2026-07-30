import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function source(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test("seller routes use the shadcn shell while buyer routes keep RoleDashboard", () => {
  for (const path of [
    "src/app/dashboard/seller/page.tsx",
    "src/app/en/dashboard/seller/page.tsx",
    "src/app/ko/dashboard/seller/page.tsx",
  ]) {
    const value = source(path);
    assert.match(value, /SellerDashboardShell/);
    assert.match(value, /requireDashboardRole/);
  }

  for (const path of [
    "src/app/dashboard/buyer/page.tsx",
    "src/app/en/dashboard/buyer/page.tsx",
    "src/app/ko/dashboard/buyer/page.tsx",
  ]) {
    assert.match(source(path), /RoleDashboard role="buyer"/);
  }
});

test("seller sidebar preserves localized active routes and safe disabled controls", () => {
  const sidebar = source("src/components/app-sidebar.tsx");
  const main = source("src/components/nav-main.tsx");
  const documents = source("src/components/nav-documents.tsx");

  assert.match(sidebar, /withLocale/);
  assert.match(sidebar, /section=products/);
  assert.match(sidebar, /section=documents/);
  assert.match(sidebar, /section=marketing/);
  assert.doesNotMatch(sidebar, /href\("\/messages"\)/);
  assert.match(sidebar, /companyProfileUrl=\{href\("\/settings\/company"\)\}/);
  assert.match(sidebar, /settingsUrl=\{href\("\/dashboard\/settings"\)\}/);
  assert.match(main, /isActive=\{item\.active\}/);
  assert.match(main, /disabled=\{item\.disabled\}/);
  assert.match(main, /aria-disabled=\{item\.disabled \|\| undefined\}/);
  assert.match(main, /item\.disabled \|\| !item\.url \? undefined : <Link href=\{item\.url\}/);
  assert.doesNotMatch(main, /CirclePlus|addProductUrl|leadsUrl/);
  assert.match(documents, /item\.disabled \|\| !item\.url \? undefined : <Link href=\{item\.url\}/);
});

test("seller summary is company-scoped and returns concrete KPI fields without caching", () => {
  const api = source("src/app/api/dashboard/summary/route.ts");

  assert.match(api, /getUserCompany\(user\.id, role\)/);
  assert.match(api, /sellerCompanyId: company\.id/);
  assert.match(api, /status: "sent"/);
  assert.match(api, /status: \{ in: \["REQUESTED", "SUBMITTED", "NEGOTIATING"\] \}/);
  assert.match(api, /paymentStatus: "PAID"/);
  assert.match(api, /newLeads: newLeadCount/);
  assert.match(api, /quotesInProgress: quotesInProgressCount/);
  assert.match(api, /paidOrders: paidOrderCount/);
  assert.match(api, /Cache-Control": "no-store"/);
  assert.match(api, /messages: \{/);
  assert.match(api, /lastMessage: item\.messages\[0\]\?\.body \|\| item\.message/);
  assert.match(api, /buildSellerDashboardCurrencySeries/);
  assert.match(api, /sellerDashboard: \{/);
  assert.match(api, /currencySeries: sellerDashboard\.currencySeries/);
});

test("seller shell keeps the dashboard-01 hierarchy below the public header", () => {
  const shell = source("src/components/seller-dashboard-shell.tsx");
  const publicHeader = source("src/components/site-header.tsx");
  const cards = source("src/components/section-cards.tsx");
  const table = source("src/components/data-table.tsx");
  const chart = source("src/components/chart-area-interactive.tsx");

  assert.match(shell, /<SidebarProvider/);
  assert.match(shell, /min-h-\[calc\(100svh-3\.5rem\)\]/);
  assert.match(shell, /<AppSidebar/);
  assert.match(shell, /md:top-14/);
  assert.match(shell, /md:h-\[calc\(100svh-3\.5rem\)\]/);
  assert.match(shell, /<SidebarInset>/);
  assert.doesNotMatch(shell, /seller-dashboard-site-header/);
  assert.doesNotMatch(shell, /<SiteHeader/);
  assert.match(shell, /<SectionCards/);
  assert.match(shell, /<ChartAreaInteractive/);
  assert.match(shell, /<DataTable/);
  assert.match(shell, /status: "error"/);
  assert.match(shell, /<DashboardClient role="seller" activeSection=\{activeSection\}/);
  assert.match(cards, /SellerDashboardKpis/);
  assert.match(table, /status === "error"/);
  assert.match(chart, /noNetSales/);
  assert.match(shell, /const chartData: SellerNetSalesChartPoint\[\] \| null/);
  assert.match(publicHeader, /trade82-logo\.png/);
  assert.match(publicHeader, /getPublicNavigationLinks/);
  assert.match(publicHeader, /ClerkUserButton/);
  assert.match(publicHeader, /const appLinks =/);
  assert.match(cards, /bg-gradient-to-t/);
  assert.match(cards, /@xl\/main:grid-cols-2/);
  assert.match(cards, /@5xl\/main:grid-cols-4/);
  assert.match(chart, /aspect-auto h-\[250px\] w-full/);
  assert.match(chart, /last3Months/);
  assert.match(table, /overflow-hidden rounded-lg border/);
  assert.match(table, /SheetContent side=\{isMobile \? "bottom" : "right"\}/);
});

test("seller user menu is a button and exposes explicit profile routes", () => {
  const navUser = source("src/components/nav-user.tsx");

  assert.match(navUser, /type="button"/);
  assert.doesNotMatch(navUser, /DropdownMenuItem render=\{<Link/);
  assert.match(navUser, /navigate\(companyProfileUrl\)/);
  assert.match(navUser, /navigate\(settingsUrl\)/);
});

test("public header remains visible while the seller dashboard footer stays hidden", () => {
  const layout = source("src/app/layout.tsx");
  const header = source("src/components/site-header.tsx");
  const footer = source("src/components/site-footer.tsx");

  assert.match(layout, /<SiteHeader \/>/);
  assert.match(header, /stripLocale\(pathname\)/);
  assert.doesNotMatch(header, /isSellerDashboard/);
  assert.doesNotMatch(header, /if \(isSellerDashboard\) return null/);
  assert.match(footer, /stripLocale\(pathname\) === "\/dashboard\/seller"/);
});

test("seller dashboard has no shadcn dashboard-01 sample data", () => {
  const files = [
    "src/components/app-sidebar.tsx",
    "src/components/chart-area-interactive.tsx",
    "src/components/data-table.tsx",
    "src/components/nav-user.tsx",
    "src/components/section-cards.tsx",
    "src/components/seller-dashboard-shell.tsx",
  ].map(source).join("\n");

  const forbiddenDemoFragments = [
    ["Acme", " Inc"],
    ["m@", "example.com"],
    ["Eddie", " Lake"],
    ["Ja", "mik"],
    ["Active", " Proposals"],
    ["Word", " Assistant"],
    ["Data", " Library"],
    ["data", ".json"],
  ].map((parts) => parts.join(""));
  assert.doesNotMatch(files, new RegExp(forbiddenDemoFragments.join("|")));
  assert.doesNotMatch(files, /theme-|bm-|#34B386|#34b386|emerald-|green-|zinc-|slate-/);
});

test("seller dashboard English and Korean labels stay in parity", () => {
  const en = JSON.parse(source("messages/en.json")).sellerDashboard;
  const ko = JSON.parse(source("messages/ko.json")).sellerDashboard;
  assert.deepEqual(Object.keys(en).sort(), Object.keys(ko).sort());
  assert.equal(en.navOverview, "Overview");
  assert.equal(ko.navOverview, "개요");
  assert.equal(en.newLeads, "New Leads");
  assert.equal(ko.newLeads, "새 리드");
});

test("seller products use a shadcn management table with menu actions", () => {
  const dashboard = source("src/components/dashboard-client.tsx");
  const table = source("src/components/seller-products-table.tsx");
  const editor = source("src/components/product-management.tsx");

  assert.match(dashboard, /<SellerProductsTable/);
  assert.doesNotMatch(dashboard, /<SellerProductCard/);
  assert.match(dashboard, /<Sheet/);
  assert.match(dashboard, /<ProductEditor[\s\S]*embedded/);
  for (const component of ["TableHeader", "TableBody", "TableCell", "DropdownMenu", "DropdownMenuItem", "Badge"]) {
    assert.match(table, new RegExp(`<${component}`));
  }
  assert.match(table, /productTableHeader/);
  assert.match(table, /productTableTarget/);
  assert.match(table, /productTableLimit/);
  assert.match(table, /productTableViews/);
  assert.match(table, /onSetPreparing/);
  assert.match(table, /onPublish/);
  assert.match(table, /onDelete/);
  assert.match(table, /ProductImage/);
  assert.match(table, /table-fixed/);
  assert.doesNotMatch(table, /product\.shortDescription/);
  assert.match(table, /truncate text-sm font-medium/);
  assert.match(table, /productTermsRequired/);
  assert.match(
    dashboard,
    /data-\[side=right\]:sm:max-w-\[1180px\]/,
  );
  assert.match(dashboard, /pt-12/);
  assert.match(editor, /embedded = false/);
});
