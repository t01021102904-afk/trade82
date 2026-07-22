import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ADMIN_PARTNER_DEFAULT_PAGE_SIZE,
  ADMIN_PARTNER_MAX_PAGE_SIZE,
  parseAdminPartnerListQuery,
} from "../src/lib/admin-partners.ts";

test("admin partner list query defaults are bounded and deterministic", () => {
  assert.deepEqual(parseAdminPartnerListQuery({}), {
    search: "",
    status: "all",
    country: null,
    payoutSetup: "all",
    sort: "newest",
    page: 1,
    pageSize: ADMIN_PARTNER_DEFAULT_PAGE_SIZE,
    analyticsRange: "30d",
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
    analyticsRange: "90d",
  });

  assert.equal(query.search.length, 100);
  assert.equal(query.search.startsWith("partner"), true);
  assert.equal(query.page, 4);
  assert.equal(query.pageSize, ADMIN_PARTNER_MAX_PAGE_SIZE);
  assert.equal(query.status, "suspended");
  assert.equal(query.country, "KR");
  assert.equal(query.payoutSetup, "enabled");
  assert.equal(query.sort, "netCommission");
  assert.equal(query.analyticsRange, "90d");
});

test("unknown admin partner filters fail closed to safe defaults", () => {
  const query = parseAdminPartnerListQuery({
    status: "deleted",
    payoutSetup: "transfer",
    sort: "rawSql",
    analyticsRange: "365d",
    page: "0",
    pageSize: "-1",
  });

  assert.equal(query.status, "all");
  assert.equal(query.payoutSetup, "all");
  assert.equal(query.sort, "newest");
  assert.equal(query.analyticsRange, "30d");
  assert.equal(query.page, 1);
  assert.equal(query.pageSize, ADMIN_PARTNER_DEFAULT_PAGE_SIZE);
});
