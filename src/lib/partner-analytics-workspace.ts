import type {
  PartnerAnalyticsRange,
  PartnerReferralAnalytics,
} from "@/lib/partner-referral-analytics";

export type AnalyticsGrouping = "daily" | "weekly" | "monthly";
export type AnalyticsMetric =
  | "totalClicks"
  | "uniqueVisitors"
  | "attributedSignups"
  | "signupConversionRate"
  | "sellerRegistrations"
  | "buyerRegistrations"
  | "sellerConversionRate"
  | "buyerConversionRate"
  | "qualifyingTransactions"
  | "netCommission";

export type AnalyticsTotals = PartnerReferralAnalytics["totals"] & {
  qualifyingTransactions: number;
  netCommission: number;
};

export type AnalyticsPoint = {
  date: string;
  totalClicks: number;
  uniqueVisitors: number;
  attributedSignups: number;
  sellerRegistrations: number;
  buyerRegistrations: number;
  signupConversionRate: number;
  sellerConversionRate: number;
  buyerConversionRate: number;
};

export const partnerAnalyticsRangeOptions: Array<{
  value: PartnerAnalyticsRange;
  key: string;
}> = [
  { value: "7d", key: "last7Days" },
  { value: "30d", key: "last30Days" },
  { value: "90d", key: "last90Days" },
  { value: "12m", key: "last12Months" },
  { value: "all", key: "allTime" },
];

export const partnerAnalyticsGroupingOptions: Array<{
  value: AnalyticsGrouping;
  key: string;
}> = [
  { value: "daily", key: "groupDaily" },
  { value: "weekly", key: "groupWeekly" },
  { value: "monthly", key: "groupMonthly" },
];

export const partnerAnalyticsMetrics: Array<{
  value: AnalyticsMetric;
  key: string;
  kind: "count" | "rate" | "money";
  color: string;
}> = [
  {
    value: "totalClicks",
    key: "metricLinkVisits",
    kind: "count",
    color: "#34B386",
  },
  {
    value: "uniqueVisitors",
    key: "metricUniqueVisitors",
    kind: "count",
    color: "#3478B3",
  },
  {
    value: "attributedSignups",
    key: "metricReferredSignups",
    kind: "count",
    color: "#8B5CF6",
  },
  {
    value: "signupConversionRate",
    key: "metricSignupConversionRate",
    kind: "rate",
    color: "#0EA5E9",
  },
  {
    value: "sellerRegistrations",
    key: "metricSellerRegistrations",
    kind: "count",
    color: "#F97316",
  },
  {
    value: "buyerRegistrations",
    key: "metricBuyerRegistrations",
    kind: "count",
    color: "#14B8A6",
  },
  {
    value: "sellerConversionRate",
    key: "metricSellerConversionRate",
    kind: "rate",
    color: "#D946EF",
  },
  {
    value: "buyerConversionRate",
    key: "metricBuyerConversionRate",
    kind: "rate",
    color: "#6366F1",
  },
  {
    value: "qualifyingTransactions",
    key: "metricQualifyingTransactions",
    kind: "count",
    color: "#64748B",
  },
  {
    value: "netCommission",
    key: "metricNetCommission",
    kind: "money",
    color: "#16A34A",
  },
];

export function safeAnalyticsNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

