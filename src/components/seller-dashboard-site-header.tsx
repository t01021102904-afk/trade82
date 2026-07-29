"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"

import { useI18n } from "@/components/i18n-provider"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { withLocale } from "@/lib/i18n"
import { cn } from "@/lib/utils"

export function SiteHeader() {
  const { locale, t } = useI18n()
  const searchParams = useSearchParams()
  const section = searchParams.get("section") ?? "overview"
  const currentTitle = section === "messages"
    ? t("nav.messages")
    : section === "products"
      ? t("sellerDashboard.navProducts")
      : section === "documents"
        ? t("sellerDashboard.navDocuments")
        : section === "marketing"
          ? t("sellerDashboard.navMarketing")
          : t("sellerDashboard.navOverview")
  const links = [
    { href: withLocale("/marketplace", locale), label: t("nav.marketplace") },
    { href: withLocale("/sellers", locale), label: t("nav.sellers") },
    { href: withLocale("/sell", locale), label: t("nav.listProduct") },
    {
      href: withLocale("/dashboard/seller", locale),
      label: t("nav.dashboard"),
      active: true,
    },
  ]

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
        <h1 className="truncate text-base font-medium md:hidden">{currentTitle}</h1>
        <nav className="hidden items-center gap-1 md:flex" aria-label={t("nav.primary")}>
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={link.active ? "page" : undefined}
              className={cn(
                "inline-flex h-8 items-center rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                link.active
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}
