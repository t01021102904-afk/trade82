"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"

import { AppSidebar } from "@/components/app-sidebar"
import {
  ChartAreaInteractive,
  type SellerNetSalesChartPoint,
  type SellerSalesTimeRange,
} from "@/components/chart-area-interactive"
import { DashboardClient, type DashboardSection } from "@/components/dashboard-client"
import { DataTable, type RecentLead } from "@/components/data-table"
import { useI18n } from "@/components/i18n-provider"
import { SectionCards } from "@/components/section-cards"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { withLocale } from "@/lib/i18n"
import {
  getSellerDashboardKpis,
  sellerDashboardChartValue,
  type SellerDashboardCurrencySeries,
  type SellerDashboardSeriesPoint,
} from "@/lib/seller-dashboard-net-sales"

type Summary = {
  metrics: Record<string, number>
  sellerDashboard?: {
    defaultCurrency: string | null
    currencySeries: SellerDashboardCurrencySeries[]
    activitySeries: SellerDashboardSeriesPoint[]
  }
  recentInquiries?: Array<{
    id: string
    companyName: string
    productName: string | null
    country?: string | null
    createdAt?: string
    status?: "sent" | "replied" | "closed"
    lastMessage?: string
    message: string
  }>
}

type SummaryState =
  | { status: "loading"; summary: null }
  | { status: "error"; summary: null }
  | { status: "ready"; summary: Summary }

const sellerSections = new Set<DashboardSection>(["products", "documents", "marketing"])
const emptyCurrencySeries: SellerDashboardCurrencySeries[] = []
const emptyActivitySeries: SellerDashboardSeriesPoint[] = []

export function SellerDashboardShell() {
  const { locale, t } = useI18n()
  const searchParams = useSearchParams()
  const requestedSection = searchParams.get("section") as DashboardSection | null
  const activeSection = requestedSection && sellerSections.has(requestedSection) ? requestedSection : "overview"
  const [state, setState] = React.useState<SummaryState>({ status: "loading", summary: null })
  const [timeRange, setTimeRange] = React.useState<SellerSalesTimeRange>("30d")
  const [selectedCurrency, setSelectedCurrency] = React.useState<string | null>(null)

  React.useEffect(() => {
    const controller = new AbortController()
    void fetch("/api/dashboard/summary?role=seller", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("seller_dashboard_summary_failed")
        return response.json() as Promise<Summary>
      })
      .then((summary) => setState({ status: "ready", summary }))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setState({ status: "error", summary: null })
        }
      })
    return () => controller.abort()
  }, [])

  const summary = state.status === "ready" ? state.summary : null
  const currencySeries = summary?.sellerDashboard?.currencySeries ?? emptyCurrencySeries
  const currencies = React.useMemo(() => currencySeries.map((series) => series.currency), [currencySeries])
  const defaultCurrency = summary?.sellerDashboard?.defaultCurrency ?? currencies[0] ?? null

  const currency = selectedCurrency && currencies.includes(selectedCurrency)
    ? selectedCurrency
    : defaultCurrency
  const netSalesSeries = currencySeries.find((series) => series.currency === currency)?.series ?? null
  const activitySeries = summary?.sellerDashboard?.activitySeries ?? emptyActivitySeries
  const kpis = summary?.sellerDashboard
    ? getSellerDashboardKpis(netSalesSeries, activitySeries, timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90)
    : null
  const messagesUrl = withLocale("/messages", locale)
  const leads: RecentLead[] = (summary?.recentInquiries ?? []).map((lead) => ({
    id: lead.id,
    buyer: lead.companyName,
    product: lead.productName ?? t("sellerDashboard.productNotSpecified"),
    country: lead.country ?? "—",
    receivedAt: lead.createdAt
      ? new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", { dateStyle: "medium" }).format(new Date(lead.createdAt))
      : "—",
    status: lead.status === "replied" ? t("sellerDashboard.leadReplied") : lead.status === "closed" ? t("sellerDashboard.leadClosed") : t("sellerDashboard.newLeadStatus"),
    lastMessage: lead.lastMessage || lead.message,
    actionHref: `${messagesUrl}?inquiryId=${encodeURIComponent(lead.id)}`,
  }))
  const chartData: SellerNetSalesChartPoint[] | null = netSalesSeries && currency
    ? netSalesSeries.map((point) => ({
        date: point.date,
        netSalesMinorUnits: point.netSalesMinorUnits,
        revenueEvents: point.revenueEvents,
        netSalesChartValue: sellerDashboardChartValue(point.netSalesMinorUnits, currency),
      }))
    : null

  return (
    <SidebarProvider
      className="min-h-[calc(100svh-3.5rem)]"
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
        } as React.CSSProperties
      }
    >
      <AppSidebar
        variant="inset"
        className="md:top-14 md:bottom-auto md:h-[calc(100svh-3.5rem)]"
      />
      <SidebarInset>
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              {activeSection === "overview" ? (
                <>
                  <SectionCards kpis={kpis} currency={currency} status={state.status} />
                  <div className="px-4 lg:px-6">
                    <ChartAreaInteractive
                      data={chartData}
                      currency={currency}
                      currencies={currencies}
                      onCurrencyChange={setSelectedCurrency}
                      timeRange={timeRange}
                      onTimeRangeChange={setTimeRange}
                      status={state.status}
                    />
                  </div>
                  <DataTable data={leads} status={state.status} />
                </>
              ) : (
                <div className="px-4 lg:px-6">
                  <DashboardClient role="seller" activeSection={activeSection} />
                </div>
              )}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
