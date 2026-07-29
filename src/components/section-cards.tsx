"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useI18n } from "@/components/i18n-provider"
import { CircleCheck, LoaderCircle } from "lucide-react"

export type SellerKpis = {
  productViews: number
  newLeads: number
  quotesInProgress: number
  paidOrders: number
}

export function SectionCards({ kpis, status }: { kpis: SellerKpis | null; status: "loading" | "ready" | "error" }) {
  const { t } = useI18n()
  const cards = [
    {
      description: t("sellerDashboard.productViews"),
      value: kpis?.productViews,
      footer: t("sellerDashboard.activity"),
    },
    {
      description: t("sellerDashboard.newLeads"),
      value: kpis?.newLeads,
      footer: t("sellerDashboard.newLeadsDescription"),
    },
    {
      description: t("sellerDashboard.quotesInProgress"),
      value: kpis?.quotesInProgress,
      footer: t("sellerDashboard.quotesInProgressDescription"),
    },
    {
      description: t("sellerDashboard.paidOrders"),
      value: kpis?.paidOrders,
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
              {card.value === undefined ? "—" : card.value.toLocaleString()}
            </CardTitle>
            <CardAction>
              <Badge variant="outline">
                {status === "ready" ? (
                  <>
                    <CircleCheck />
                    {t("sellerDashboard.live")}
                  </>
                ) : status === "loading" ? (
                  <>
                    <LoaderCircle />
                    {t("sellerDashboard.loading")}
                  </>
                ) : (
                  t("sellerDashboard.loadError")
                )}
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium">
              {status === "loading"
                ? t("sellerDashboard.loading")
                : status === "error"
                  ? t("sellerDashboard.loadError")
                  : card.footer}
            </div>
            <div className="text-muted-foreground">{t("sellerDashboard.workspace")}</div>
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}
