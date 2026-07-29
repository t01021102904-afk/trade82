"use client"

import { LoaderCircle, TrendingDown, TrendingUp } from "lucide-react"

import { useI18n } from "@/components/i18n-provider"
import { Badge } from "@/components/ui/badge"
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import type { SellerDashboardKpi, SellerDashboardKpis } from "@/lib/seller-dashboard-analytics"

type DashboardStatus = "loading" | "ready" | "error"

function formatCurrency(valueInCents: number, locale: "en" | "ko") {
  return new Intl.NumberFormat(locale === "ko" ? "ko-KR" : "en-US", {
    style: "currency",
    currency: "USD",
  }).format(valueInCents / 100)
}

function TrendBadge({ kpi, status }: { kpi: SellerDashboardKpi | undefined; status: DashboardStatus }) {
  const { t } = useI18n()

  if (status === "loading") {
    return (
      <Badge variant="outline" aria-label={t("sellerDashboard.loading")}>
        <LoaderCircle className="animate-spin" />
        <span className="sr-only">{t("sellerDashboard.loading")}</span>
      </Badge>
    )
  }

  if (status === "error" || !kpi) {
    return <Badge variant="outline">{t("sellerDashboard.notAvailable")}</Badge>
  }

  if (kpi.direction === "new") {
    return <Badge variant="outline">{t("sellerDashboard.new")}</Badge>
  }

  if (kpi.direction === "na") {
    return <Badge variant="outline">{t("sellerDashboard.notAvailable")}</Badge>
  }

  const change = Math.abs(kpi.change ?? 0).toFixed(1)
  const isUp = kpi.direction === "up"
  const isDown = kpi.direction === "down"

  return (
    <Badge variant="outline">
      {isUp ? <TrendingUp /> : isDown ? <TrendingDown /> : null}
      {isUp ? "+" : isDown ? "-" : ""}{change}%
    </Badge>
  )
}

function TrendDescription({ kpi, status }: { kpi: SellerDashboardKpi | undefined; status: DashboardStatus }) {
  const { t } = useI18n()

  if (status === "loading") return t("sellerDashboard.loading")
  if (status === "error" || !kpi) return t("sellerDashboard.loadError")
  if (kpi.direction === "up") {
    return <>{t("sellerDashboard.upFromPrevious")} <TrendingUp className="size-4" /></>
  }
  if (kpi.direction === "down") {
    return <>{t("sellerDashboard.downFromPrevious")} <TrendingDown className="size-4" /></>
  }
  if (kpi.direction === "new") return t("sellerDashboard.newInPeriod")
  if (kpi.direction === "flat") return t("sellerDashboard.noChangeFromPrevious")
  return t("sellerDashboard.noPriorPeriod")
}

export function SectionCards({
  kpis,
  status,
}: {
  kpis: SellerDashboardKpis | null
  status: DashboardStatus
}) {
  const { locale, t } = useI18n()
  const cards = [
    {
      description: t("sellerDashboard.netRevenue"),
      value: kpis?.netRevenue.current,
      kpi: kpis?.netRevenue,
      isCurrency: true,
    },
    {
      description: t("sellerDashboard.newLeads"),
      value: kpis?.newLeads.current,
      kpi: kpis?.newLeads,
      isCurrency: false,
    },
    {
      description: t("sellerDashboard.quotesInProgress"),
      value: kpis?.quotesInProgress.current,
      kpi: kpis?.quotesInProgress,
      isCurrency: false,
    },
    {
      description: t("sellerDashboard.paidOrders"),
      value: kpis?.paidOrders.current,
      kpi: kpis?.paidOrders,
      isCurrency: false,
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      {cards.map((card) => (
        <Card key={card.description} className="@container/card">
          <CardHeader>
            <CardDescription>{card.description}</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {card.value === undefined
                ? "—"
                : card.isCurrency
                  ? formatCurrency(card.value, locale)
                  : card.value.toLocaleString(locale === "ko" ? "ko-KR" : "en-US")}
            </CardTitle>
            <CardAction>
              <TrendBadge kpi={card.kpi} status={status} />
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium">
              <TrendDescription kpi={card.kpi} status={status} />
            </div>
            <div className="text-muted-foreground">
              {t("sellerDashboard.comparedWithPrevious")}
            </div>
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}
