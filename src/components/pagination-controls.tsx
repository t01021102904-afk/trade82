"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { cx } from "@/lib/utils";

type PaginationItem = number | "ellipsis";

export function PaginationControls({
  page,
  totalPages,
  onPageChange,
  locale,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  locale: "en" | "ko";
}) {
  if (totalPages <= 1) return null;

  const previousDisabled = page <= 1;
  const nextDisabled = page >= totalPages;

  return (
    <nav
      className="flex items-center justify-center"
      aria-label={locale === "ko" ? "페이지 이동" : "Pagination"}
    >
      <div className="hidden items-center gap-1 sm:flex">
        <PaginationButton
          label={locale === "ko" ? "이전 페이지" : "Previous page"}
          disabled={previousDisabled}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </PaginationButton>
        {paginationItems(page, totalPages).map((item, index) =>
          item === "ellipsis" ? (
            <span
              key={`ellipsis-${index}`}
              className="inline-flex h-9 min-w-9 items-center justify-center px-2 text-sm theme-muted"
              aria-hidden="true"
            >
              ...
            </span>
          ) : (
            <PaginationButton
              key={item}
              active={item === page}
              label={
                locale === "ko"
                  ? `${item}페이지로 이동`
                  : `Go to page ${item}`
              }
              onClick={() => onPageChange(item)}
            >
              {item}
            </PaginationButton>
          ),
        )}
        <PaginationButton
          label={locale === "ko" ? "다음 페이지" : "Next page"}
          disabled={nextDisabled}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </PaginationButton>
      </div>

      <div className="flex w-full items-center justify-between gap-3 sm:hidden">
        <PaginationButton
          label={locale === "ko" ? "이전 페이지" : "Previous page"}
          disabled={previousDisabled}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </PaginationButton>
        <span className="text-sm font-medium theme-muted">
          {locale === "ko"
            ? `${page} / ${totalPages} 페이지`
            : `Page ${page} of ${totalPages}`}
        </span>
        <PaginationButton
          label={locale === "ko" ? "다음 페이지" : "Next page"}
          disabled={nextDisabled}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </PaginationButton>
      </div>
    </nav>
  );
}

function PaginationButton({
  children,
  label,
  active = false,
  disabled = false,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-current={active ? "page" : undefined}
      disabled={disabled || active}
      onClick={onClick}
      className={cx(
        "inline-flex h-9 min-w-9 items-center justify-center rounded-md border px-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-45",
        active
          ? "border-slate-950 bg-slate-950 text-white"
          : "theme-secondary-button hover:-translate-y-0.5",
      )}
    >
      {children}
    </button>
  );
}

function paginationItems(page: number, totalPages: number): PaginationItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set([1, totalPages, page, page - 1, page + 1]);
  if (page <= 3) {
    pages.add(2);
    pages.add(3);
    pages.add(4);
  }
  if (page >= totalPages - 2) {
    pages.add(totalPages - 1);
    pages.add(totalPages - 2);
    pages.add(totalPages - 3);
  }

  const sorted = Array.from(pages)
    .filter((item) => item >= 1 && item <= totalPages)
    .sort((left, right) => left - right);
  const items: PaginationItem[] = [];

  sorted.forEach((item, index) => {
    const previous = sorted[index - 1];
    if (previous && item - previous > 1) {
      items.push("ellipsis");
    }
    items.push(item);
  });

  return items;
}
