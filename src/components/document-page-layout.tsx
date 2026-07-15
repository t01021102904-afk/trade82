"use client";

import { List } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { DocumentLanguageSwitcher } from "@/components/document-language-switcher";
import { DocumentMobileMenu } from "@/components/document-mobile-menu";
import { DocumentBlocks, DocumentSection } from "@/components/document-section";
import { DocumentSidebar } from "@/components/document-sidebar";
import { useDocumentScrollSpy } from "@/hooks/use-document-scroll-spy";
import type { ParsedDocument } from "@/lib/document-content";
import type { Locale } from "@/lib/i18n";

export function DocumentPageLayout({
  document: documentData,
  locale,
  alternateHref,
}: {
  document: ParsedDocument;
  locale: Locale;
  alternateHref: string;
}) {
  const sectionIds = useMemo(() => documentData.sections.map((section) => section.id), [documentData.sections]);
  const { activeSectionId, setActiveSectionId } = useDocumentScrollSpy(sectionIds);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigateToSection = useCallback(
    (id: string) => {
      const target = document.getElementById(id);
      if (!target) return;

      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.history.pushState(null, "", `#${id}`);
      setActiveSectionId(id);
      target.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "start",
      });
    },
    [setActiveSectionId],
  );

  const currentSection = documentData.sections.find((section) => section.id === activeSectionId);

  return (
    <div className="trade82-document-page bg-zinc-50 text-zinc-950">
      <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <header className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#237b5c]">Trade82</p>
          <h1 className="mt-3 break-words text-3xl font-semibold tracking-normal text-zinc-950 [overflow-wrap:anywhere] sm:text-4xl">
            {documentData.title}
          </h1>
          <div className="document-mobile-actions document-print-hidden mt-5 flex flex-wrap items-center justify-center gap-2">
            <DocumentLanguageSwitcher
              locale={locale}
              alternateHref={alternateHref}
              activeSectionId={activeSectionId}
            />
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="inline-flex min-h-10 items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-800 transition hover:border-[#34B386] hover:text-[#237b5c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#34B386]"
              aria-expanded={mobileMenuOpen}
              aria-controls="document-mobile-menu"
            >
              <List className="size-4" aria-hidden="true" />
              {locale === "ko" ? "목차 열기" : "Open menu"}
            </button>
          </div>
          {currentSection ? (
            <p className="mt-4 text-xs font-medium text-zinc-500 lg:hidden">{currentSection.title}</p>
          ) : null}
        </header>

        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(13rem,17rem)_minmax(0,1fr)] lg:gap-14">
          <DocumentSidebar
            sections={documentData.sections}
            activeSectionId={activeSectionId}
            onNavigate={navigateToSection}
            locale={locale}
          />
          <article className="min-w-0 max-w-[52rem] lg:justify-self-start">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-6">
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-zinc-600">
                {documentData.effectiveDate ? (
                  <p>
                    <span className="font-semibold text-zinc-800">{locale === "ko" ? "시행일" : "Effective date"}:</span>{" "}
                    {documentData.effectiveDate}
                  </p>
                ) : null}
                {documentData.lastUpdated ? (
                  <p>
                    <span className="font-semibold text-zinc-800">{locale === "ko" ? "최종 업데이트" : "Last updated"}:</span>{" "}
                    {documentData.lastUpdated}
                  </p>
                ) : null}
              </div>
              <div className="document-desktop-language document-print-hidden">
                <DocumentLanguageSwitcher
                  locale={locale}
                  alternateHref={alternateHref}
                  activeSectionId={activeSectionId}
                />
              </div>
            </div>

            {documentData.intro.length ? <div className="mt-8"><DocumentBlocks blocks={documentData.intro} /></div> : null}

            <div className="mt-10 grid gap-10">
              {documentData.sections.map((section) => (
                <DocumentSection key={section.id} section={section} />
              ))}
            </div>
          </article>
        </div>
      </div>

      <DocumentMobileMenu
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        onNavigate={navigateToSection}
        sections={documentData.sections}
        activeSectionId={activeSectionId}
        title={documentData.title}
        locale={locale}
      />
    </div>
  );
}
