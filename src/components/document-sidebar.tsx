"use client";

import { useEffect, useRef } from "react";

import type { DocumentSection } from "@/lib/document-content";

export function DocumentSidebar({
  sections,
  activeSectionId,
  onNavigate,
  locale,
}: {
  sections: DocumentSection[];
  activeSectionId: string;
  onNavigate: (id: string) => void;
  locale: "en" | "ko";
}) {
  const activeLinkRef = useRef<HTMLAnchorElement>(null);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const activeLink = activeLinkRef.current;
    const navigation = navRef.current;
    if (!activeLink || !navigation) return;

    const linkBounds = activeLink.getBoundingClientRect();
    const navigationBounds = navigation.getBoundingClientRect();

    if (linkBounds.top < navigationBounds.top) {
      navigation.scrollTop -= navigationBounds.top - linkBounds.top + 8;
    } else if (linkBounds.bottom > navigationBounds.bottom) {
      navigation.scrollTop += linkBounds.bottom - navigationBounds.bottom + 8;
    }
  }, [activeSectionId]);

  return (
    <aside className="document-sidebar hidden self-start lg:block">
      <nav
        ref={navRef}
        aria-label={locale === "ko" ? "문서 목차" : "Document table of contents"}
        className="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto pr-3 [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin]"
      >
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
          {locale === "ko" ? "목차" : "Contents"}
        </p>
        <ol className="grid gap-1 border-l border-zinc-200">
          {sections.map((section) => {
            const isActive = section.id === activeSectionId;
            return (
              <li key={section.id}>
                <a
                  ref={isActive ? activeLinkRef : undefined}
                  href={`#${section.id}`}
                  aria-current={isActive ? "location" : undefined}
                  onClick={(event) => {
                    event.preventDefault();
                    onNavigate(section.id);
                  }}
                  className={`block border-l-2 py-2 pl-3 pr-2 text-sm leading-5 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#34B386] ${
                    isActive
                      ? "-ml-px border-[#34B386] font-semibold text-[#237b5c]"
                      : "-ml-px border-transparent text-zinc-600 hover:border-zinc-300 hover:text-zinc-950"
                  }`}
                >
                  {section.title}
                </a>
              </li>
            );
          })}
        </ol>
      </nav>
    </aside>
  );
}
