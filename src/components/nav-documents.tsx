"use client"

import Link from "next/link"
import { Ellipsis, type LucideIcon } from "lucide-react"

import { useI18n } from "@/components/i18n-provider"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

export function NavDocuments({
  items,
  label,
}: {
  items: {
    name: string
    url?: string
    icon: LucideIcon
    disabled?: boolean
    active?: boolean
  }[]
  label: string
}) {
  const { isMobile } = useSidebar()
  const { t } = useI18n()

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          <SidebarMenuItem key={item.name}>
            <SidebarMenuButton
              tooltip={item.name}
              disabled={item.disabled}
              aria-disabled={item.disabled || undefined}
              isActive={item.active}
              render={item.disabled || !item.url ? undefined : <Link href={item.url} />}
            >
              <item.icon />
              <span>{item.name}</span>
            </SidebarMenuButton>
            {!item.disabled && item.url ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <SidebarMenuAction
                      showOnHover
                      className="rounded-sm aria-expanded:bg-accent"
                    />
                  }
                >
                  <Ellipsis />
                  <span className="sr-only">{t("sellerDashboard.action")}</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-24 rounded-lg"
                  side={isMobile ? "bottom" : "right"}
                  align={isMobile ? "end" : "start"}
                >
                  <DropdownMenuItem render={<Link href={item.url} />}>
                    {t("sellerDashboard.view")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
