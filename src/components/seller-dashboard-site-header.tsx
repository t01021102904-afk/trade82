"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"

import { useI18n } from "@/components/i18n-provider"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { withLocale } from "@/lib/i18n"

const navigation = [
  { href: "/marketplace", label: "Marketplace" },
  { href: "/sellers", label: "Sellers" },
  { href: "/sell", label: "List product" },
  { href: "/dashboard/seller", label: "Dashboard" },
  { href: "/messages", label: "Messages" },
] as const

function removeLocalePrefix(pathname: string) {
  if (pathname === "/ko") return "/"
  return pathname.startsWith("/ko/") ? pathname.slice(3) : pathname
}

export function SiteHeader() {
  const { locale } = useI18n()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const query = searchParams.toString()
  const pathWithoutLocale = removeLocalePrefix(pathname)

  function languageHref(nextLocale: "en" | "ko") {
    const localizedPath = withLocale(pathWithoutLocale || "/", nextLocale)
    return query ? `${localizedPath}?${query}` : localizedPath
  }

  return (
    <header className="sticky top-0 z-40 flex h-[var(--header-height)] shrink-0 border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
      <div className="flex min-w-0 flex-1 items-center gap-3 px-4 lg:px-6">
        <SidebarTrigger className="-ml-1 shrink-0" />

        <Link
          href={withLocale("/", locale)}
          className="flex shrink-0 items-center gap-2 font-semibold text-zinc-950"
          aria-label="Trade82 home"
        >
          <span className="flex size-7 items-center justify-center rounded-md bg-zinc-950 text-[9px] font-black text-white">
            Trade82
          </span>
          <span className="hidden text-sm sm:inline">Trade82</span>
        </Link>

        <nav
          aria-label="Seller dashboard navigation"
          className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {navigation.map((item) => {
            const href = withLocale(item.href, locale)
            const active =
              item.href === "/dashboard/seller"
                ? pathWithoutLocale.startsWith("/dashboard/seller")
                : pathWithoutLocale === item.href ||
                  pathWithoutLocale.startsWith(`${item.href}/`)

            return (
              <Link
                key={item.href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "rounded-md bg-zinc-950 px-3 py-1.5 text-sm font-semibold text-white"
                    : "rounded-md px-3 py-1.5 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950"
                }
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="flex shrink-0 items-center rounded-md border border-zinc-200 bg-white p-0.5 text-xs font-semibold">
          <Link
            href={languageHref("en")}
            aria-current={locale === "en" ? "page" : undefined}
            className={
              locale === "en"
                ? "rounded bg-zinc-950 px-2 py-1 text-white"
                : "rounded px-2 py-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950"
            }
          >
            EN
          </Link>
          <Link
            href={languageHref("ko")}
            aria-current={locale === "ko" ? "page" : undefined}
            className={
              locale === "ko"
                ? "rounded bg-zinc-950 px-2 py-1 text-white"
                : "rounded px-2 py-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950"
            }
          >
            KO
          </Link>
        </div>
      </div>
    </header>
  )
}
