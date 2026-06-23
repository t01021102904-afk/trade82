import type { ReactNode } from "react";

import { cx } from "@/lib/utils";

type BadgeTone = "blue" | "green" | "gray" | "amber" | "red";

const toneClasses: Record<BadgeTone, string> = {
  blue: "border-blue-200 bg-blue-50 text-blue-700",
  green: "border-emerald-200 bg-emerald-50 text-emerald-700",
  gray: "border-zinc-200 bg-zinc-50 text-zinc-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  red: "border-red-200 bg-red-50 text-red-700",
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
        "inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
