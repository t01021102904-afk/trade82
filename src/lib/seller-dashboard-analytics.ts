export const SELLER_DASHBOARD_HISTORY_DAYS = 180

export type SellerDashboardSeriesPoint = {
  date: string
  netRevenueCents: number
  revenueEvents: number
  newLeads: number
  quotesInProgress: number
  paidOrders: number
}

type DatedAmount = {
  occurredAt: Date
  amount: number
}

type DatedEvent = {
  occurredAt: Date
}

export type SellerDashboardAnalyticsInput = {
  now: Date
  paidOrders: DatedAmount[]
  refunds: DatedAmount[]
  newLeads: DatedEvent[]
  quotesInProgress: DatedEvent[]
}

export type SellerDashboardKpi = {
  current: number
  previous: number
  change: number | null
  direction: "up" | "down" | "flat" | "new" | "na"
}

export type SellerDashboardKpis = {
  netRevenue: SellerDashboardKpi
  newLeads: SellerDashboardKpi
  quotesInProgress: SellerDashboardKpi
  paidOrders: SellerDashboardKpi
}

function utcDateKey(value: Date) {
  return value.toISOString().slice(0, 10)
}

function shiftUtcDays(value: Date, days: number) {
  const next = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function createSeries(now: Date) {
  return Array.from({ length: SELLER_DASHBOARD_HISTORY_DAYS }, (_, index) => {
    const date = shiftUtcDays(now, index - (SELLER_DASHBOARD_HISTORY_DAYS - 1))
    return {
      date: utcDateKey(date),
      netRevenueCents: 0,
      revenueEvents: 0,
      newLeads: 0,
      quotesInProgress: 0,
      paidOrders: 0,
    }
  })
}

export function buildSellerDashboardSeries({
  now,
  paidOrders,
  refunds,
  newLeads,
  quotesInProgress,
}: SellerDashboardAnalyticsInput): SellerDashboardSeriesPoint[] {
  const series = createSeries(now)
  const pointByDate = new Map(series.map((point) => [point.date, point]))

  for (const order of paidOrders) {
    const point = pointByDate.get(utcDateKey(order.occurredAt))
    if (!point) continue
    point.netRevenueCents += order.amount
    point.revenueEvents += 1
    point.paidOrders += 1
  }

  for (const refund of refunds) {
    const point = pointByDate.get(utcDateKey(refund.occurredAt))
    if (!point) continue
    point.netRevenueCents -= refund.amount
    point.revenueEvents += 1
  }

  for (const lead of newLeads) {
    const point = pointByDate.get(utcDateKey(lead.occurredAt))
    if (point) point.newLeads += 1
  }

  for (const quote of quotesInProgress) {
    const point = pointByDate.get(utcDateKey(quote.occurredAt))
    if (point) point.quotesInProgress += 1
  }

  return series
}

function sumWindow(
  series: SellerDashboardSeriesPoint[],
  days: number,
  key: keyof Omit<SellerDashboardSeriesPoint, "date">,
) {
  return series.slice(-days).reduce((total, point) => total + point[key], 0)
}

function sumPreviousWindow(
  series: SellerDashboardSeriesPoint[],
  days: number,
  key: keyof Omit<SellerDashboardSeriesPoint, "date">,
) {
  return series.slice(-(days * 2), -days).reduce((total, point) => total + point[key], 0)
}

function kpi(
  series: SellerDashboardSeriesPoint[],
  days: number,
  key: keyof Omit<SellerDashboardSeriesPoint, "date">,
): SellerDashboardKpi {
  const current = sumWindow(series, days, key)
  const previous = sumPreviousWindow(series, days, key)

  if (previous === 0) {
    return {
      current,
      previous,
      change: null,
      direction: current > 0 ? "new" : "na",
    }
  }

  const change = ((current - previous) / Math.abs(previous)) * 100
  return {
    current,
    previous,
    change,
    direction: change > 0 ? "up" : change < 0 ? "down" : "flat",
  }
}

export function getSellerDashboardKpis(
  series: SellerDashboardSeriesPoint[],
  days: 7 | 30 | 90,
): SellerDashboardKpis {
  return {
    netRevenue: kpi(series, days, "netRevenueCents"),
    newLeads: kpi(series, days, "newLeads"),
    quotesInProgress: kpi(series, days, "quotesInProgress"),
    paidOrders: kpi(series, days, "paidOrders"),
  }
}
