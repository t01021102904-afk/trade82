"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useI18n } from "@/components/i18n-provider";

const legalRoutes = ["/terms", "/sourcing-terms", "/privacy", "/business"] as const;

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
    <footer className="relative z-10 border-t border-zinc-200 bg-white">
      <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <h2 className="text-sm font-semibold text-zinc-950">{footer.businessTitle}</h2>
        <div className="mt-4 grid max-w-4xl gap-3 text-xs leading-5 text-zinc-500">
          {footer.businessParagraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
        <nav className="relative z-10 mt-5" aria-label={footer.legalLinksTitle}>
          <p className="text-xs font-semibold text-zinc-800">
            {footer.legalLinksTitle}
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs text-zinc-500">
            {footer.legalLinks.map((link, index) => (
              <Link
                key={link.label}
                href={`${prefix}${legalRoutes[index] ?? "/terms"}`}
                className="relative z-10 inline-flex min-h-8 items-center rounded-md underline-offset-4 transition hover:text-zinc-950 hover:underline"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </nav>
        <p className="mt-5 text-xs text-zinc-500">{footer.copyright}</p>
      </div>
    </footer>
  );
}
