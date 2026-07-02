import type { ReactNode } from "react";

import { cx } from "@/lib/utils";

type BadgeTone = "blue" | "green" | "gray" | "amber" | "red";

const toneClasses: Record<BadgeTone, string> = {
  blue: "theme-info-badge",
  green: "theme-success-badge",
  gray: "theme-surface-muted theme-muted",
  amber: "theme-warning-badge",
  red: "theme-danger-badge",
};

export function Badge({
  children,
  tone = "gray",
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex max-w-full min-w-0 items-center break-words rounded border px-1.5 py-0.5 text-[11px] font-medium leading-4",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
