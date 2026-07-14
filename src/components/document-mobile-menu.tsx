"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";

import type { DocumentSection } from "@/lib/document-content";

export function DocumentMobileMenu({
  open,
  onClose,
  onNavigate,
  sections,
  activeSectionId,
  title,
  locale,
}: {
  open: boolean;
  onClose: () => void;
  onNavigate: (id: string) => void;
  sections: DocumentSection[];
  activeSectionId: string;
  title: string;
  locale: "en" | "ko";
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const lastActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    lastActiveElement.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusableSelector = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(",");

    const getFocusableElements = () =>
      Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? []);

    const focusableElements = getFocusableElements();
    focusableElements[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;
      const elements = getFocusableElements();
      if (!elements.length) return;
      const first = elements[0];
      const last = elements[elements.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      lastActiveElement.current?.focus();
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div
      className="document-print-hidden fixed inset-0 z-50 bg-zinc-950/20 lg:hidden"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        id="document-mobile-menu"
        role="dialog"
        aria-modal="true"
        aria-labelledby="document-mobile-menu-title"
        className="ml-auto flex h-[100dvh] w-full max-w-sm flex-col border-l border-zinc-200 bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-zinc-200 px-5 py-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#237b5c]">
              {locale === "ko" ? "목차" : "Contents"}
            </p>
            <h2 id="document-mobile-menu-title" className="mt-1 break-words text-base font-semibold text-zinc-950">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-md border border-zinc-300 text-zinc-700 transition hover:border-[#34B386] hover:text-[#237b5c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#34B386]"
            aria-label={locale === "ko" ? "목차 닫기" : "Close menu"}
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </header>
        <nav className="min-h-0 flex-1 overflow-y-auto px-5 py-4" aria-label={locale === "ko" ? "문서 목차" : "Document table of contents"}>
          <ol className="grid gap-1">
            {sections.map((section) => {
              const isActive = section.id === activeSectionId;
              return (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    aria-current={isActive ? "location" : undefined}
                    onClick={(event) => {
                      event.preventDefault();
                      onNavigate(section.id);
                      onClose();
                    }}
                    className={`flex min-h-11 items-center rounded-md px-3 py-2 text-sm leading-5 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#34B386] ${
                      isActive
                        ? "bg-emerald-50 font-semibold text-[#237b5c]"
                        : "text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950"
                    }`}
                  >
                    {section.title}
                  </a>
                </li>
              );
            })}
          </ol>
        </nav>
      </div>
    </div>
  );
}
