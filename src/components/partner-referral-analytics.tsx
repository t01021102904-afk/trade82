"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  buildPartnerAnalyticsWorkspaceModel,
  compareAnalyticsValue,
  analyticsChartLabelIndices,
  analyticsPeriodContext,
  groupPartnerAnalyticsPoints,
  formatAnalyticsChartLabel,
  metricDefinition,
  parseAnalyticsDateKey,
  partnerAnalyticsGroupingOptions,
  partnerAnalyticsMetrics,
  partnerAnalyticsRangeOptions,
  recommendedAnalyticsGrouping,
  safeAnalyticsNumber,
  type AnalyticsGrouping,
  type AnalyticsMetric,
  type AnalyticsPoint,
} from "@/lib/partner-analytics-workspace";
import type {
  PartnerAnalyticsRange,
  PartnerReferralAnalytics,
} from "@/lib/partner-referral-analytics";
import {
  createTranslator,
  getDictionary,
  type Locale,
  withLocale,
} from "@/lib/i18n";

const kpiMetrics: AnalyticsMetric[] = [
  "totalClicks",
  "uniqueVisitors",
  "attributedSignups",
  "sellerRegistrations",
  "buyerRegistrations",
  "netCommission",
];

function percentage(value: number) {
  return `${safeAnalyticsNumber(value).toFixed(1)}%`;
}

function money(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(safeAnalyticsNumber(amount) / 100);
}

function displayDate(value: string, locale: Locale) {
  if (value === "total") {
    return locale === "ko" ? "합계" : "Total";
  }
  const date = parseAnalyticsDateKey(value);
  return new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
    month: "short",
    day: value.length === 7 ? undefined : "numeric",
    year: value.length === 7 ? "numeric" : undefined,
  }).format(date);
}

function comparisonLabel({
  current,
  previous,
  locale,
}: {
  current: number;
  previous: number;
  locale: Locale;
}) {
  const comparison = compareAnalyticsValue(current, previous);
  if (comparison.status === "new") {
    return locale === "ko" ? "이전 기간 대비 신규" : "New vs previous period";
  }
  if (comparison.percentChange === null) {
    return locale === "ko"
      ? "이전 기간과 변화 없음"
      : "No change vs previous period";
  }
  const prefix = comparison.percentChange > 0 ? "+" : "";
  return locale === "ko"
    ? `이전 기간 대비 ${prefix}${comparison.percentChange}%`
    : `${prefix}${comparison.percentChange}% vs previous period`;
}

function formatMetricValue({
  metric,
  value,
  currency,
}: {
  metric: AnalyticsMetric;
  value: number;
  currency: string;
}) {
  const definition = metricDefinition(metric);
  if (definition.kind === "money") return money(value, currency);
  if (definition.kind === "rate") return percentage(value);
  return new Intl.NumberFormat("en-US").format(safeAnalyticsNumber(value));
}

function buildRangeHref({
  basePath,
  query,
  range,
  locale,
}: {
  basePath: string;
  query: Record<string, string>;
  range: PartnerAnalyticsRange;
  locale: Locale;
}) {
  const params = new URLSearchParams(query);
  params.set("analyticsRange", range);
  return withLocale(`${basePath}?${params.toString()}`, locale);
}

