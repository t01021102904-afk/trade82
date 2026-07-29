"use client"

import { useI18n } from "@/components/i18n-provider"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { withLocale } from "@/lib/i18n"

export function SiteHeader() {
  const { locale, t } = useI18n()
  const addProductUrl = withLocale("/sell", locale)

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
        <h1 className="text-base font-medium">{t("sellerDashboard.navOverview")}</h1>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" render={<a href={addProductUrl} />} size="sm" className="hidden sm:flex">
            {t("sellerDashboard.addProduct")}
          </Button>
        </div>
      </div>
    </header>
  )
}
