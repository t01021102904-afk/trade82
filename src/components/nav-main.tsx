"use client"

import Link from "next/link"
import { CirclePlus, Mail, type LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function NavMain({
  items,
  label,
  addProductUrl,
  leadsUrl,
  addProductLabel,
  leadsLabel,
}: {
  items: {
    title: string
    url?: string
    icon?: LucideIcon
    disabled?: boolean
    active?: boolean
  }[]
  label: string
  addProductUrl: string
  leadsUrl: string
  addProductLabel: string
  leadsLabel: string
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          <SidebarMenuItem className="flex items-center gap-2">
            <SidebarMenuButton
              tooltip={addProductLabel}
              className="min-w-8 bg-primary text-primary-foreground duration-200 ease-linear hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground"
              render={<Link href={addProductUrl} />}
            >
              <CirclePlus />
              <span>{addProductLabel}</span>
            </SidebarMenuButton>
            <Button
              size="icon"
              className="size-8 group-data-[collapsible=icon]:opacity-0"
              variant="outline"
              render={<Link href={leadsUrl} />}
            >
              <Mail />
              <span className="sr-only">{leadsLabel}</span>
            </Button>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                tooltip={item.title}
                disabled={item.disabled}
                aria-disabled={item.disabled || undefined}
                isActive={item.active}
                render={item.disabled || !item.url ? undefined : <Link href={item.url} />}
              >
                {item.icon && <item.icon />}
                <span>{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
