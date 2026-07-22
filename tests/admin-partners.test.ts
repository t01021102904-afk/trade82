import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import {
  ADMIN_PARTNER_DEFAULT_PAGE_SIZE,
  ADMIN_PARTNER_MAX_PAGE_SIZE,
  parseAdminPartnerListQuery,
} from "../src/lib/admin-partners.ts";
import {
  loadAdminPartnerDetailRouteData,
  loadAdminPartnerListRouteData,
} from "../src/lib/admin-partner-route-data.ts";

test("admin partner list query defaults are bounded and deterministic", () => {
  assert.deepEqual(parseAdminPartnerListQuery({}), {
    search: "",
    status: "all",
    country: null,
    payoutSetup: "all",
    sort: "newest",
    page: 1,
    pageSize: ADMIN_PARTNER_DEFAULT_PAGE_SIZE,
  });
});

test("admin partner list query trims and caps search and page size", () => {
  const query = parseAdminPartnerListQuery({
    search: `  ${"partner ".repeat(30)} `,
    page: "4",
    pageSize: String(ADMIN_PARTNER_MAX_PAGE_SIZE + 100),
    status: "suspended",
    country: " KR ",
    payoutSetup: "enabled",
    sort: "netCommission",
  });

  assert.equal(query.search.length, 100);
  assert.equal(query.search.startsWith("partner"), true);
  assert.equal(query.page, 4);
  assert.equal(query.pageSize, ADMIN_PARTNER_MAX_PAGE_SIZE);
  assert.equal(query.status, "suspended");
  assert.equal(query.country, "KR");
  assert.equal(query.payoutSetup, "enabled");
  assert.equal(query.sort, "netCommission");
});

test("unknown admin partner filters fail closed to safe defaults", () => {
  const query = parseAdminPartnerListQuery({
    status: "deleted",
    payoutSetup: "transfer",
    sort: "rawSql",
    page: "0",
    pageSize: "-1",
  });

  assert.equal(query.status, "all");
  assert.equal(query.payoutSetup, "all");
  assert.equal(query.sort, "newest");
  assert.equal(query.page, 1);
  assert.equal(query.pageSize, ADMIN_PARTNER_DEFAULT_PAGE_SIZE);
});

test("admin partner list ignores analyticsRange because list metrics are all-time", () => {
  const query = parseAdminPartnerListQuery({ analyticsRange: "7d" });
  assert.equal("analyticsRange" in query, false);
});

test("admin partner list route rejects logged-out visitors before data lookup", async () => {
  let dataLookupCalled = false;
  await assert.rejects(
    () =>
      loadAdminPartnerListRouteData(
        {},
        {
          requireAdminFn: async () => {
            throw new Response("Unauthorized", { status: 401 });
          },
          getListData: async () => {
            dataLookupCalled = true;
            throw new Error("must not run");
          },
        },
      ),
    (error) => error instanceof Response && error.status === 401,
  );
  assert.equal(dataLookupCalled, false);
});

test("admin partner list route rejects non-admin users before data lookup", async () => {
  let dataLookupCalled = false;
  await assert.rejects(
    () =>
      loadAdminPartnerListRouteData(
        {},
        {
          requireAdminFn: async () => {
            throw new Response("Forbidden", { status: 403 });
          },
          getListData: async () => {
            dataLookupCalled = true;
            throw new Error("must not run");
          },
        },
      ),
    (error) => error instanceof Response && error.status === 403,
  );
  assert.equal(dataLookupCalled, false);
});

test("admin authorization executes before admin partner list data lookup", async () => {
  const calls: string[] = [];
  const result = await loadAdminPartnerListRouteData(
    { search: "partner" },
    {
      requireAdminFn: async () => {
        calls.push("admin");
        return { id: "admin-user" } as never;
      },
      getListData: async (query) => {
        calls.push(`data:${query.search}`);
        return {
          rows: [],
          total: 0,
          page: 1,
          pageSize: ADMIN_PARTNER_DEFAULT_PAGE_SIZE,
          countries: [],
          invalidPage: false,
        };
      },
    },
  );
  assert.deepEqual(calls, ["admin", "data:partner"]);
  assert.equal(result.failed, false);
});

test("admin partner detail route rejects logged-out and non-admin users before revealing existence", async () => {
  for (const [status, label] of [
    [401, "logged-out"],
    [403, "non-admin"],
  ] as const) {
    let detailLookupCalled = false;
    await assert.rejects(
      () =>
        loadAdminPartnerDetailRouteData(
          `secret-partner-${label}`,
          {},
          {
            requireAdminFn: async () => {
              throw new Response(label, { status });
            },
            getDashboardData: async () => {
              detailLookupCalled = true;
              throw new Error("must not run");
            },
          },
        ),
      (error) => error instanceof Response && error.status === status,
    );
    assert.equal(detailLookupCalled, false);
  }
});

test("admin partner detail route passes explicit partner identity and query after authorization", async () => {
  const calls: string[] = [];
  const result = await loadAdminPartnerDetailRouteData(
    "partner-123",
    {
      analyticsRange: "90d",
      commissionPage: "3",
      memberPage: "2",
    },
    {
      requireAdminFn: async () => {
        calls.push("admin");
        return { id: "admin-user" } as never;
      },
      getDashboardData: async (query) => {
        calls.push(
          `${query.partnerProfileId}:${query.analyticsRange}:${query.commissionPage}:${query.memberPage}`,
        );
        return null;
      },
    },
  );
  assert.deepEqual(calls, ["admin", "partner-123:90d:3:2"]);
  assert.equal(result.data, null);
});

test("admin partner pages preserve localized navigation and admin-readonly safety wiring", async () => {
  const [
    listPage,
    koListPage,
    detailPage,
    koDetailPage,
    detailComponent,
    dashboardView,
    management,
  ] = await Promise.all([
    readFile(new URL("../src/app/admin/partners/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/ko/admin/partners/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/admin/partners/[partnerProfileId]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/ko/admin/partners/[partnerProfileId]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/admin-partner-detail-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/partner-dashboard-view.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/admin-partner-management.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(listPage, /loadAdminPartnerListRouteData/);
  assert.match(listPage, /locale="en"/);
  assert.match(koListPage, /loadAdminPartnerListRouteData/);
  assert.match(koListPage, /locale="ko"/);
  assert.match(detailPage, /loadAdminPartnerDetailRouteData/);
  assert.match(koDetailPage, /loadAdminPartnerDetailRouteData/);
  assert.match(detailComponent, /viewMode="admin-readonly"/);
  assert.match(detailComponent, /paginationBasePath=\{`\/admin\/partners\//);
  assert.doesNotMatch(detailComponent, /\/partner\/dashboard/);
  assert.match(dashboardView, /<PartnerReferralAnalyticsSection/);
  assert.match(dashboardView, /qualifyingTransactions=\{data\.counts\.qualifyingTransactions\}/);
  assert.match(dashboardView, /netCommissionAmount=\{data\.totals\.net\}/);
  assert.match(dashboardView, /isActive && !adminReadonly/);
  assert.match(dashboardView, /<AdminPartnerActions/);
  assert.doesNotMatch(dashboardView, /StripeConnectOnboardingPanel/);
  assert.doesNotMatch(dashboardView, /stripeConnectedAccount|stripeAccount/);
  assert.doesNotMatch(management, /name="analyticsRange"/);
  assert.doesNotMatch(management, /params\.set\("analyticsRange"/);
});