export function analyticsPercent(value: number, denominator: number) {
  const safeDenominator = safeAnalyticsNumber(denominator);
  return safeDenominator === 0
    ? 0
    : Number(
        ((safeAnalyticsNumber(value) / safeDenominator) * 100).toFixed(1),
      );
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function parseAnalyticsDateKey(value: string) {
  return new Date(`${value}${value.length === 7 ? "-01" : ""}T00:00:00.000Z`);
}

function monthKey(value: Date) {
  return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}`;
}

function weekKey(value: Date) {
  const date = new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function metricDefinition(metric: AnalyticsMetric) {
  return (
    partnerAnalyticsMetrics.find((definition) => definition.value === metric) ??
    partnerAnalyticsMetrics[0]
  );
}

export function compareAnalyticsValue(current: number, previous: number) {
  const safeCurrent = safeAnalyticsNumber(current);
  const safePrevious = safeAnalyticsNumber(previous);
  if (safePrevious === 0) {
    return {
      status:
        safeCurrent > 0 ? ("new" as const) : ("neutral" as const),
      percentChange: null,
    };
  }
  const percentChange = Number(
    (((safeCurrent - safePrevious) / safePrevious) * 100).toFixed(1),
  );
  return {
    status:
      percentChange > 0
        ? ("up" as const)
        : percentChange < 0
          ? ("down" as const)
          : ("neutral" as const),
    percentChange,
  };
}

export function basePartnerAnalyticsPoints(analytics: PartnerReferralAnalytics) {
  const traffic = new Map(
    analytics.trafficSeries.map((point) => [point.date, point]),
  );
  const conversion = new Map(
    analytics.conversionSeries.map((point) => [point.date, point]),
  );
  const dates = Array.from(
    new Set([...traffic.keys(), ...conversion.keys()]),
  ).sort();
  return dates.map((date): AnalyticsPoint => {
    const trafficPoint = traffic.get(date);
    const conversionPoint = conversion.get(date);
    const totalClicks = safeAnalyticsNumber(trafficPoint?.totalClicks);
    const uniqueVisitors = safeAnalyticsNumber(trafficPoint?.uniqueVisitors);
    const attributedSignups = safeAnalyticsNumber(
      conversionPoint?.attributedSignups,
    );
    const sellerRegistrations = safeAnalyticsNumber(
      conversionPoint?.sellerRegistrations,
    );
    const buyerRegistrations = safeAnalyticsNumber(
      conversionPoint?.buyerRegistrations,
    );
    return {
      date,
      totalClicks,
      uniqueVisitors,
      attributedSignups,
      sellerRegistrations,
      buyerRegistrations,
      signupConversionRate: analyticsPercent(
        attributedSignups,
        uniqueVisitors,
      ),
      sellerConversionRate: analyticsPercent(
        sellerRegistrations,
        uniqueVisitors,
      ),
      buyerConversionRate: analyticsPercent(
        buyerRegistrations,
        uniqueVisitors,
      ),
    };
  });
}

export function groupPartnerAnalyticsPoints(
  points: AnalyticsPoint[],
  grouping: AnalyticsGrouping,
) {
  if (grouping === "daily") return points;
  const grouped = new Map<
    string,
    Pick<
      AnalyticsPoint,
      | "totalClicks"
      | "uniqueVisitors"
      | "attributedSignups"
      | "sellerRegistrations"
      | "buyerRegistrations"
    >
  >();
  for (const point of points) {
    const date = parseAnalyticsDateKey(point.date);
    const key = grouping === "monthly" ? monthKey(date) : weekKey(date);
    const current = grouped.get(key) ?? {
      totalClicks: 0,
      uniqueVisitors: 0,
      attributedSignups: 0,
      sellerRegistrations: 0,
      buyerRegistrations: 0,
    };
    current.totalClicks += safeAnalyticsNumber(point.totalClicks);
    current.uniqueVisitors += safeAnalyticsNumber(point.uniqueVisitors);
    current.attributedSignups += safeAnalyticsNumber(point.attributedSignups);
    current.sellerRegistrations += safeAnalyticsNumber(
      point.sellerRegistrations,
    );
    current.buyerRegistrations += safeAnalyticsNumber(point.buyerRegistrations);
    grouped.set(key, current);
  }
  return Array.from(grouped.entries()).map(([date, point]) => ({
    date,
    ...point,
    signupConversionRate: analyticsPercent(
      point.attributedSignups,
      point.uniqueVisitors,
    ),
    sellerConversionRate: analyticsPercent(
      point.sellerRegistrations,
      point.uniqueVisitors,
    ),
    buyerConversionRate: analyticsPercent(
      point.buyerRegistrations,
      point.uniqueVisitors,
    ),
  }));
}

export function buildPartnerAnalyticsWorkspaceModel({
  analytics,
  qualifyingTransactions,
  netCommissionAmount,
}: {
  analytics: PartnerReferralAnalytics;
  qualifyingTransactions: number;
  netCommissionAmount: number;
}) {
  const totals: AnalyticsTotals = {
    ...analytics.totals,
    qualifyingTransactions,
    netCommission: netCommissionAmount,
  };
  const comparisonTotals: AnalyticsTotals = {
    ...analytics.comparisonTotals,
    qualifyingTransactions: 0,
    netCommission: 0,
  };
  return {
    totals,
    comparisonTotals,
    points: basePartnerAnalyticsPoints(analytics),
    hasActivity: Object.values(totals).some(
      (value) => safeAnalyticsNumber(value) > 0,
    ),
  };
}
