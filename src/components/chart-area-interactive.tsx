"use client"

import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"

import { useI18n } from "@/components/i18n-provider"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"
import { formatSellerDashboardMoney } from "@/lib/seller-dashboard-net-sales"

export type SellerNetSalesChartPoint = {
  date: string
  netSalesMinorUnits: string
  netSalesChartValue: number | null
  revenueEvents: number
}

export type SellerSalesTimeRange = "7d" | "30d" | "90d"

const chartConfig = {
  netSalesChartValue: {
    label: "Net Sales",
    color: "var(--primary)",
  },
} satisfies ChartConfig

export function ChartAreaInteractive({
  data,
  currency,
  currencies,
  onCurrencyChange,
  timeRange,
  onTimeRangeChange,
  status = "ready",
}: {
  data: SellerNetSalesChartPoint[] | null
  currency: string | null
  currencies: string[]
  onCurrencyChange: (currency: string) => void
  timeRange: SellerSalesTimeRange
  onTimeRangeChange: (range: SellerSalesTimeRange) => void
  status?: "loading" | "ready" | "error"
}) {
  const { locale, t } = useI18n()
  const rangeDays = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90
  const periodLabel = timeRange === "7d"
    ? t("sellerDashboard.last7")
    : timeRange === "90d"
      ? t("sellerDashboard.last3Months")
      : t("sellerDashboard.last30")
  const filteredData = data?.slice(-rangeDays) ?? []
  const hasEvent = filteredData.some((point) => point.revenueEvents > 0)
  const hasUnsupportedChartValue = filteredData.some(
    (point) => point.revenueEvents > 0 && point.netSalesChartValue === null,
  )
  const emptyText =
    status === "loading"
      ? t("sellerDashboard.loading")
      : status === "error"
        ? t("sellerDashboard.loadError")
        : hasUnsupportedChartValue
          ? t("sellerDashboard.chartUnavailable")
          : t("sellerDashboard.noNetSales")

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>{t("sellerDashboard.netSales")}</CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">{t("sellerDashboard.netSalesDescription")}</span>
          <span className="@[540px]/card:hidden">{periodLabel}</span>
        </CardDescription>
        <CardAction>
          <div className="flex items-center gap-2">
            {currencies.length > 0 ? (
              <Select value={currency ?? undefined} onValueChange={(value) => value && onCurrencyChange(value)}>
                <SelectTrigger
                  className="w-20"
                  size="sm"
                  aria-label={t("sellerDashboard.selectCurrency")}
                >
                  <SelectValue placeholder={t("sellerDashboard.selectCurrency")} />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {currencies.map((item) => (
                    <SelectItem key={item} value={item} className="rounded-lg">{item}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <ToggleGroup
              multiple={false}
              value={[timeRange]}
              onValueChange={(value) => onTimeRangeChange((value[0] as SellerSalesTimeRange | undefined) ?? timeRange)}
              variant="outline"
              className="hidden *:data-[slot=toggle-group-item]:px-4! @[767px]/card:flex"
              aria-label={t("sellerDashboard.selectNetSalesPeriod")}
            >
              <ToggleGroupItem value="90d">{t("sellerDashboard.last3Months")}</ToggleGroupItem>
              <ToggleGroupItem value="30d">{t("sellerDashboard.last30")}</ToggleGroupItem>
              <ToggleGroupItem value="7d">{t("sellerDashboard.last7")}</ToggleGroupItem>
            </ToggleGroup>
            <Select value={timeRange} onValueChange={(value) => value && onTimeRangeChange(value as SellerSalesTimeRange)}>
              <SelectTrigger
                className="flex w-32 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
                size="sm"
                aria-label={t("sellerDashboard.selectNetSalesPeriod")}
              >
                <SelectValue placeholder={t("sellerDashboard.last30")} />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="90d" className="rounded-lg">{t("sellerDashboard.last3Months")}</SelectItem>
                <SelectItem value="30d" className="rounded-lg">{t("sellerDashboard.last30")}</SelectItem>
                <SelectItem value="7d" className="rounded-lg">{t("sellerDashboard.last7")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {!hasEvent || hasUnsupportedChartValue ? (
          <div className="flex aspect-auto h-[250px] w-full items-center justify-center text-sm text-muted-foreground">
            {emptyText}
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
            <AreaChart data={filteredData}>
              <defs>
                <linearGradient id="fillNetSales" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-netSalesChartValue)" stopOpacity={1.0} />
                  <stop offset="95%" stopColor="var(--color-netSalesChartValue)" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tickFormatter={(value) => new Date(`${value}T00:00:00Z`).toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US", {
                  month: "short",
                  day: "numeric",
                  timeZone: "UTC",
                })}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) => new Date(`${value}T00:00:00Z`).toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US", {
                      month: "short",
                      day: "numeric",
                      timeZone: "UTC",
                    })}
                    formatter={(_value, _name, _item, _index, payload) => {
                      const point = payload as unknown as SellerNetSalesChartPoint
                      return (
                        <div className="flex flex-1 justify-between leading-none">
                          <span className="text-muted-foreground">{t("sellerDashboard.netSales")}</span>
                          <span className="font-mono font-medium text-foreground tabular-nums">
                            {currency ? formatSellerDashboardMoney(point.netSalesMinorUnits, currency, locale) : "—"}
                          </span>
                        </div>
                      )
                    }}
                    indicator="dot"
                  />
                }
              />
              <Area
                dataKey="netSalesChartValue"
                type="monotone"
                fill="url(#fillNetSales)"
                fillOpacity={0.4}
                stroke="var(--color-netSalesChartValue)"
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
