"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"

import { useI18n } from "@/components/i18n-provider"
import { useIsMobile } from "@/hooks/use-mobile"
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

export type SellerRevenueTimeRange = "90d" | "30d" | "7d"

export type SellerRevenuePoint = {
  date: string
  netRevenueCents: number
  revenueEvents: number
}

const chartConfig = {
  netRevenueCents: {
    label: "Net Revenue",
    color: "var(--primary)",
  },
} satisfies ChartConfig

function rangeDays(timeRange: SellerRevenueTimeRange) {
  return timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90
}

function formatCurrency(valueInCents: number, locale: "en" | "ko") {
  return new Intl.NumberFormat(locale === "ko" ? "ko-KR" : "en-US", {
    style: "currency",
    currency: "USD",
  }).format(valueInCents / 100)
}

export function ChartAreaInteractive({
  data,
  status = "ready",
  timeRange,
  onTimeRangeChange,
}: {
  data: SellerRevenuePoint[] | null
  status?: "loading" | "ready" | "error"
  timeRange: SellerRevenueTimeRange
  onTimeRangeChange: (timeRange: SellerRevenueTimeRange) => void
}) {
  const isMobile = useIsMobile()
  const { locale, t } = useI18n()
  React.useEffect(() => {
    if (isMobile) onTimeRangeChange("7d")
  }, [isMobile, onTimeRangeChange])
  const filteredData = data?.slice(-rangeDays(timeRange)) ?? []
  const hasRevenueData = filteredData.some((item) => item.revenueEvents > 0)
  const emptyText = status === "loading"
    ? t("sellerDashboard.loading")
    : status === "error"
      ? t("sellerDashboard.loadError")
      : t("sellerDashboard.noRevenue")
  const timeRangeLabel = timeRange === "90d"
    ? t("sellerDashboard.last3Months")
    : timeRange === "30d"
      ? t("sellerDashboard.last30")
      : t("sellerDashboard.last7")
  const selectTimeRange = (value: string | null) => {
    if (value === "90d" || value === "30d" || value === "7d") onTimeRangeChange(value)
  }

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>{t("sellerDashboard.netRevenue")}</CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">
            {t("sellerDashboard.netRevenueDescription")}
          </span>
          <span className="@[540px]/card:hidden">{timeRangeLabel}</span>
        </CardDescription>
        <CardAction>
          <ToggleGroup
            multiple={false}
            value={[timeRange]}
            onValueChange={(value) => selectTimeRange(value[0] ?? null)}
            variant="outline"
            className="hidden *:data-[slot=toggle-group-item]:px-4! @[767px]/card:flex"
          >
            <ToggleGroupItem value="90d">{t("sellerDashboard.last3Months")}</ToggleGroupItem>
            <ToggleGroupItem value="30d">{t("sellerDashboard.last30")}</ToggleGroupItem>
            <ToggleGroupItem value="7d">{t("sellerDashboard.last7")}</ToggleGroupItem>
          </ToggleGroup>
          <Select value={timeRange} onValueChange={selectTimeRange}>
            <SelectTrigger
              className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
              size="sm"
              aria-label={t("sellerDashboard.selectRevenuePeriod")}
            >
              <SelectValue placeholder={t("sellerDashboard.last3Months")} />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="90d" className="rounded-lg">{t("sellerDashboard.last3Months")}</SelectItem>
              <SelectItem value="30d" className="rounded-lg">{t("sellerDashboard.last30")}</SelectItem>
              <SelectItem value="7d" className="rounded-lg">{t("sellerDashboard.last7")}</SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {hasRevenueData ? (
          <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
            <AreaChart data={filteredData}>
              <defs>
                <linearGradient id="fillNetRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-netRevenueCents)" stopOpacity={1.0} />
                  <stop offset="95%" stopColor="var(--color-netRevenueCents)" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tickFormatter={(value) => new Date(value).toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US", {
                  month: "short",
                  day: "numeric",
                })}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) => new Date(value).toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                    formatter={(value) => formatCurrency(Number(value), locale)}
                    indicator="dot"
                  />
                }
              />
              <Area
                dataKey="netRevenueCents"
                type="natural"
                fill="url(#fillNetRevenue)"
                stroke="var(--color-netRevenueCents)"
              />
            </AreaChart>
          </ChartContainer>
        ) : (
          <div className="flex h-[250px] w-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
            <p className="max-w-sm">{emptyText}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
