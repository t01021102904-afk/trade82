"use client"

import type { MouseEvent } from "react"

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"

type PaginationControlsProps = {
  page: number
  totalPages: number
  locale: "en" | "ko"
  onPageChange: (page: number) => void | Promise<void>
}

type PaginationEntry = number | "start-ellipsis" | "end-ellipsis"

function paginationEntries(
  page: number,
  totalPages: number,
): PaginationEntry[] {
  if (totalPages <= 7) {
    return Array.from(
      { length: totalPages },
      (_, index) => index + 1,
    )
  }

  if (page <= 4) {
    return [1, 2, 3, 4, 5, "end-ellipsis", totalPages]
  }

  if (page >= totalPages - 3) {
    return [
      1,
      "start-ellipsis",
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ]
  }

  return [
    1,
    "start-ellipsis",
    page - 1,
    page,
    page + 1,
    "end-ellipsis",
    totalPages,
  ]
}

export function PaginationControls({
  page,
  totalPages,
  locale,
  onPageChange,
}: PaginationControlsProps) {
  if (totalPages <= 1) return null

  const safePage = Math.min(Math.max(1, page), totalPages)
  const entries = paginationEntries(safePage, totalPages)
  const previousDisabled = safePage <= 1
  const nextDisabled = safePage >= totalPages
  const previousLabel = locale === "ko" ? "이전" : "Previous"
  const nextLabel = locale === "ko" ? "다음" : "Next"
  const morePagesLabel =
    locale === "ko" ? "더 많은 페이지" : "More pages"

  function activate(
    event: MouseEvent<HTMLAnchorElement>,
    targetPage: number,
    disabled = false,
  ) {
    event.preventDefault()

    if (
      disabled ||
      targetPage === safePage ||
      targetPage < 1 ||
      targetPage > totalPages
    ) {
      return
    }

    void onPageChange(targetPage)
  }

  return (
    <Pagination className="mt-8">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            href="#"
            label={previousLabel}
            aria-disabled={previousDisabled}
            tabIndex={previousDisabled ? -1 : undefined}
            className={
              previousDisabled
                ? "pointer-events-none opacity-50"
                : undefined
            }
            onClick={(event) =>
              activate(event, safePage - 1, previousDisabled)
            }
          />
        </PaginationItem>

        {entries.map((entry) =>
          typeof entry === "number" ? (
            <PaginationItem key={entry}>
              <PaginationLink
                href="#"
                isActive={entry === safePage}
                aria-label={
                  locale === "ko"
                    ? `${entry}페이지로 이동`
                    : `Go to page ${entry}`
                }
                onClick={(event) => activate(event, entry)}
              >
                {entry}
              </PaginationLink>
            </PaginationItem>
          ) : (
            <PaginationItem key={entry}>
              <PaginationEllipsis label={morePagesLabel} />
            </PaginationItem>
          ),
        )}

        <PaginationItem>
          <PaginationNext
            href="#"
            label={nextLabel}
            aria-disabled={nextDisabled}
            tabIndex={nextDisabled ? -1 : undefined}
            className={
              nextDisabled
                ? "pointer-events-none opacity-50"
                : undefined
            }
            onClick={(event) =>
              activate(event, safePage + 1, nextDisabled)
            }
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}
