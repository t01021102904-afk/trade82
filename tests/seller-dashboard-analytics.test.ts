import assert from "node:assert/strict";
import test from "node:test";

import {
  SELLER_DASHBOARD_HISTORY_DAYS,
  buildSellerDashboardSeries,
  getSellerDashboardKpis,
} from "../src/lib/seller-dashboard-analytics.ts";

const date = (value: string) => new Date(`${value}T12:00:00.000Z`);

test("seller dashboard revenue credits payments and debits successful refunds on their event dates", () => {
  const series = buildSellerDashboardSeries({
    now: date("2026-07-28"),
    paidOrders: [
      { occurredAt: date("2026-07-28"), amount: 10_000 },
      { occurredAt: date("2026-07-24"), amount: 5_000 },
      { occurredAt: date("2026-07-18"), amount: 1_000 },
    ],
    refunds: [
      { occurredAt: date("2026-07-28"), amount: 2_500 },
      { occurredAt: date("2026-07-25"), amount: 1_000 },
    ],
    newLeads: [
      { occurredAt: date("2026-07-28") },
      { occurredAt: date("2026-07-18") },
    ],
    quotesInProgress: [{ occurredAt: date("2026-07-24") }],
  });

  assert.equal(series.length, SELLER_DASHBOARD_HISTORY_DAYS);
  assert.deepEqual(series.at(-1), {
    date: "2026-07-28",
    netRevenueCents: 7_500,
    revenueEvents: 2,
    newLeads: 1,
    quotesInProgress: 0,
    paidOrders: 1,
  });
  assert.equal(series.find((point) => point.date === "2026-07-25")?.netRevenueCents, -1_000);

  const kpis = getSellerDashboardKpis(series, 7);
  assert.equal(kpis.netRevenue.current, 11_500);
  assert.equal(kpis.netRevenue.previous, 1_000);
  assert.equal(kpis.netRevenue.change, 1050);
  assert.equal(kpis.netRevenue.direction, "up");
  assert.equal(kpis.newLeads.direction, "flat");
  assert.equal(kpis.quotesInProgress.direction, "new");
});

test("seller dashboard KPI comparisons avoid fabricated percentages when the prior period is zero", () => {
  const series = buildSellerDashboardSeries({
    now: date("2026-07-28"),
    paidOrders: [{ occurredAt: date("2026-07-28"), amount: 1 }],
    refunds: [],
    newLeads: [],
    quotesInProgress: [],
  });

  const kpis = getSellerDashboardKpis(series, 7);
  assert.equal(kpis.netRevenue.change, null);
  assert.equal(kpis.netRevenue.direction, "new");
  assert.equal(kpis.newLeads.change, null);
  assert.equal(kpis.newLeads.direction, "na");
});
