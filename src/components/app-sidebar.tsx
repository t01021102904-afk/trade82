"use client"

import * as React from "react"
import { useUser } from "@clerk/nextjs"
import { usePathname, useSearchParams } from "next/navigation"
import {
  ChartNoAxesCombined,
  CircleHelp,
  FileText,
  Handshake,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  Package,
  PanelTop,
  ReceiptText,
  Settings2,
  ShoppingCart,
  Users,
} from "lucide-react"

import { NavDocuments } from "@/components/nav-documents"
import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import { useI18n } from "@/components/i18n-provider"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { useUserContext } from "@/hooks/use-user-context"
import { stripLocale, withLocale } from "@/lib/i18n"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user } = useUser()
  const { context } = useUserContext()
  const { locale, t } = useI18n()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const path = stripLocale(pathname)
  const section = searchParams.get("section") ?? "overview"
  const company = context?.companies?.find((item) => item.companyRole === "seller")
  const href = (path: string) => withLocale(path, locale)
  const overviewUrl = href("/dashboard/seller")
  const isOverview = path === "/dashboard/seller" && section === "overview"

  const data = {
    user: {
      name: company?.tradeName || company?.legalName || user?.fullName || t("sellerDashboard.sellerFallback"),
      email: user?.primaryEmailAddress?.emailAddress || "",
      avatar: user?.imageUrl || "",
    },
    navMain: [
      { title: t("sellerDashboard.navOverview"), url: overviewUrl, icon: LayoutDashboard, active: isOverview },
      { title: t("sellerDashboard.navProducts"), url: `${overviewUrl}?section=products`, icon: Package, active: path === "/dashboard/seller" && section === "products" },
      { title: t("sellerDashboard.navQuotes"), icon: Handshake, disabled: true },
      { title: t("sellerDashboard.navOrders"), url: `${overviewUrl}?section=orders`, icon: ShoppingCart, active: path === "/dashboard/seller" && section === "orders" },
    ],
    operations: [
      { name: t("sellerDashboard.navDocuments"), url: `${overviewUrl}?section=documents`, icon: FileText, active: path === "/dashboard/seller" && section === "documents" },
      { name: t("sellerDashboard.navPayouts"), url: `${overviewUrl}?section=payouts`, icon: ReceiptText, active: path === "/dashboard/seller" && section === "payouts" },
    ],
    growth: [
      { name: t("sellerDashboard.navMarketing"), url: `${overviewUrl}?section=marketing`, icon: Megaphone, active: path === "/dashboard/seller" && section === "marketing" },
      { name: t("sellerDashboard.navAnalytics"), icon: ChartNoAxesCombined, disabled: true },
    ],
    navSecondary: [
      { title: t("sellerDashboard.navCompanyProfile"), url: href("/settings/company"), icon: Users, active: path === "/settings/company" },
      { title: t("sellerDashboard.navSettings"), url: href("/dashboard/settings"), icon: Settings2, active: path === "/dashboard/settings" },
      { title: t("sellerDashboard.navHelp"), url: href("/how-it-works"), icon: CircleHelp, active: path === "/how-it-works" },
    ],
  }

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              render={<a href={overviewUrl} />}
            >
              <PanelTop className="size-5!" />
              <span className="text-base font-semibold">{data.user.name}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain
          items={data.navMain}
          label={t("sellerDashboard.main")}
        />
        <NavDocuments items={data.operations} label={t("sellerDashboard.operations")} />
        <NavDocuments items={data.growth} label={t("sellerDashboard.growth")} />
        <NavSecondary
          items={data.navSecondary}
          label={t("sellerDashboard.account")}
          className="mt-auto"
        />
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={data.user}
          companyProfileUrl={href("/settings/company")}
          settingsUrl={href("/dashboard/settings")}
        />
      </SidebarFooter>
    </Sidebar>
  )
}
