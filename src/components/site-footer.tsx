"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useI18n } from "@/components/i18n-provider";

const legalRoutes = ["/terms", "/privacy"] as const;

function legalPrefix(pathname: string) {
  if (pathname === "/ko" || pathname.startsWith("/ko/")) return "/ko";
  if (pathname === "/en" || pathname.startsWith("/en/")) return "/en";
  return "";
}

export function SiteFooter() {
  const { messages } = useI18n();
  const pathname = usePathname();
  const footer = messages.footer;
  const prefix = legalPrefix(pathname);

  return (
    <footer className="relative z-10 border-t theme-border theme-bg">
      <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <nav className="relative z-10" aria-label={footer.legalLinksTitle}>
          <p className="text-xs font-semibold theme-foreground">
            {footer.legalLinksTitle}
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs theme-muted">
            {footer.legalLinks.map((link, index) => (
              <Link
                key={link.label}
                href={`${prefix}${legalRoutes[index] ?? "/terms"}`}
                className="relative z-10 inline-flex min-h-8 items-center rounded-md underline-offset-4 transition hover:text-[var(--foreground)] hover:underline"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </nav>
        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <p className="text-xs theme-muted">{footer.copyright}</p>
        </div>
      </div>
    </footer>
  );
}
