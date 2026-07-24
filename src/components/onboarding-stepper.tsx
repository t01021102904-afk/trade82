"use client";

import { useI18n } from "@/components/i18n-provider";
import { cx } from "@/lib/utils";

export type OnboardingStepId =
  | "role"
  | "company"
  | "payout"
  | "personal"
  | "product"
  | "sourcing";

export function OnboardingStepper({
  current,
  role,
  onSelect,
}: {
  current: OnboardingStepId;
  role?: "buyer" | "seller";
  onSelect?: (step: OnboardingStepId) => void;
}) {
  const { t } = useI18n();
  const steps: Array<{ id: OnboardingStepId; label: string }> =
    role === "seller"
      ? [
          { id: "role", label: t("onboarding.stepRole") },
          { id: "company", label: t("onboarding.stepCompany") },
          { id: "payout", label: t("onboarding.stepPayoutInformation") },
        ]
      : [
          { id: "role", label: t("onboarding.stepRole") },
          { id: "company", label: t("onboarding.stepCompany") },
          { id: "personal", label: t("onboarding.stepPersonal") },
          { id: "sourcing", label: t("onboarding.stepBuyerSourcing") },
        ];
  const currentIndex = steps.findIndex((step) => step.id === current);

  return (
    <nav
      aria-label={t("onboarding.stepperLabel")}
      className="rounded-2xl border px-3 py-3 theme-surface-elevated"
    >
      <ol className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {steps.map((step, index) => {
          const active = step.id === current;
          const complete = index < currentIndex;
          const clickable = complete && onSelect;

          return (
            <li key={step.id} className="flex min-w-0 flex-1 items-center gap-2">
              <button
                type="button"
                disabled={!clickable}
                onClick={() => onSelect?.(step.id)}
                className={cx(
                  "flex min-w-0 items-center gap-2 rounded-xl px-2 py-1.5 text-left text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400",
                  active
                    ? "theme-success-badge"
                    : complete
                      ? "theme-info-badge"
                      : "theme-muted",
                  clickable ? "hover:bg-[var(--muted)]" : "cursor-default",
                )}
                aria-current={active ? "step" : undefined}
              >
                <span
                  className={cx(
                    "inline-flex size-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
                    active || complete ? "border-current" : "theme-border",
                  )}
                >
                  {index + 1}
                </span>
                <span className="min-w-0 break-words font-medium leading-5 whitespace-normal [overflow-wrap:anywhere]">{step.label}</span>
              </button>
              {index < steps.length - 1 ? (
                <span className="hidden h-px flex-1 theme-surface-muted sm:block" />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
