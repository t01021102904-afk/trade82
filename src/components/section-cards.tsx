"use client"

import { LoaderCircle, TrendingDown, TrendingUp } from "lucide-react"

import { useI18n } from "@/components/i18n-provider"
import { Badge } from "@/components/ui/badge"
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import {
  formatSellerDashboardCount,
  formatSellerDashboardMoney,
  formatSellerDashboardPercent,
  type SellerDashboardKpi,
  type SellerDashboardKpis,
} from "@/lib/seller-dashboard-net-sales"

type DashboardStatus = "loading" | "ready" | "error"

function KpiBadge({ kpi, status }: { kpi: SellerDashboardKpi | null; status: DashboardStatus }) {
  const { t } = useI18n()

  if (status === "loading") {
    return (
      <Badge variant="outline">
        <LoaderCircle className="animate-spin" />
        {t("sellerDashboard.loading")}
      </Badge>
    )
  }
  if (status === "error" || !kpi) return <Badge variant="outline">{t("sellerDashboard.notAvailable")}</Badge>
  if (kpi.direction === "new") return <Badge variant="outline">{t("sellerDashboard.new")}</Badge>
  if (kpi.direction === "na") return <Badge variant="outline">{t("sellerDashboard.notAvailable")}</Badge>
  if (kpi.direction === "flat") return <Badge variant="outline">{t("sellerDashboard.noChangeFromPrevious")}</Badge>

  const change = formatSellerDashboardPercent(kpi.changeTenthsPercent)
  if (!change) {
    return <Badge variant="outline"><TrendingDown />{t("sellerDashboard.notAvailable")}</Badge>
  }
  if (kpi.direction === "up") {
    return <Badge variant="outline"><TrendingUp />{change}</Badge>
  }
  return <Badge variant="outline"><TrendingDown />{change}</Badge>
}

export function SectionCards({
  kpis,
  currency,
  status,
}: {
  kpis: SellerDashboardKpis | null
  currency: string | null
  status: DashboardStatus
}) {
  const { locale, t } = useI18n()
  const cards = [
    {
      description: t("sellerDashboard.netSales"),
      value: kpis?.netSales,
      format: (kpi: SellerDashboardKpi) => currency
        ? formatSellerDashboardMoney(kpi.current, currency, locale)
        : "—",
      footer: t("sellerDashboard.netSalesDescription"),
    },
    {
      description: t("sellerDashboard.newLeads"),
      value: kpis?.newLeads,
      format: (kpi: SellerDashboardKpi) => formatSellerDashboardCount(kpi.current, locale),
      footer: t("sellerDashboard.newLeadsDescription"),
    },
    {
      description: t("sellerDashboard.quotesInProgress"),
      value: kpis?.quotesInProgress,
      format: (kpi: SellerDashboardKpi) => formatSellerDashboardCount(kpi.current, locale),
      footer: t("sellerDashboard.quotesInProgressDescription"),
    },
    {
      description: t("sellerDashboard.paidOrders"),
      value: kpis?.paidOrders,
      format: (kpi: SellerDashboardKpi) => formatSellerDashboardCount(kpi.current, locale),
      footer: t("sellerDashboard.paidOrdersDescription"),
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      {cards.map((card) => (
        <Card key={card.description} className="@container/card">
          <CardHeader>
            <CardDescription>{card.description}</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {card.value ? card.format(card.value) : "—"}
            </CardTitle>
            <CardAction><KpiBadge kpi={card.value ?? null} status={status} /></CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium">
              {status === "loading"
                ? t("sellerDashboard.loading")
                : status === "error"
                  ? t("sellerDashboard.loadError")
                  : card.value?.direction === "new"
                    ? t("sellerDashboard.newInPeriod")
                    : card.value?.direction === "na"
                      ? t("sellerDashboard.noPriorPeriod")
                      : card.footer}
            </div>
            <div className="text-muted-foreground">{t("sellerDashboard.comparedWithPrevious")}</div>
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}
