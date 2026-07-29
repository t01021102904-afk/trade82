"use client"

import { useClerk } from "@clerk/nextjs"
import {
  Building2,
  CircleHelp,
  EllipsisVertical,
  LogOut,
  Settings2,
} from "lucide-react"
import { useRouter } from "next/navigation"
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react"
import { createPortal } from "react-dom"

import { useI18n } from "@/components/i18n-provider"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { withLocale } from "@/lib/i18n"

type MenuPosition = {
  bottom: number
  left: number
  width: number
}

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
  const menuId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<MenuPosition | null>(null)
  const initials = user.name.trim().slice(0, 2).toUpperCase() || "T"

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger || typeof window === "undefined") return

    const rect = trigger.getBoundingClientRect()
    const gap = 8
    const popupWidth = Math.max(256, rect.width)

    if (isMobile) {
      setPosition({
        left: Math.max(
          gap,
          Math.min(rect.left, window.innerWidth - popupWidth - gap),
        ),
        bottom: Math.max(gap, window.innerHeight - rect.top + gap),
        width: popupWidth,
      })
      return
    }

    setPosition({
      left: Math.max(
        gap,
        Math.min(rect.right + gap, window.innerWidth - popupWidth - gap),
      ),
      bottom: Math.max(gap, window.innerHeight - rect.bottom),
      width: popupWidth,
    })
  }, [isMobile])

  useEffect(() => {
    if (!open) return

    updatePosition()
    const frame = window.requestAnimationFrame(updatePosition)

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (
        triggerRef.current?.contains(target) ||
        popupRef.current?.contains(target)
      ) {
        return
      }
      setOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      setOpen(false)
      triggerRef.current?.focus()
    }

    window.addEventListener("resize", updatePosition)
    window.addEventListener("scroll", updatePosition, true)
    document.addEventListener("pointerdown", handlePointerDown, true)
    document.addEventListener("keydown", handleKeyDown)

    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener("resize", updatePosition)
      window.removeEventListener("scroll", updatePosition, true)
      document.removeEventListener("pointerdown", handlePointerDown, true)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [open, updatePosition])

  const navigate = (url: string) => {
    setOpen(false)
    router.push(url)
  }

  const menu =
    open && position && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={popupRef}
            id={menuId}
            role="menu"
            aria-label={user.name}
            className="fixed z-[100] overflow-hidden rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-xl"
            style={{
              bottom: position.bottom,
              left: position.left,
              width: position.width,
            }}
          >
            <div className="flex items-center gap-2 px-2 py-2">
              <Avatar className="h-9 w-9 rounded-lg">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="rounded-lg">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {user.email}
                </span>
              </div>
            </div>

            <div className="my-1 h-px bg-border" />

            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => navigate(companyProfileUrl)}
            >
              <Building2 className="size-4" />
              {t("sellerDashboard.navCompanyProfile")}
            </button>
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => navigate(settingsUrl)}
            >
              <Settings2 className="size-4" />
              {t("sellerDashboard.navSettings")}
            </button>
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => navigate(helpUrl)}
            >
              <CircleHelp className="size-4" />
              {t("sellerDashboard.navHelp")}
            </button>

            <div className="my-1 h-px bg-border" />

            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => {
                setOpen(false)
                void signOut({
                  redirectUrl: withLocale("/", locale),
                })
              }}
            >
              <LogOut className="size-4" />
              {t("settings.signOut")}
            </button>
          </div>,
          document.body,
        )
      : null

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <button
            ref={triggerRef}
            type="button"
            aria-haspopup="menu"
            aria-expanded={open}
            aria-controls={open ? menuId : undefined}
            className="flex min-h-12 w-full items-center gap-2 overflow-hidden rounded-lg p-2 text-left text-sm outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            onClick={() => {
              updatePosition()
              setOpen((current) => !current)
            }}
          >
            <Avatar className="h-9 w-9 rounded-lg grayscale">
              <AvatarImage src={user.avatar} alt={user.name} />
              <AvatarFallback className="rounded-lg">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{user.name}</span>
              <span className="truncate text-xs text-muted-foreground">
                {user.email}
              </span>
            </div>
            <EllipsisVertical className="ml-auto size-4 shrink-0" />
          </button>
        </SidebarMenuItem>
      </SidebarMenu>
      {menu}
    </>
  )
}
