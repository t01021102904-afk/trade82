"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { ClerkUserButton } from "@/components/clerk-user-button";
import { useI18n } from "@/components/i18n-provider";
import { useUserContext } from "@/hooks/use-user-context";
import { stripLocale, withLocale } from "@/lib/i18n";
import { cx } from "@/lib/utils";

const navLinks = [
  { href: "/marketplace", labelKey: "nav.marketplace" },
  { href: "/sellers", labelKey: "nav.sellers" },
];

const appLinks = [
  { href: "/dashboard", labelKey: "nav.dashboard" },
  { href: "/messages", labelKey: "nav.messages" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { locale, t } = useI18n();
  const { context, isSignedIn, user } = useUserContext();
  const [open, setOpen] = useState(false);
  const pathWithoutLocale = stripLocale(pathname);
  const role = context?.role ?? user?.publicMetadata?.role;
  const isAdmin = context?.isAdmin === true;
  const hasRole =
    role === "buyer" ||
    role === "seller" ||
    role === "both" ||
    role === "admin";
  const visibleNavLinks =
    isSignedIn && hasRole
      ? [
          ...navLinks,
          ...(role === "seller" || role === "both"
            ? [{ href: "/sell", labelKey: "nav.sell" }]
            : []),
          ...appLinks,
        ]
      : navLinks;

  return (
    <header className="sticky top-0 z-40 border-b theme-border theme-header backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href={withLocale("/", locale)} className="flex items-center gap-2 theme-foreground">
          <Image
            src="/trade82-logo.png"
            alt="Trade82"
            width={40}
            height={40}
            priority
            className="h-9 w-9 object-contain"
          />
          <span className="text-sm font-semibold tracking-tight">Trade82</span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {visibleNavLinks.map((link) => (
            <Link
              key={link.href}
              href={withLocale(link.href, locale)}
              className={cx(
                "rounded-md px-3 py-2 text-sm font-medium transition",
                pathWithoutLocale === link.href
                  ? "theme-surface-muted theme-foreground"
                  : "theme-muted hover:bg-[var(--muted)] hover:text-[var(--foreground)]",
              )}
            >
              {t(link.labelKey)}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Link
            href={withLocale(pathWithoutLocale, "en")}
            className={cx(
              "rounded-md px-3 py-2 text-sm font-medium",
              locale === "en"
                ? "theme-surface-muted theme-foreground"
                : "theme-muted hover:text-[var(--accent-foreground)]",
            )}
          >
            {t("locale.english")}
          </Link>
          <Link
            href={withLocale(pathWithoutLocale, "ko")}
            className={cx(
              "rounded-md px-3 py-2 text-sm font-medium",
              locale === "ko"
                ? "theme-surface-muted theme-foreground"
                : "theme-muted hover:text-[var(--accent-foreground)]",
            )}
          >
            {t("locale.korean")}
          </Link>
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
            <>
            <Link
              href={withLocale("/login", locale)}
              className="rounded-md border px-3.5 py-2 text-sm font-medium theme-border theme-muted hover:text-[var(--accent-foreground)]"
            >
              {t("common.signIn")}
            </Link>
            <Link
              href={withLocale("/signup", locale)}
              className="rounded-md px-3.5 py-2 text-sm font-medium theme-primary-button"
            >
              {t("common.signUp")}
            </Link>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border text-sm font-semibold theme-border theme-muted lg:hidden"
          aria-label="Toggle navigation"
          aria-expanded={open}
        >
          {open ? t("nav.close") : t("nav.menu")}
        </button>
      </div>

      {open ? (
        <div className="border-t theme-border theme-bg lg:hidden">
          <nav className="mx-auto grid max-w-7xl gap-1 px-4 py-4 sm:px-6">
            {visibleNavLinks.map((link) => (
              <Link
                key={link.href}
                href={withLocale(link.href, locale)}
                onClick={() => setOpen(false)}
                className={cx(
                  "rounded-md px-3 py-3 text-sm font-medium",
                  pathWithoutLocale === link.href
                    ? "theme-surface-muted theme-foreground"
                    : "theme-muted hover:bg-[var(--muted)] hover:text-[var(--foreground)]",
                )}
              >
                {t(link.labelKey)}
              </Link>
            ))}
            <Link href={withLocale(pathWithoutLocale, "en")} className="rounded-md px-3 py-3 text-sm font-medium theme-muted hover:text-[var(--foreground)]">
              {t("locale.english")}
            </Link>
            <Link href={withLocale(pathWithoutLocale, "ko")} className="rounded-md px-3 py-3 text-sm font-medium theme-muted hover:text-[var(--foreground)]">
              {t("locale.korean")}
            </Link>
            {isSignedIn && isAdmin ? (
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
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
              <Link href={withLocale("/login", locale)} className="rounded-md px-3 py-3 text-sm font-medium theme-muted hover:text-[var(--foreground)]">
                {t("common.signIn")}
              </Link>
              <Link href={withLocale("/signup", locale)} className="rounded-md px-3 py-3 text-sm font-medium theme-muted hover:text-[var(--foreground)]">
                {t("common.signUp")}
              </Link>
              </>
            )}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
