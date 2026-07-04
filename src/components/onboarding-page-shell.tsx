import type { ReactNode } from "react";

import { BackButton } from "@/components/back-button";

export function OnboardingPageShell({
  backFallbackHref = "/",
  label,
  title,
  description,
  children,
}: {
  backFallbackHref?: string;
  label?: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen theme-bg">
      <div className="mx-auto grid w-full max-w-[860px] gap-5 px-4 py-6 sm:px-6 sm:py-8">
        <BackButton fallbackHref={backFallbackHref} />
        <header className="grid gap-3 rounded-2xl border p-5 theme-surface-elevated sm:p-6">
          {label ? (
            <p className="text-xs font-semibold uppercase tracking-[0.16em] theme-success-text">
              {label}
            </p>
          ) : null}
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-semibold tracking-tight theme-foreground sm:text-[28px]">
              {title}
            </h1>
            {description ? (
              <p className="mt-2 max-w-2xl text-sm leading-6 theme-muted">
                {description}
              </p>
            ) : null}
          </div>
          <div className="h-1.5 overflow-hidden rounded-full border theme-surface-muted">
            <span className="bm-onboarding-progress block h-full rounded-full bg-gradient-to-r from-emerald-400 via-blue-400 to-cyan-300" />
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
