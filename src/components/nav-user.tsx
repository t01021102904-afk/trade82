"use client"

import { useClerk } from "@clerk/nextjs"
import { Building2, CircleHelp, EllipsisVertical, LogOut, Settings2 } from "lucide-react"
import { useRouter } from "next/navigation"

import { useI18n } from "@/components/i18n-provider"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { withLocale } from "@/lib/i18n"

export function NavUser({
  user,
  companyProfileUrl,
  settingsUrl,
  helpUrl,
}: {
  user: {
    name: string
    email: string
    avatar: string
  }
  companyProfileUrl: string
  settingsUrl: string
  helpUrl: string
}) {
  const { isMobile } = useSidebar()
  const { locale, t } = useI18n()
  const { signOut } = useClerk()
  const router = useRouter()
  const initials = user.name.trim().slice(0, 2).toUpperCase() || "T"

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            type="button"
            className="flex min-h-12 w-full items-center gap-2 overflow-hidden rounded-lg p-2 text-left text-sm outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring data-[popup-open]:bg-sidebar-accent data-[popup-open]:text-sidebar-accent-foreground"
          >
            <Avatar className="h-9 w-9 rounded-lg grayscale">
              <AvatarImage src={user.avatar} alt={user.name} />
              <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
            </Avatar>
            <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{user.name}</span>
              <span className="truncate text-xs text-muted-foreground">
                {user.email}
              </span>
            </div>
            <EllipsisVertical className="ml-auto size-4 shrink-0" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-64 rounded-xl p-1 shadow-lg"
            side={isMobile ? "top" : "right"}
            align="end"
            sideOffset={8}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                className="gap-3 rounded-lg py-2.5"
                onClick={() => router.push(companyProfileUrl)}
              >
                <Building2 />
                {t("sellerDashboard.navCompanyProfile")}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="gap-3 rounded-lg py-2.5"
                onClick={() => router.push(settingsUrl)}
              >
                <Settings2 />
                {t("sellerDashboard.navSettings")}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="gap-3 rounded-lg py-2.5"
                onClick={() => router.push(helpUrl)}
              >
                <CircleHelp />
                {t("sellerDashboard.navHelp")}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-3 rounded-lg py-2.5"
              onClick={() =>
                void signOut({ redirectUrl: withLocale("/", locale) })
              }
            >
              <LogOut />
              {t("settings.signOut")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
