"use client";

import { Check } from "lucide-react";

import { useI18n } from "@/components/i18n-provider";
import { cx } from "@/lib/utils";

export function AdminBadge({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const label = t("adminBadge.label");
  const ariaLabel = t("adminBadge.ariaLabel");

  return (
    <span
      className={cx(
        "inline-flex max-w-full shrink-0 items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold leading-5 text-blue-700",
        className,
      )}
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      <span
        className="inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white"
        aria-hidden="true"
      >
        <Check className="size-3" strokeWidth={3} />
      </span>
      <span className={compact ? "sr-only" : "truncate"}>{label}</span>
    </span>
  );
}
