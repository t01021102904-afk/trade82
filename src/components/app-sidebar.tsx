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
import {
  loadAccountCompanies,
  type AccountCompanyRecord,
} from "@/hooks/use-account-companies"
import { useUserContext } from "@/hooks/use-user-context"
import { stripLocale, withLocale } from "@/lib/i18n"

function accountCompanyLogoUrl(company: AccountCompanyRecord | undefined) {
  if (!company || company.useDefaultLogo === true) return ""

  for (const field of [
    "logoThumbnailUrl",
    "logoUrl",
    "logoOriginalUrl",
  ] as const) {
    const value = company[field]
    if (typeof value === "string" && value.trim()) return value.trim()
  }

  return ""
}

function SidebarCompanyLogo({ logoUrl }: { logoUrl: string }) {
  const [failedLogoUrl, setFailedLogoUrl] = React.useState<string | null>(null)
  const showImage = Boolean(logoUrl && failedLogoUrl !== logoUrl)

  return (
    <span className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-sm text-sidebar-foreground">
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt=""
          className="size-full object-contain"
          onError={() => setFailedLogoUrl(logoUrl)}
        />
      ) : (
        <svg
          width={24}
          height={24}
          viewBox="0 0 24 24"
          fill="none"
          className="size-6"
          aria-hidden="true"
        >
          <path
            d="M13 11H17.8C18.9201 11 19.4802 11 19.908 11.218C20.2843 11.4097 20.5903 11.7157 20.782 12.092C21 12.5198 21 13.0799 21 14.2V21M13 21V6.2C13 5.0799 13 4.51984 12.782 4.09202C12.5903 3.71569 12.2843 3.40973 11.908 3.21799C11.4802 3 10.9201 3 9.8 3H6.2C5.0799 3 4.51984 3 4.09202 3.21799C3.71569 3.40973 3.40973 3.71569 3.21799C3 4.51984 3 5.0799 3 6.2V21M22 21H2M6.5 7H9.5M6.5 11H9.5M6.5 15H9.5"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </span>
  )
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user } = useUser()
  const { context } = useUserContext()
  const { locale, t } = useI18n()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [accountCompanies, setAccountCompanies] = React.useState<
    AccountCompanyRecord[]
  >([])

  React.useEffect(() => {
    const userId = user?.id
    if (!userId) return

    let cancelled = false
    void loadAccountCompanies(userId).then((companies) => {
      if (!cancelled) setAccountCompanies(companies)
    })

    return () => {
      cancelled = true
    }
  }, [user?.id])

  const path = stripLocale(pathname)
  const section = searchParams.get("section") ?? "overview"
  const company = context?.companies?.find((item) => item.companyRole === "seller")
  const accountCompany = accountCompanies.find(
    (item) => item.companyRole === "seller",
  )
  const companyLogoUrl = accountCompanyLogoUrl(accountCompany)
  const href = (path: string) => withLocale(path, locale)
  const overviewUrl = href("/dashboard/seller")
  const isOverview = path === "/dashboard/seller" && section === "overview"
  const isProducts =
    path === "/dashboard/seller/products/bulk" ||
    (path === "/dashboard/seller" && section === "products")

  const data = {
    user: {
      name: company?.tradeName || company?.legalName || user?.fullName || t("sellerDashboard.sellerFallback"),
      email: user?.primaryEmailAddress?.emailAddress || "",
      avatar: user?.imageUrl || "",
    },
    navMain: [
      { title: t("sellerDashboard.navOverview"), url: overviewUrl, icon: LayoutDashboard, active: isOverview },
      { title: t("sellerDashboard.navProducts"), url: `${overviewUrl}?section=products`, icon: Package, active: isProducts },
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
              <SidebarCompanyLogo logoUrl={companyLogoUrl} />
              <span className="truncate text-base font-semibold">
                {data.user.name}
              </span>
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
          helpUrl={href("/how-it-works")}
        />
      </SidebarFooter>
    </Sidebar>
  )
}
