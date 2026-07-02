import type { ReactNode } from "react";

import { cx } from "@/lib/utils";

type BadgeTone = "blue" | "green" | "gray" | "amber" | "red";

const toneClasses: Record<BadgeTone, string> = {
  blue: "border-blue-300/30 bg-blue-300/10 text-blue-600",
  green: "border-emerald-300/30 bg-emerald-300/10 text-emerald-700",
  gray: "theme-surface-muted theme-muted",
  amber: "border-amber-300/35 bg-amber-300/10 text-amber-700",
  red: "border-red-300/35 bg-red-300/10 text-red-700",
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
