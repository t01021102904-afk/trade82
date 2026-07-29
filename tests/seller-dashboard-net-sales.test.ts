import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import en from "../messages/en.json" with { type: "json" };
import ko from "../messages/ko.json" with { type: "json" };
import {
  buildSellerDashboardCurrencySeries,
  formatSellerDashboardMoney,
  getSellerDashboardKpis,
} from "../src/lib/seller-dashboard-net-sales.ts";

const now = new Date("2026-07-28T12:00:00.000Z");
const utc = (day: string) => new Date(`${day}T12:00:00.000Z`);

function seriesFor(currency: string, input: Parameters<typeof buildSellerDashboardCurrencySeries>[0]) {
  const result = buildSellerDashboardCurrencySeries(input);
  const series = result.currencySeries.find((item) => item.currency === currency);
  assert.ok(series, `expected ${currency} currency series`);
  return { ...result, series: series.series };
}

function point(series: ReturnType<typeof seriesFor>["series"], day: string) {
  const result = series.find((item) => item.date === day);
  assert.ok(result, `expected ${day} point`);
  return result;
}

test("UTC net sales aggregates one or many paid orders without floating-point arithmetic", () => {
  const result = seriesFor("USD", {
    now,
    payments: [
      { occurredAt: utc("2026-07-27"), currency: "usd", minorUnits: 10 },
      { occurredAt: utc("2026-07-27"), currency: "USD", minorUnits: 20 },
      { occurredAt: utc("2026-07-28"), currency: "USD", minorUnits: 3990 },
    ],
    refunds: [],
    newLeads: [],
    quotesInProgress: [],
  });

  assert.equal(point(result.series, "2026-07-27").netSalesMinorUnits, "30");
  assert.equal(point(result.series, "2026-07-27").paidOrders, 2);
  assert.equal(point(result.series, "2026-07-28").netSalesMinorUnits, "3990");
  assert.match(formatSellerDashboardMoney("3990", "USD", "en"), /39\.90/);
  assert.match(formatSellerDashboardMoney("3990", "USD", "ko"), /39\.90/);
});

test("partial and full successful refunds are recorded on their own UTC event days", () => {
  const result = seriesFor("USD", {
    now,
    payments: [{ occurredAt: utc("2026-07-01"), currency: "USD", minorUnits: 10000 }],
    refunds: [
      { occurredAt: utc("2026-07-02"), currency: "USD", minorUnits: 2500 },
      { occurredAt: utc("2026-07-03"), currency: "USD", minorUnits: 7500 },
    ],
    newLeads: [],
    quotesInProgress: [],
  });

  assert.equal(point(result.series, "2026-07-01").netSalesMinorUnits, "10000");
  assert.equal(point(result.series, "2026-07-02").netSalesMinorUnits, "-2500");
  assert.equal(point(result.series, "2026-07-03").netSalesMinorUnits, "-7500");
});

test("refund-only period, same-day refund, zero-event day, and negative net sales remain visible", () => {
  const result = seriesFor("USD", {
    now,
    // This paid order is intentionally outside the 180-day dashboard window.
    payments: [],
    refunds: [
      { occurredAt: utc("2026-07-27"), currency: "USD", minorUnits: 500 },
      { occurredAt: utc("2026-07-28"), currency: "USD", minorUnits: 1000 },
    ],
    newLeads: [],
    quotesInProgress: [],
  });
  const sameDay = seriesFor("USD", {
    now,
    payments: [{ occurredAt: utc("2026-07-28"), currency: "USD", minorUnits: 1000 }],
    refunds: [{ occurredAt: utc("2026-07-28"), currency: "USD", minorUnits: 1000 }],
    newLeads: [],
    quotesInProgress: [],
  });

  assert.equal(point(result.series, "2026-07-27").netSalesMinorUnits, "-500");
  assert.equal(point(sameDay.series, "2026-07-28").netSalesMinorUnits, "0");
  assert.equal(point(sameDay.series, "2026-07-28").revenueEvents, 2);
  const kpis = getSellerDashboardKpis(result.series, result.activitySeries, 7);
  assert.equal(kpis.netSales.current, "-1500");
  assert.equal(kpis.netSales.direction, "down");
});

