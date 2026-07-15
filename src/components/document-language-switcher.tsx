"use client";

import Link from "next/link";

import type { Locale } from "@/lib/i18n";

export function DocumentLanguageSwitcher({
  locale,
  alternateHref,
  activeSectionId,
}: {
  locale: Locale;
  alternateHref: string;
  activeSectionId?: string;
}) {
  const href = activeSectionId ? `${alternateHref}#${activeSectionId}` : alternateHref;

  return (
    <Link
      href={href}
      className="inline-flex min-h-10 items-center rounded-md border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-800 transition hover:border-[#34B386] hover:text-[#237b5c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#34B386]"
    >
      {locale === "ko" ? "English" : "한국어"}
    </Link>
  );
}
