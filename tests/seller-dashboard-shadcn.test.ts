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
  assert.match(sidebar, /href\("\/messages"\)/);
  assert.match(sidebar, /href\("\/settings\/company"\)/);
  assert.match(sidebar, /href\("\/dashboard\/settings"\)/);
  assert.match(main, /isActive=\{item\.active\}/);
  assert.match(main, /disabled=\{item\.disabled\}/);
  assert.match(main, /aria-disabled=\{item\.disabled \|\| undefined\}/);
  assert.match(main, /item\.disabled \|\| !item\.url \? undefined : <Link href=\{item\.url\}/);
  assert.match(documents, /item\.disabled \|\| !item\.url \? undefined : <Link href=\{item\.url\}/);
});

test("seller summary is company-scoped and returns the read-only revenue series without caching", () => {
  const api = source("src/app/api/dashboard/summary/route.ts");

  assert.match(api, /getUserCompany\(user\.id, role\)/);
  assert.match(api, /sellerCompanyId: company\.id/);
  assert.match(api, /SELLER_DASHBOARD_HISTORY_DAYS/);
  assert.match(api, /buildSellerDashboardSeries/);
  assert.match(api, /paidAt: \{ gte: sellerDashboardStart \}/);
  assert.match(api, /grossAmount: true/);
  assert.match(api, /paymentRefund\.findMany/);
  assert.match(api, /status: "succeeded"/);
  assert.match(api, /lastStripeEventCreatedAt: \{ gte: sellerDashboardStart \}/);
  assert.match(api, /paymentRequest: \{ sellerCompanyId: company\.id \}/);
  assert.match(api, /sellerDashboard: \{\s*series: sellerDashboardSeries/);
  assert.match(api, /status: "sent"/);
  assert.match(api, /status: \{ in: \["REQUESTED", "SUBMITTED", "NEGOTIATING"\] \}/);
  assert.match(api, /paymentStatus: "PAID"/);
  assert.match(api, /newLeads: newLeadCount/);
  assert.match(api, /quotesInProgress: quotesInProgressCount/);
  assert.match(api, /paidOrders: paidOrderCount/);
  assert.match(api, /Cache-Control": "no-store"/);
  assert.match(api, /messages: \{/);
  assert.match(api, /lastMessage: item\.messages\[0\]\?\.body \|\| item\.message/);
});

test("seller shell keeps the dashboard-01 hierarchy and uses the selected range for KPIs and revenue", () => {
  const shell = source("src/components/seller-dashboard-shell.tsx");
  const header = source("src/components/seller-dashboard-site-header.tsx");
  const publicHeader = source("src/components/site-header.tsx");
  const footer = source("src/components/site-footer.tsx");
  const cards = source("src/components/section-cards.tsx");
  const table = source("src/components/data-table.tsx");
  const chart = source("src/components/chart-area-interactive.tsx");

  assert.match(shell, /<SidebarProvider/);
  assert.match(shell, /<AppSidebar variant="inset"/);
  assert.match(shell, /<SidebarInset>/);
  assert.match(shell, /<SiteHeader/);
  assert.match(shell, /<SectionCards/);
  assert.match(shell, /<ChartAreaInteractive/);
  assert.match(shell, /<DataTable/);
  assert.match(shell, /status: "error"/);
  assert.match(shell, /<DashboardClient role="seller" activeSection=\{activeSection\}/);
  assert.match(shell, /getSellerDashboardKpis\(dashboardSeries, periodDays\)/);
  assert.match(shell, /netRevenueCents: point\.netRevenueCents/);
  assert.match(shell, /revenueEvents: point\.revenueEvents/);
  assert.match(cards, /sellerDashboard\.netRevenue/);
  assert.doesNotMatch(cards, /sellerDashboard\.live/);
  assert.match(table, /status === "error"/);
  assert.match(chart, /sellerDashboard\.noRevenue/);
  assert.match(chart, /h-\[250px\] w-full items-center justify-center/);
  assert.match(chart, /fillNetRevenue/);
  assert.match(chart, /value="90d"/);
  assert.match(header, /SidebarTrigger/);
  assert.match(publicHeader, /isSellerDashboard = pathWithoutLocale === "\/dashboard\/seller"/);
  assert.match(publicHeader, /if \(isSellerDashboard\) return null/);
  assert.match(footer, /stripLocale\(pathname\) === "\/dashboard\/seller"/);
  assert.match(cards, /bg-gradient-to-t/);
  assert.match(cards, /@xl\/main:grid-cols-2/);
  assert.match(cards, /@5xl\/main:grid-cols-4/);
  assert.match(chart, /aspect-auto h-\[250px\] w-full/);
  assert.match(table, /overflow-hidden rounded-lg border/);
  assert.match(table, /SheetContent side=\{isMobile \? "bottom" : "right"\}/);
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
  assert.equal(en.netRevenue, "Net Revenue");
  assert.equal(ko.netRevenue, "순매출");
});
