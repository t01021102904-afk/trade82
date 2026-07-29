"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"

import { AppSidebar } from "@/components/app-sidebar"
import { ChartAreaInteractive, type SellerChartPoint } from "@/components/chart-area-interactive"
import { DashboardClient, type DashboardSection } from "@/components/dashboard-client"
import { DataTable, type RecentLead } from "@/components/data-table"
import { useI18n } from "@/components/i18n-provider"
import { SectionCards, type SellerKpis } from "@/components/section-cards"
import { SiteHeader } from "@/components/seller-dashboard-site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { withLocale } from "@/lib/i18n"

type Summary = {
  metrics: Record<string, number>
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

export function SellerDashboardShell() {
  const { locale, t } = useI18n()
  const searchParams = useSearchParams()
  const requestedSection = searchParams.get("section") as DashboardSection | null
  const activeSection = requestedSection && sellerSections.has(requestedSection) ? requestedSection : "overview"
  const [state, setState] = React.useState<SummaryState>({ status: "loading", summary: null })

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
  const kpis: SellerKpis | null = summary ? {
    productViews: summary.metrics.productViews ?? 0,
    newLeads: summary.metrics.newLeads ?? 0,
    quotesInProgress: summary.metrics.quotesInProgress ?? 0,
    paidOrders: summary.metrics.paidOrders ?? 0,
  } : null
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
    actionHref: messagesUrl,
  }))
  const chartData: SellerChartPoint[] | null = null

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              {activeSection === "overview" ? (
                <>
                  <SectionCards kpis={kpis} status={state.status} />
                  <div className="px-4 lg:px-6">
                    <ChartAreaInteractive data={chartData} status={state.status} />
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
