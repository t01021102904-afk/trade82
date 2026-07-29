export const SELLER_DASHBOARD_HISTORY_DAYS = 180

const ZERO = BigInt(0)
const TEN = BigInt(10)
const THOUSAND = BigInt(1000)

export type SellerDashboardSeriesPoint = {
  date: string
  netSalesMinorUnits: string
  revenueEvents: number
  newLeads: number
  quotesInProgress: number
  paidOrders: number
}

export type SellerDashboardCurrencySeries = {
  currency: string
  series: SellerDashboardSeriesPoint[]
}

type DatedMoney = {
  occurredAt: Date
  currency: string
  minorUnits: number
}

type DatedEvent = {
  occurredAt: Date
}

export type SellerDashboardNetSalesInput = {
  now: Date
  payments: DatedMoney[]
  refunds: DatedMoney[]
  newLeads: DatedEvent[]
  quotesInProgress: DatedEvent[]
}

export type SellerDashboardKpi = {
  current: string
  previous: string
  changeTenthsPercent: string | null
  direction: "up" | "down" | "flat" | "new" | "na"
}

export type SellerDashboardKpis = {
  netSales: SellerDashboardKpi
  newLeads: SellerDashboardKpi
  quotesInProgress: SellerDashboardKpi
  paidOrders: SellerDashboardKpi
}

type MutableSeriesPoint = Omit<SellerDashboardSeriesPoint, "netSalesMinorUnits"> & {
  netSalesMinorUnits: bigint
}

type MutableCurrencySeries = {
  series: MutableSeriesPoint[]
  pointsByDate: Map<string, MutableSeriesPoint>
}

export type SellerDashboardNetSalesSeries = {
  currencySeries: SellerDashboardCurrencySeries[]
  activitySeries: SellerDashboardSeriesPoint[]
}

function utcDateKey(value: Date) {
  return value.toISOString().slice(0, 10)
}

function shiftUtcDays(value: Date, days: number) {
  const next = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function createMutableSeries(now: Date): MutableSeriesPoint[] {
  return Array.from({ length: SELLER_DASHBOARD_HISTORY_DAYS }, (_, index) => {
    const date = shiftUtcDays(now, index - (SELLER_DASHBOARD_HISTORY_DAYS - 1))
    return {
      date: utcDateKey(date),
      netSalesMinorUnits: ZERO,
      revenueEvents: 0,
      newLeads: 0,
      quotesInProgress: 0,
      paidOrders: 0,
    }
  })
}

export function normalizeSellerDashboardCurrency(value: string | null | undefined) {
  const normalized = value?.trim().toUpperCase() ?? ""
  return /^[A-Z]{3}$/.test(normalized) ? normalized : null
}

function validMinorUnits(value: number) {
  return Number.isSafeInteger(value) && value >= 0
}

function serializeSeries(series: MutableSeriesPoint[]): SellerDashboardSeriesPoint[] {
  return series.map((point) => ({
    ...point,
    netSalesMinorUnits: point.netSalesMinorUnits.toString(),
  }))
}

export function buildSellerDashboardCurrencySeries({
  now,
  payments,
  refunds,
  newLeads,
  quotesInProgress,
}: SellerDashboardNetSalesInput): SellerDashboardNetSalesSeries {
  const seriesByCurrency = new Map<string, MutableCurrencySeries>()
  const activitySeries = createMutableSeries(now)
  const activityPointsByDate = new Map(activitySeries.map((point) => [point.date, point]))

  const getSeries = (currency: string) => {
    const existing = seriesByCurrency.get(currency)
    if (existing) return existing
    const series = createMutableSeries(now)
    const created = { series, pointsByDate: new Map(series.map((point) => [point.date, point])) }
    seriesByCurrency.set(currency, created)
    return created
  }

  for (const payment of payments) {
    const currency = normalizeSellerDashboardCurrency(payment.currency)
    if (!currency || !validMinorUnits(payment.minorUnits)) continue
    const date = utcDateKey(payment.occurredAt)
    const point = getSeries(currency).pointsByDate.get(date)
    if (!point) continue
    point.netSalesMinorUnits += BigInt(payment.minorUnits)
    point.revenueEvents += 1
    point.paidOrders += 1
    const activityPoint = activityPointsByDate.get(date)
    if (activityPoint) activityPoint.paidOrders += 1
  }

  for (const refund of refunds) {
    const currency = normalizeSellerDashboardCurrency(refund.currency)
    if (!currency || !validMinorUnits(refund.minorUnits)) continue
    const point = getSeries(currency).pointsByDate.get(utcDateKey(refund.occurredAt))
    if (!point) continue
    point.netSalesMinorUnits -= BigInt(refund.minorUnits)
    point.revenueEvents += 1
  }

  for (const lead of newLeads) {
    const point = activityPointsByDate.get(utcDateKey(lead.occurredAt))
    if (point) point.newLeads += 1
  }
  for (const quote of quotesInProgress) {
    const point = activityPointsByDate.get(utcDateKey(quote.occurredAt))
    if (point) point.quotesInProgress += 1
  }

  return {
    currencySeries: [...seriesByCurrency.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([currency, bucket]) => ({ currency, series: serializeSeries(bucket.series) })),
    activitySeries: serializeSeries(activitySeries),
  }
}

function sumWindow(
  series: SellerDashboardSeriesPoint[],
  days: number,
  key: keyof Omit<SellerDashboardSeriesPoint, "date">,
) {
  return series.slice(-days).reduce((total, point) => {
    const value = key === "netSalesMinorUnits"
      ? BigInt(point.netSalesMinorUnits)
      : BigInt(point[key])
    return total + value
  }, ZERO)
}

function sumPreviousWindow(
  series: SellerDashboardSeriesPoint[],
  days: number,
  key: keyof Omit<SellerDashboardSeriesPoint, "date">,
) {
  return series.slice(-(days * 2), -days).reduce((total, point) => {
    const value = key === "netSalesMinorUnits"
      ? BigInt(point.netSalesMinorUnits)
      : BigInt(point[key])
    return total + value
  }, ZERO)
}

function absolute(value: bigint) {
  return value < ZERO ? -value : value
}

function toKpi(current: bigint, previous: bigint): SellerDashboardKpi {
  if (previous === ZERO) {
    return {
      current: current.toString(),
      previous: previous.toString(),
      changeTenthsPercent: null,
      direction: current > ZERO ? "new" : current < ZERO ? "down" : "na",
    }
  }

  const difference = current - previous
  const magnitude = (absolute(difference) * THOUSAND + (absolute(previous) / TEN)) / absolute(previous)
  const signedChange = difference < ZERO ? -magnitude : magnitude
  return {
    current: current.toString(),
    previous: previous.toString(),
    changeTenthsPercent: signedChange.toString(),
    direction: difference > ZERO ? "up" : difference < ZERO ? "down" : "flat",
  }
}

export function getSellerDashboardKpis(
  netSalesSeries: SellerDashboardSeriesPoint[] | null,
  activitySeries: SellerDashboardSeriesPoint[],
  days: 7 | 30 | 90,
): SellerDashboardKpis {
  const kpi = (series: SellerDashboardSeriesPoint[], key: keyof Omit<SellerDashboardSeriesPoint, "date">) => toKpi(
    sumWindow(series, days, key),
    sumPreviousWindow(series, days, key),
  )

  return {
    netSales: kpi(netSalesSeries ?? activitySeries, "netSalesMinorUnits"),
    newLeads: kpi(activitySeries, "newLeads"),
    quotesInProgress: kpi(activitySeries, "quotesInProgress"),
    paidOrders: kpi(activitySeries, "paidOrders"),
  }
}

// Recharts needs a number for a visual coordinate. All accounting remains in
// minor-unit strings; values outside the precise Number range are deliberately
// not plotted rather than being silently rounded.
export function sellerDashboardChartValue(minorUnits: string, currency: string) {
  const amount = BigInt(minorUnits)
  const scale = BigInt(10 ** currencyFractionDigits(currency))
  const maximum = BigInt(Number.MAX_SAFE_INTEGER) * scale
  if (absolute(amount) > maximum) return null
  return Number(amount) / Number(scale)
}

export function currencyFractionDigits(currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2
  } catch {
    return 2
  }
}

