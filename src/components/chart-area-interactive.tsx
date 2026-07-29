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

export type SellerChartPoint = {
  date: string
  productViews: number
  inquiries: number
  paidOrders: number
}

const chartConfig = {
  productViews: {
    label: "Product Views",
    color: "var(--primary)",
  },
  inquiries: {
    label: "Inquiries",
    color: "var(--primary)",
  },
  paidOrders: {
    label: "Paid Orders",
    color: "var(--primary)",
  },
} satisfies ChartConfig

export function ChartAreaInteractive({
  data,
  status = "ready",
}: {
  data: SellerChartPoint[] | null
  status?: "loading" | "ready" | "error"
}) {
  const isMobile = useIsMobile()
  const { locale, t } = useI18n()
  const [timeRange, setTimeRange] = React.useState("30d")

  React.useEffect(() => {
    if (isMobile) {
      setTimeRange("7d")
    }
  }, [isMobile])

  const filteredData = React.useMemo(() => {
    if (!data?.length) return []

    const referenceDate = new Date(data[data.length - 1].date)
    const startDate = new Date(referenceDate)
    startDate.setDate(startDate.getDate() - (timeRange === "7d" ? 7 : 30))

    return data.filter((item) => new Date(item.date) >= startDate)
  }, [data, timeRange])

  const emptyText =
    status === "loading"
      ? t("sellerDashboard.loading")
      : status === "error"
        ? t("sellerDashboard.loadError")
        : t("sellerDashboard.noTimeSeries")

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>{t("sellerDashboard.activity")}</CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">
            {t("sellerDashboard.activityDescription")}
          </span>
          <span className="@[540px]/card:hidden">{t("sellerDashboard.last30")}</span>
        </CardDescription>
        <CardAction>
          <ToggleGroup
            multiple={false}
            value={[timeRange]}
            onValueChange={(value) => setTimeRange(value[0] ?? "30d")}
            variant="outline"
            className="hidden *:data-[slot=toggle-group-item]:px-4! @[767px]/card:flex"
          >
            <ToggleGroupItem value="30d">{t("sellerDashboard.last30")}</ToggleGroupItem>
            <ToggleGroupItem value="7d">{t("sellerDashboard.last7")}</ToggleGroupItem>
          </ToggleGroup>
          <Select value={timeRange} onValueChange={(value) => value && setTimeRange(value)}>
            <SelectTrigger
              className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
              size="sm"
              aria-label={t("sellerDashboard.activity")}
            >
              <SelectValue placeholder={t("sellerDashboard.last30")} />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="30d" className="rounded-lg">
                {t("sellerDashboard.last30")}
              </SelectItem>
              <SelectItem value="7d" className="rounded-lg">
                {t("sellerDashboard.last7")}
              </SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {!data?.length ? (
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-[250px] w-full"
          >
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {emptyText}
            </div>
          </ChartContainer>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-[250px] w-full"
          >
            <AreaChart data={filteredData}>
              <defs>
                <linearGradient id="fillProductViews" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-productViews)" stopOpacity={1.0} />
                  <stop offset="95%" stopColor="var(--color-productViews)" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="fillInquiries" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-inquiries)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="var(--color-inquiries)" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tickFormatter={(value) =>
                  new Date(value).toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US", {
                    month: "short",
                    day: "numeric",
                  })
                }
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) =>
                      new Date(value).toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US", {
                        month: "short",
                        day: "numeric",
                      })
                    }
                    indicator="dot"
                  />
                }
              />
              <Area
                dataKey="paidOrders"
                type="natural"
                fill="var(--color-paidOrders)"
                fillOpacity={0.15}
                stroke="var(--color-paidOrders)"
                stackId="a"
              />
              <Area
                dataKey="inquiries"
                type="natural"
                fill="url(#fillInquiries)"
                stroke="var(--color-inquiries)"
                stackId="a"
              />
              <Area
                dataKey="productViews"
                type="natural"
                fill="url(#fillProductViews)"
                stroke="var(--color-productViews)"
                stackId="a"
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