test("period comparisons use equal UTC windows and never return infinity or NaN", () => {
  const positive = seriesFor("USD", {
    now,
    payments: [{ occurredAt: utc("2026-07-28"), currency: "USD", minorUnits: 100 }],
    refunds: [],
    newLeads: [],
    quotesInProgress: [],
  });
  const none = buildSellerDashboardCurrencySeries({ now, payments: [], refunds: [], newLeads: [], quotesInProgress: [] });
  const changed = seriesFor("USD", {
    now,
    payments: [
      { occurredAt: utc("2026-07-27"), currency: "USD", minorUnits: 200 },
      { occurredAt: utc("2026-07-20"), currency: "USD", minorUnits: 100 },
      { occurredAt: utc("2026-07-10"), currency: "USD", minorUnits: 400 },
    ],
    refunds: [],
    newLeads: [],
    quotesInProgress: [],
  });

  assert.equal(getSellerDashboardKpis(positive.series, positive.activitySeries, 7).netSales.direction, "new");
  assert.equal(getSellerDashboardKpis(null, none.activitySeries, 7).netSales.direction, "na");
  const sevenDay = getSellerDashboardKpis(changed.series, changed.activitySeries, 7).netSales;
  assert.equal(sevenDay.direction, "up");
  assert.equal(sevenDay.changeTenthsPercent, "1000");
  const thirtyDay = getSellerDashboardKpis(changed.series, changed.activitySeries, 30).netSales;
  assert.equal(thirtyDay.direction, "new");
  assert.doesNotMatch(JSON.stringify({ sevenDay, thirtyDay }), /Infinity|NaN/);
});

test("currency series are isolated and include a currency for dashboard, KPI, and tooltip selection", () => {
  const result = buildSellerDashboardCurrencySeries({
    now,
    payments: [
      { occurredAt: utc("2026-07-28"), currency: "USD", minorUnits: 100 },
      { occurredAt: utc("2026-07-28"), currency: "KRW", minorUnits: 100 },
    ],
    refunds: [],
    newLeads: [],
    quotesInProgress: [],
  });
  assert.deepEqual(result.currencySeries.map((item) => item.currency), ["KRW", "USD"]);
  assert.equal(point(result.currencySeries[0]!.series, "2026-07-28").netSalesMinorUnits, "100");
  assert.equal(point(result.currencySeries[1]!.series, "2026-07-28").netSalesMinorUnits, "100");
});

test("API only selects confirmed seller-scoped payment and refund events in bounded queries", () => {
  const api = readFileSync("src/app/api/dashboard/summary/route.ts", "utf8");
  const chart = readFileSync("src/components/chart-area-interactive.tsx", "utf8");
  const shell = readFileSync("src/components/seller-dashboard-shell.tsx", "utf8");
  const schema = readFileSync("prisma/schema.prisma", "utf8");

  assert.match(api, /requireAuth\(\)[\s\S]*getUserCompany\(user\.id, role\)/);
  assert.match(api, /paymentStatus: \{ in: \["PAID", "PARTIALLY_REFUNDED", "REFUNDED"\] \}/);
  assert.match(api, /orderStatus: \{ not: "CANCELLED" \}/);
  assert.match(api, /paidAt: \{ gte: sellerDashboardStart, lte: now \}/);
  assert.match(api, /status: "succeeded"/);
  assert.match(api, /paymentRequest: \{[\s\S]*?sellerCompanyId: company\.id/);
  assert.match(api, /lastStripeEventCreatedAt: \{ gte: sellerDashboardStart, lte: now \}/);
  assert.match(schema, /model PaymentRefund \{[\s\S]*?stripeRefundId\s+String\s+@unique/);
  assert.match(api, /Promise\.all/);
  assert.match(api, /currencySeries: sellerDashboard\.currencySeries/);
  assert.doesNotMatch(api, /sellerCompanyId:\s*url\.searchParams/);
  assert.match(chart, /formatSellerDashboardMoney\(point\.netSalesMinorUnits, currency, locale\)/);
  assert.match(shell, /status: "error"/);
  assert.doesNotMatch(shell, /summary \? \{[\s\S]*?: 0/);
});

test("English and Korean Net Sales wording and descriptions are exact and in parity", () => {
  assert.deepEqual(Object.keys(en.sellerDashboard).sort(), Object.keys(ko.sellerDashboard).sort());
  assert.equal(en.sellerDashboard.netSales, "Net Sales");
  assert.equal(en.sellerDashboard.netSalesDescription, "Paid sales minus successful refunds");
  assert.equal(ko.sellerDashboard.netSales, "순매출");
  assert.equal(ko.sellerDashboard.netSalesDescription, "결제 완료 매출에서 성공한 환불 금액을 차감한 값");
});
