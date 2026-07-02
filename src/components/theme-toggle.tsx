"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import type { ComponentType } from "react";

import { useI18n } from "@/components/i18n-provider";
import { type ThemePreference, useTheme } from "@/components/theme-provider";
import { cx } from "@/lib/utils";

const themeOptions: Array<{
  value: ThemePreference;
  labelKey: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
}> = [
  { value: "light", labelKey: "theme.light", icon: Sun },
  { value: "dark", labelKey: "theme.dark", icon: Moon },
  { value: "system", labelKey: "theme.system", icon: Monitor },
];

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { preference, setPreference } = useTheme();
  const { t } = useI18n();

  return (
    <div
      className="inline-flex rounded-xl border theme-border theme-surface-muted p-1"
      role="radiogroup"
      aria-label={t("theme.label")}
      title={t("theme.label")}
    >
      {themeOptions.map((option) => {
        const Icon = option.icon;
        const selected = preference === option.value;
        const label = t(option.labelKey);

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={label}
            title={label}
            onClick={() => setPreference(option.value)}
            className={cx(
              "inline-flex h-8 items-center justify-center rounded-lg px-2 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 theme-focus",
              compact ? "w-8" : "gap-1.5",
              selected
                ? "theme-primary-button shadow-sm"
                : "theme-ghost-button",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {compact ? <span className="sr-only">{label}</span> : <span>{label}</span>}
          </button>
        );
      })}
    </div>
  );
}
