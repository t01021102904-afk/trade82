"use client";

import Link from "next/link";

import { useI18n } from "@/components/i18n-provider";
import { withLocale } from "@/lib/i18n";

const footerLinks = [
  { href: "/marketplace", labelKey: "nav.marketplace" },
  { href: "/sellers", labelKey: "nav.sellers" },
  { href: "/buyers", labelKey: "nav.buyers" },
  { href: "/dashboard", labelKey: "nav.dashboard" },
  { href: "/messages", labelKey: "nav.messages" },
];

export function SiteFooter() {
  const { locale, t } = useI18n();

  return (
    <footer className="border-t border-zinc-200 bg-white">
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.2fr_1fr] lg:px-8">
        <div>
          <Link href={withLocale("/", locale)} className="text-lg font-semibold text-zinc-950">
            {t("common.bridgeMarket")}
          </Link>
          <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-600">
            {t("footer.description")}
          </p>
          <p className="mt-5 max-w-3xl text-xs leading-5 text-zinc-500">
            {t("footer.disclaimer")}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:justify-self-end">
          {footerLinks.map((link) => (
            <Link
              key={link.href}
              href={withLocale(link.href, locale)}
              className="text-sm font-medium text-zinc-600 transition hover:text-blue-700"
            >
              {t(link.labelKey)}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