function ChartPanel({
  locale,
  grouping,
  metric,
  points,
  totalValue,
  currency,
}: {
  locale: Locale;
  grouping: AnalyticsGrouping;
  metric: AnalyticsMetric;
  points: AnalyticsPoint[];
  totalValue: number;
  currency: string;
}) {
  const definition = metricDefinition(metric);
  const chartPoints =
    metric === "qualifyingTransactions" || metric === "netCommission"
      ? [{ date: "total", value: totalValue }]
      : points.map((point) => ({
          date: point.date,
          value: safeAnalyticsNumber(point[metric as keyof AnalyticsPoint]),
        }));
  const maximum = Math.max(1, ...chartPoints.map((point) => point.value));
  const t = createTranslator(getDictionary(locale));
  const labelIndices = analyticsChartLabelIndices(chartPoints.length, grouping);
  const monthMarkers = grouping === "daily"
    ? chartPoints.reduce<Array<{ date: string; index: number }>>((markers, point, index) => {
        if (point.date === "total") return markers;
        const currentMonth = point.date.slice(0, 7);
        if (markers.at(-1)?.date.slice(0, 7) !== currentMonth) {
          markers.push({ date: point.date, index });
        }
        return markers;
      }, [])
    : [];
  const hasMonthBoundaries = monthMarkers.length > 1;

  if (definition.kind === "rate") {
    const width = 720;
    const height = 260;
    const left = 44;
    const right = 18;
    const top = 22;
    const bottom = 44;
    const innerWidth = width - left - right;
    const innerHeight = height - top - bottom;
    const x = (index: number) =>
      chartPoints.length <= 1
        ? left + innerWidth / 2
        : left + (index / (chartPoints.length - 1)) * innerWidth;
    const y = (value: number) =>
      top + innerHeight - (value / Math.max(100, maximum)) * innerHeight;
    const path = chartPoints
      .map(
        (point, index) =>
          `${index ? "L" : "M"}${x(index)},${y(point.value)}`,
      )
      .join(" ");

    return (
      <svg
        className="mt-6 h-auto w-full max-w-full min-w-0"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${t(`partnerProgram.${definition.key}`)} ${t("partnerProgram.analyticsChart")}`}
      >
        <line
          x1={left}
          x2={left + innerWidth}
          y1={top + innerHeight}
          y2={top + innerHeight}
          stroke="#E4E4E7"
        />
        <line
          x1={left}
          x2={left}
          y1={top}
          y2={top + innerHeight}
          stroke="#E4E4E7"
        />
        <path
          d={path}
          fill="none"
          stroke={definition.color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3"
        />
        {chartPoints.map((point, index) => (
          <circle
            key={point.date}
            cx={x(index)}
            cy={y(point.value)}
            r="4"
            fill={definition.color}
          />
        ))}
        <text
          x={left - 8}
          y={top + 4}
          textAnchor="end"
          className="fill-zinc-500 text-[11px]"
        >
          100%
        </text>
        <text
          x={left - 8}
          y={top + innerHeight + 4}
          textAnchor="end"
          className="fill-zinc-500 text-[11px]"
        >
          0%
        </text>
        {hasMonthBoundaries
          ? monthMarkers.map((marker) => (
              <g key={`${marker.date}-month-marker`}>
                {marker.index > 0 ? (
                  <line
                    x1={x(marker.index)}
                    x2={x(marker.index)}
                    y1={top}
                    y2={top + innerHeight}
                    stroke="#D4D4D8"
                    strokeDasharray="3 4"
                  />
                ) : null}
                <text
                  x={x(marker.index) + (marker.index > 0 ? 4 : 0)}
                  y={12}
                  textAnchor={marker.index > 0 ? "start" : "middle"}
                  className="fill-zinc-400 text-[10px]"
                >
                  {new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
                    month: "short",
                    timeZone: "UTC",
                  }).format(parseAnalyticsDateKey(marker.date))}
                </text>
              </g>
            ))
          : null}
        {chartPoints.map((point, index) => labelIndices.has(index) ? (
            <text
              key={`${point.date}-label`}
              x={x(index)}
              y={height - 13}
              textAnchor="middle"
              className="fill-zinc-500 text-[11px]"
            >
              {formatAnalyticsChartLabel(point.date, grouping, locale)}
            </text>
          ) : null)}
      </svg>
    );
  }

  return (
    <div className="mt-6 w-full max-w-full min-w-0 overflow-hidden">
      <div
        className="grid items-end gap-2"
        style={{
          gridTemplateColumns: `repeat(${Math.max(
            1,
            chartPoints.length,
          )}, minmax(0, 1fr))`,
        }}
        role="img"
        aria-label={`${t(`partnerProgram.${definition.key}`)} ${t("partnerProgram.analyticsChart")}`}
      >
      {chartPoints.map((point, index) => {
        const monthMarker = monthMarkers.find((marker) => marker.index === index);
        return (
        <div key={point.date} className="relative grid gap-2">
          {hasMonthBoundaries && monthMarker ? (
            <span
              className="pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] text-zinc-400"
              aria-hidden="true"
            >
              {new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
                month: "short",
                timeZone: "UTC",
              }).format(parseAnalyticsDateKey(point.date))}
            </span>
          ) : null}
          {hasMonthBoundaries && monthMarker && index > 0 ? (
            <span
              className="pointer-events-none absolute inset-y-0 -left-1 border-l border-dashed border-zinc-300"
              aria-hidden="true"
            />
          ) : null}
          <div className="flex h-52 items-end rounded-t bg-zinc-50">
            <div
              className="w-full rounded-t"
              style={{
                height: `${Math.max(4, (point.value / maximum) * 100)}%`,
                backgroundColor: definition.color,
              }}
              title={`${displayDate(point.date, locale)}: ${formatMetricValue({
                metric,
                value: point.value,
                currency,
              })}`}
            />
          </div>
          <span className="truncate text-center text-[11px] text-zinc-500">
            {labelIndices.has(index)
              ? formatAnalyticsChartLabel(point.date, grouping, locale)
              : "\u00a0"}
          </span>
        </div>
        );
      })}
      </div>
    </div>
  );
}

export function PartnerReferralAnalyticsSection({
  locale,
  analytics,
  qualifyingTransactions = 0,
  netCommissionAmount = 0,
  currency = "usd",
  basePath = "/partner/dashboard",
  query = {},
}: {
  locale: Locale;
  analytics: PartnerReferralAnalytics;
  qualifyingTransactions?: number;
  netCommissionAmount?: number;
  currency?: string;
  basePath?: string;
  query?: Record<string, string>;
}) {
  const t = createTranslator(getDictionary(locale));
  const [selectedMetric, setSelectedMetric] =
    useState<AnalyticsMetric>("totalClicks");
  const [grouping, setGrouping] = useState<AnalyticsGrouping>(
    recommendedAnalyticsGrouping(analytics.range),
  );
  useEffect(() => {
    setGrouping(recommendedAnalyticsGrouping(analytics.range));
  }, [analytics.range]);
  const model = useMemo(
    () =>
      buildPartnerAnalyticsWorkspaceModel({
        analytics,
        qualifyingTransactions,
        netCommissionAmount,
      }),
    [analytics, qualifyingTransactions, netCommissionAmount],
  );
  const groupedPoints = useMemo(
    () => groupPartnerAnalyticsPoints(model.points, grouping),
    [model.points, grouping],
  );
  const selectedDefinition = metricDefinition(selectedMetric);
  const selectedValue = safeAnalyticsNumber(model.totals[selectedMetric]);
  const previousValue = safeAnalyticsNumber(
    model.comparisonTotals[selectedMetric],
  );
  const periodContext = analyticsPeriodContext(groupedPoints, grouping, locale);

  return (
    <section
      aria-labelledby="partner-analytics-workspace"
      className="w-full max-w-full min-w-0 overflow-hidden rounded-[20px] border border-zinc-200 bg-white p-4 text-zinc-950 shadow-sm sm:p-5"
      data-testid="partner-analytics-workspace"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            {t("partnerProgram.analyticsWorkspaceEyebrow")}
          </p>
          <h2
            id="partner-analytics-workspace"
            className="mt-1 text-xl font-semibold text-zinc-950"
          >
            {t("partnerProgram.analyticsWorkspaceTitle")}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-zinc-600">
            {t("partnerProgram.analyticsWorkspaceDescription")}
          </p>
        </div>
        <div className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600">
          {t(
            `partnerProgram.${
              partnerAnalyticsRangeOptions.find(
                (option) => option.value === analytics.range,
              )?.key ?? "last30Days"
            }`,
          )}
        </div>
      </div>

      <div className="mt-5 grid min-w-0 max-w-full gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {kpiMetrics.map((metric) => {
          const definition = metricDefinition(metric);
          return (
            <article
              key={metric}
              className="min-w-0 max-w-full rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"
            >
              <p className="text-xs font-medium text-zinc-500">
                {t(`partnerProgram.${definition.key}`)}
              </p>
              <p className="mt-2 text-2xl font-semibold text-zinc-950">
                {formatMetricValue({
                  metric,
                  value: model.totals[metric],
                  currency,
                })}
              </p>
              <p className="mt-2 text-xs text-zinc-500">
                {comparisonLabel({
                  current: model.totals[metric],
                  previous: model.comparisonTotals[metric],
                  locale,
                })}
              </p>
            </article>
          );
        })}
      </div>

      <div className="mt-5 w-full max-w-full min-w-0 overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-zinc-950">
                {t("partnerProgram.analyticsMainChart")}
              </h3>
              {periodContext ? (
                <span className="text-xs font-medium text-zinc-500">
                  {periodContext}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-zinc-600">
              {comparisonLabel({
                current: selectedValue,
                previous: previousValue,
                locale,
              })}
            </p>
          </div>
          <div className="grid min-w-0 gap-2 sm:grid-cols-3">
            <label className="grid gap-1 text-xs font-medium text-zinc-600">
              {t("partnerProgram.analyticsMetric")}
              <select
                className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={selectedMetric}
                onChange={(event) =>
                  setSelectedMetric(event.target.value as AnalyticsMetric)
                }
              >
                {partnerAnalyticsMetrics.map((metric) => (
                  <option key={metric.value} value={metric.value}>
                    {t(`partnerProgram.${metric.key}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-medium text-zinc-600">
              {t("partnerProgram.analyticsRange")}
              <select
                className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={analytics.range}
                onChange={(event) => {
                  window.location.href = buildRangeHref({
                    basePath,
                    query,
                    range: event.target.value as PartnerAnalyticsRange,
                    locale,
                  });
                }}
              >
                {partnerAnalyticsRangeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(`partnerProgram.${option.key}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-medium text-zinc-600">
              {t("partnerProgram.analyticsGrouping")}
              <select
                className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={grouping}
                onChange={(event) =>
                  setGrouping(event.target.value as AnalyticsGrouping)
                }
              >
                {partnerAnalyticsGroupingOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(`partnerProgram.${option.key}`)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {!model.hasActivity ? (
          <div className="mt-6 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-5 text-sm text-zinc-600">
            {t("partnerProgram.emptyReferralActivity")}
          </div>
        ) : null}

        <div className="w-full max-w-full min-w-0 overflow-hidden">
          <ChartPanel
            locale={locale}
            grouping={grouping}
            metric={selectedMetric}
            points={groupedPoints}
            totalValue={selectedValue}
            currency={currency}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: selectedDefinition.color }}
            aria-hidden="true"
          />
          <span>{t(`partnerProgram.${selectedDefinition.key}`)}</span>
          <span aria-hidden="true">/</span>
          <span>
            {t(
              `partnerProgram.${
                selectedDefinition.kind === "rate" ? "lineChart" : "barChart"
              }`,
            )}
          </span>
        </div>

        <nav
          className="mt-5 flex flex-wrap gap-2 border-t border-zinc-200 pt-4"
          aria-label={t("partnerProgram.analyticsRange")}
        >
          {partnerAnalyticsRangeOptions.map((option) => (
            <Link
              key={option.value}
              href={buildRangeHref({
                basePath,
                query,
                range: option.value,
                locale,
              })}
              aria-current={analytics.range === option.value ? "page" : undefined}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                analytics.range === option.value
                  ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                  : "border-zinc-200 bg-white text-zinc-600 hover:border-emerald-400 hover:text-zinc-950"
              }`}
            >
              {t(`partnerProgram.${option.key}`)}
            </Link>
          ))}
        </nav>
      </div>
    </section>
  );
}