export function formatSellerDashboardMoney(
  minorUnits: string,
  currency: string,
  locale: "en" | "ko",
) {
  const amount = BigInt(minorUnits)
  const digits = currencyFractionDigits(currency)
  const scale = BigInt(10 ** digits)
  const absoluteAmount = absolute(amount)
  const whole = absoluteAmount / scale
  const fraction = absoluteAmount % scale
  const language = locale === "ko" ? "ko-KR" : "en-US"
  const number = new Intl.NumberFormat(language, { maximumFractionDigits: 0 }).format(whole)
  const decimalSeparator = new Intl.NumberFormat(language, { minimumFractionDigits: 1 })
    .formatToParts(0)
    .find((part) => part.type === "decimal")?.value ?? "."
  const fractionText = digits > 0
    ? `${decimalSeparator}${fraction.toString().padStart(digits, "0")}`
    : ""
  const currencyParts = new Intl.NumberFormat(language, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).formatToParts(amount < ZERO ? -0 : 0)
  const firstNumberIndex = currencyParts.findIndex((part) => part.type === "integer")
  if (firstNumberIndex === -1) return `${amount < ZERO ? "-" : ""}${number}${fractionText} ${currency}`
  const lastNumberIndex = currencyParts.reduce(
    (last, part, index) => (["integer", "group", "decimal", "fraction"].includes(part.type) ? index : last),
    firstNumberIndex,
  )
  return `${currencyParts.slice(0, firstNumberIndex).map((part) => part.value).join("")}${number}${fractionText}${currencyParts.slice(lastNumberIndex + 1).map((part) => part.value).join("")}`
}

export function formatSellerDashboardCount(value: string, locale: "en" | "ko") {
  return new Intl.NumberFormat(locale === "ko" ? "ko-KR" : "en-US", {
    maximumFractionDigits: 0,
  }).format(BigInt(value))
}

export function formatSellerDashboardPercent(changeTenthsPercent: string | null) {
  if (changeTenthsPercent === null) return null
  const change = BigInt(changeTenthsPercent)
  const sign = change > ZERO ? "+" : change < ZERO ? "-" : ""
  const magnitude = absolute(change)
  return `${sign}${(magnitude / TEN).toString()}.${(magnitude % TEN).toString()}%`
}
