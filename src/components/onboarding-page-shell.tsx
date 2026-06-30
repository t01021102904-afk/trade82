import type { ReactNode } from "react";

export function OnboardingPageShell({
  label,
  title,
  description,
  children,
}: {
  label?: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#05070a] text-zinc-100">
      <div className="mx-auto grid max-w-7xl gap-7 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <header className="grid gap-3 rounded-[24px] border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/20 sm:p-6">
          {label ? (
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300/80">
              {label}
            </p>
          ) : null}
          <div className="grid gap-3 lg:grid-cols-[minmax(0,0.75fr)_minmax(280px,0.25fr)] lg:items-end">
            <div className="min-w-0">
              <h1 className="break-words text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                {title}
              </h1>
              {description ? (
                <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400 sm:text-base sm:leading-7">
                  {description}
                </p>
              ) : null}
            </div>
            <div className="hidden h-2 overflow-hidden rounded-full border border-white/10 bg-zinc-950 lg:block">
              <span className="bm-onboarding-progress block h-full rounded-full bg-gradient-to-r from-emerald-300 via-blue-300 to-zinc-100" />
            </div>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
