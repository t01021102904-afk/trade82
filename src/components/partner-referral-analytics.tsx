import Link from "next/link";

import {
  type PartnerAnalyticsRange,
  type PartnerReferralAnalytics,
} from "@/lib/partner-referral-analytics";
import {
  createTranslator,
  getDictionary,
  type Locale,
  withLocale,
} from "@/lib/i18n";

type TrafficPoint = PartnerReferralAnalytics["trafficSeries"][number];
type ConversionPoint = PartnerReferralAnalytics["conversionSeries"][number];

const rangeOptions: Array<{ value: PartnerAnalyticsRange; key: string }> = [
  { value: "7d", key: "last7Days" },
  { value: "30d", key: "last30Days" },
  { value: "90d", key: "last90Days" },
  { value: "all", key: "allTime" },
];

function percentage(value: number) {
  return `${value.toFixed(1)}%`;
}

function displayDate(value: string, locale: Locale) {
  const date = new Date(
    `${value}${value.length === 7 ? "-01" : ""}T00:00:00.000Z`,
  );
  return new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
    month: "short",
    day: value.length === 7 ? undefined : "numeric",
    year: value.length === 7 ? "numeric" : undefined,
  }).format(date);
}

function AnalyticsChart<T extends Record<string, number | string>>({
  id,
  title,
  description,
  points,
  series,
  locale,
}: {
  id: string;
  title: string;
  description: string;
  points: T[];
  series: Array<{ key: keyof T; label: string; color: string }>;
  locale: Locale;
}) {
  const width = 640;
  const height = 230;
  const left = 46;
  const right = 16;
  const top = 22;
  const bottom = 44;
  const innerWidth = width - left - right;
  const innerHeight = height - top - bottom;
  const values = points.flatMap((point) =>
    series.map(({ key }) => Number(point[key]) || 0),
  );
  const maximum = Math.max(1, ...values);
  const x = (index: number) =>
    points.length <= 1
      ? left + innerWidth / 2
      : left + (index / (points.length - 1)) * innerWidth;
  const y = (value: number) =>
    top + innerHeight - (value / maximum) * innerHeight;
  const labelIndexes = Array.from(
    new Set([0, Math.floor((points.length - 1) / 2), points.length - 1]),
  );

  return (
    <div className="min-w-0 border p-4 theme-border theme-surface-elevated">
      <h3
        id={`${id}-title`}
        className="text-base font-semibold theme-foreground"
      >
        {title}
      </h3>
      <p id={`${id}-description`} className="mt-1 text-xs theme-muted">
        {description}
      </p>
      {points.length ? (
        <>
          <div className="mt-4 overflow-x-auto">
            <svg
              className="h-auto min-w-[520px] w-full"
              viewBox={`0 0 ${width} ${height}`}
              role="img"
              aria-labelledby={`${id}-title ${id}-description`}
            >
              <line
                x1={left}
                x2={left + innerWidth}
                y1={top + innerHeight}
                y2={top + innerHeight}
                stroke="currentColor"
                className="theme-muted"
                strokeOpacity="0.3"
              />
              <line
                x1={left}
                x2={left}
                y1={top}
                y2={top + innerHeight}
                stroke="currentColor"
                className="theme-muted"
                strokeOpacity="0.3"
              />
              <text
                x={left - 8}
                y={top + 4}
                textAnchor="end"
                className="fill-current text-[11px] theme-muted"
              >
                {maximum}
              </text>
              <text
                x={left - 8}
                y={top + innerHeight + 4}
                textAnchor="end"
                className="fill-current text-[11px] theme-muted"
              >
                0
              </text>
              {series.map(({ key, color, label }) => {
                const path = points
                  .map(
                    (point, index) =>
                      `${index ? "L" : "M"}${x(index)},${y(Number(point[key]) || 0)}`,
                  )
                  .join(" ");
                return (
                  <g key={String(key)}>
                    <path
                      d={path}
                      fill="none"
                      stroke={color}
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {points.map((point, index) => (
                      <circle
                        key={`${String(key)}-${String(point.date)}`}
                        cx={x(index)}
                        cy={y(Number(point[key]) || 0)}
                        r="5"
                        fill={color}
                        tabIndex={0}
                        aria-label={`${label}, ${displayDate(String(point.date), locale)}: ${Number(point[key]) || 0}`}
                      />
                    ))}
                  </g>
                );
              })}
              {labelIndexes.map((index) => (
                <text
                  key={index}
                  x={x(index)}
                  y={height - 13}
                  textAnchor="middle"
                  className="fill-current text-[11px] theme-muted"
                >
                  {displayDate(String(points[index]?.date), locale)}
                </text>
              ))}
            </svg>
          </div>
          <div
            className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs theme-muted"
            aria-label={`${title} legend`}
          >
            {series.map(({ key, color, label }) => (
              <span
                key={String(key)}
                className="inline-flex items-center gap-2"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: color }}
                  aria-hidden="true"
                />
                {label}
              </span>
            ))}
          </div>
          <table className="mt-4 w-full text-left text-xs theme-muted">
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr className="border-b theme-border">
                <th className="py-2 pr-3 font-medium">
                  {locale === "ko" ? "날짜" : "Date"}
                </th>
                {series.map(({ key, label }) => (
                  <th key={String(key)} className="py-2 pr-3 font-medium">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr
                  key={String(point.date)}
                  className="border-b theme-border last:border-0"
                >
                  <td className="py-2 pr-3">
                    {displayDate(String(point.date), locale)}
                  </td>
                  {series.map(({ key }) => (
                    <td key={String(key)} className="py-2 pr-3">
                      {Number(point[key]) || 0}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}
    </div>
  );
}

export function PartnerReferralAnalyticsSection({
  locale,
  analytics,
}: {
  locale: Locale;
  analytics: PartnerReferralAnalytics;
}) {
  const t = createTranslator(getDictionary(locale));
  const totals = analytics.totals;
  const hasActivity = totals.totalClicks > 0 || totals.attributedSignups > 0;
  const kpis = [
    ["totalVisits", totals.totalClicks],
    ["uniqueVisitors", totals.uniqueVisitors],
    ["referredSignups", totals.attributedSignups],
    ["sellerRegistrations", totals.sellerRegistrations],
    ["buyerRegistrations", totals.buyerRegistrations],
    ["signupConversion", percentage(totals.signupConversionRate)],
  ] as const;

  return (
    <section aria-labelledby="partner-referral-performance">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            id="partner-referral-performance"
            className="text-lg font-semibold theme-foreground"
          >
            {t("partnerProgram.referralPerformance")}
          </h2>
          <p className="mt-1 text-sm theme-muted">
            {t("partnerProgram.referralPerformanceDescription")}
          </p>
        </div>
        <nav
          className="flex flex-wrap gap-2"
          aria-label={t("partnerProgram.analyticsRange")}
        >
          {rangeOptions.map(({ value, key }) => (
            <Link
              key={value}
              href={withLocale(
                `/partner/dashboard?analyticsRange=${value}`,
                locale,
              )}
              aria-current={analytics.range === value ? "page" : undefined}
              className={`border px-3 py-1.5 text-xs font-medium theme-border ${analytics.range === value ? "bg-[var(--foreground)] text-[var(--background)]" : "theme-muted hover:text-[var(--foreground)]"}`}
            >
              {t(`partnerProgram.${key}`)}
            </Link>
          ))}
        </nav>
      </div>
      <div className="mt-4 grid gap-px overflow-hidden border theme-border sm:grid-cols-2 lg:grid-cols-3">
        {kpis.map(([key, value]) => (
          <div key={key} className="bg-[var(--background)] p-4">
            <p className="text-xs font-medium theme-muted">
              {t(`partnerProgram.${key}`)}
            </p>
            <p className="mt-2 text-xl font-semibold theme-foreground">
              {value}
            </p>
          </div>
        ))}
      </div>
      {!hasActivity ? (
        <p className="mt-4 border p-4 text-sm theme-border theme-muted">
          {t("partnerProgram.emptyReferralActivity")}
        </p>
      ) : null}
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <AnalyticsChart
          id="partner-traffic-chart"
          title={t("partnerProgram.trafficChart")}
          description={t("partnerProgram.trafficChartDescription")}
          points={analytics.trafficSeries as TrafficPoint[]}
          locale={locale}
          series={[
            {
              key: "totalClicks",
              label: t("partnerProgram.totalVisits"),
              color: "#34B386",
            },
            {
              key: "uniqueVisitors",
              label: t("partnerProgram.uniqueVisitors"),
              color: "#3478B3",
            },
          ]}
        />
        <AnalyticsChart
          id="partner-conversion-chart"
          title={t("partnerProgram.conversionChart")}
          description={t("partnerProgram.conversionChartDescription")}
          points={analytics.conversionSeries as ConversionPoint[]}
          locale={locale}
          series={[
            {
              key: "attributedSignups",
              label: t("partnerProgram.referredSignups"),
              color: "#9B59B6",
            },
            {
              key: "sellerRegistrations",
              label: t("partnerProgram.sellerRegistrations"),
              color: "#E67E22",
            },
            {
              key: "buyerRegistrations",
              label: t("partnerProgram.buyerRegistrations"),
              color: "#2C9FA3",
            },
          ]}
        />
      </div>
    </section>
  );
}
