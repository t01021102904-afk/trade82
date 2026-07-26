"use client";

import { Menu, Search, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useRef, useState } from "react";

import { ClerkUserButton } from "@/components/clerk-user-button";
import { useI18n } from "@/components/i18n-provider";
import { useAccessibleDialog } from "@/hooks/use-accessible-dialog";
import { useUserContext } from "@/hooks/use-user-context";
import { stripLocale, withLocale } from "@/lib/i18n";
import {
  getPublicNavigationLinks,
  isPartnerOnlyNavigationAccount,
} from "@/lib/public-navigation";
import { cx } from "@/lib/utils";

const appLinks = [
  { href: "/dashboard", labelKey: "nav.dashboard" },
  { href: "/messages", labelKey: "nav.messages" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { locale, t } = useI18n();
  const { context, isSignedIn, user } = useUserContext();
  const [open, setOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const pathWithoutLocale = stripLocale(pathname);
  const metadataRole = user?.publicMetadata?.role;
  const role =
    context?.role ??
    (metadataRole === "buyer" ||
    metadataRole === "seller" ||
    metadataRole === "both" ||
    metadataRole === "admin" ||
    metadataRole === "user"
      ? metadataRole
      : undefined);
  const isAdmin = context?.isAdmin === true;
  const unreadMessageCount = normalizeUnreadCount(context?.unreadMessageCount);
  const hasRole =
    role === "buyer" ||
    role === "seller" ||
    role === "both" ||
    role === "admin";
  const isPartnerOnly = isPartnerOnlyNavigationAccount({
    isSignedIn: isSignedIn === true,
    role,
    partnerProfile: context?.partnerProfile,
    companies: context?.companies ?? [],
  });
  const publicDiscoveryLinks = [
    ...getPublicNavigationLinks(),
    { href: "/how-it-works", labelKey: "nav.howItWorks" },
  ];
  const visibleNavLinks =
    isSignedIn && (hasRole || isPartnerOnly)
      ? [
          ...publicDiscoveryLinks,
          ...(isPartnerOnly
            ? [{ href: "/partner/dashboard", labelKey: "nav.partnerDashboard" }]
            : []),
          ...(!isPartnerOnly &&
          (role === "buyer" || role === "both" || role === "admin")
            ? [
                {
                  href: "/dashboard/buyer?section=saved-products",
                  labelKey: "nav.saved",
                },
              ]
            : []),
          ...(isPartnerOnly ? [] : appLinks),
        ]
      : publicDiscoveryLinks;
  const closeMenu = useCallback(() => setOpen(false), []);

  useAccessibleDialog({
    open,
    dialogRef: drawerRef,
    onClose: closeMenu,
  });

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white text-zinc-950">
      <div className="mx-auto flex h-14 w-full max-w-[1240px] items-center justify-between gap-3 px-4 sm:px-5 lg:px-6">
        <Link
          href={withLocale("/", locale)}
          className="flex min-w-0 items-center gap-2 text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#34B386]/40"
        >
          <Image
            src="/trade82-logo.png"
            alt="Trade82"
            width={40}
            height={40}
            priority
            className="size-7 shrink-0 object-contain"
          />
          <span className="truncate text-[15px] font-semibold tracking-[-0.02em]">
            Trade82
          </span>
        </Link>

        <nav className="hidden items-center gap-0.5 lg:flex" aria-label={t("nav.primary")}>
          {visibleNavLinks.map((link) => (
            <Link
              key={link.href}
              href={withLocale(link.href, locale)}
              className={cx(
                "relative rounded-md px-2.5 py-1.5 text-[13px] font-medium text-zinc-600 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#34B386]/40",
                pathWithoutLocale === link.href.split("?")[0]
                  ? "bg-[#34B386]/10 text-zinc-950"
                  : "hover:bg-zinc-100 hover:text-zinc-950",
              )}
            >
              {t(link.labelKey)}
              {link.href === "/messages" ? (
                <UnreadMessageBadge
                  count={unreadMessageCount}
                  className="-right-1 -top-1"
                />
              ) : null}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <div
            className="flex items-center rounded-md border border-zinc-200 p-0.5"
            role="group"
            aria-label={t("nav.language")}
          >
            {(["en", "ko"] as const).map((nextLocale) => (
              <Link
                key={nextLocale}
                href={withLocale(pathWithoutLocale, nextLocale)}
                aria-current={locale === nextLocale ? "page" : undefined}
                className={cx(
                  "rounded px-2.5 py-1.5 text-xs font-semibold transition",
                  locale === nextLocale
                    ? "bg-zinc-950 text-white"
                    : "text-zinc-500 hover:text-zinc-950",
                )}
              >
                {nextLocale === "en" ? "EN" : "KO"}
              </Link>
            ))}
          </div>
          {isSignedIn && isAdmin ? (
            <Link
              href="/admin"
              className={cx(
                "rounded-md px-3 py-2 text-sm font-medium transition",
                pathWithoutLocale.startsWith("/admin")
                  ? "theme-surface-muted theme-foreground"
                  : "theme-muted hover:bg-[var(--muted)] hover:text-[var(--foreground)]",
              )}
            >
              Admin Console
            </Link>
          ) : null}
          {isSignedIn ? (
            <ClerkUserButton />
          ) : (
            <Link
              href={withLocale("/login", locale)}
              className="rounded-md px-3 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-950"
            >
              {t("common.signIn")}
            </Link>
          )}
        </div>

        <div className="flex items-center gap-1.5 lg:hidden">
          <Link
            href={withLocale("/marketplace", locale)}
            aria-label={t("marketplace.searchProducts")}
            className="inline-flex size-9 items-center justify-center rounded-md text-zinc-700 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#34B386]/40"
          >
            <Search className="size-5" aria-hidden="true" />
          </Link>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-zinc-200 text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#34B386]/40"
            aria-label={t("nav.menu")}
            aria-expanded={open}
            aria-controls="public-mobile-navigation"
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-zinc-950/35"
            aria-label={t("nav.close")}
            onClick={closeMenu}
          />
          <div
            ref={drawerRef}
            id="public-mobile-navigation"
            role="dialog"
            aria-modal="true"
            aria-label={t("nav.primary")}
            tabIndex={-1}
            className="absolute inset-y-0 right-0 flex w-[min(88vw,360px)] flex-col overflow-y-auto bg-white p-4 shadow-2xl outline-none"
          >
            <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
              <span className="text-sm font-semibold text-zinc-950">{t("nav.menu")}</span>
              <button
                type="button"
                onClick={closeMenu}
                aria-label={t("nav.close")}
                className="inline-flex size-10 items-center justify-center rounded-md hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#34B386]/40"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <nav className="grid gap-1 py-5" aria-label={t("nav.primary")}>
            {visibleNavLinks.map((link) => (
              <Link
                key={link.href}
                href={withLocale(link.href, locale)}
                onClick={closeMenu}
                className={cx(
                  "relative rounded-md px-3 py-3 text-sm font-medium",
                  pathWithoutLocale === link.href.split("?")[0]
                    ? "bg-[#34B386]/10 text-zinc-950"
                    : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950",
                )}
              >
                {t(link.labelKey)}
                {link.href === "/messages" ? (
                  <UnreadMessageBadge
                    count={unreadMessageCount}
                    className="right-2 top-2"
                  />
                ) : null}
              </Link>
            ))}
            <Link
              href={withLocale(pathWithoutLocale, "en")}
              onClick={closeMenu}
              className="rounded-md px-3 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              {t("locale.english")}
            </Link>
            <Link
              href={withLocale(pathWithoutLocale, "ko")}
              onClick={closeMenu}
              className="rounded-md px-3 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              {t("locale.korean")}
            </Link>
            {isSignedIn && isAdmin ? (
              <Link
                href="/admin"
                onClick={closeMenu}
                className="rounded-md px-3 py-3 text-sm font-medium text-[var(--accent-foreground)] hover:bg-[var(--muted)]"
              >
                Admin Console
              </Link>
            ) : null}
            {isSignedIn ? (
              <div className="flex justify-end px-3 py-2">
                <ClerkUserButton />
              </div>
            ) : (
              <>
                <Link
                  href={withLocale("/login", locale)}
                  onClick={closeMenu}
                  className="rounded-md px-3 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
                >
                  {t("common.signIn")}
                </Link>
                <Link
                  href={withLocale("/signup", locale)}
                  onClick={closeMenu}
                  className="rounded-md px-3 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
                >
                  {t("common.signUp")}
                </Link>
              </>
            )}
            </nav>
          </div>
        </div>
      ) : null}
    </header>
  );
}

function normalizeUnreadCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : 0;
}

function formatUnreadCount(count: number) {
  return count > 99 ? "99+" : String(count);
}

function UnreadMessageBadge({
  count,
  className,
}: {
  count: number;
  className?: string;
}) {
  if (count <= 0) return null;

  return (
    <span
      aria-label={`${count} unread messages`}
      className={cx(
        "absolute inline-flex items-center justify-center rounded-full bg-[#34B386] text-[10px] font-bold leading-none text-zinc-950 shadow-sm",
        count > 99 ? "size-6 text-[9px]" : "size-5",
        className,
      )}
    >
      {formatUnreadCount(count)}
    </span>
  );
}
