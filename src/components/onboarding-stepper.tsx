"use client";

import { useI18n } from "@/components/i18n-provider";
import { cx } from "@/lib/utils";

export type OnboardingStepId = "role" | "company" | "personal" | "product" | "sourcing";

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
  const finalStep: OnboardingStepId =
    role === "buyer" ? "sourcing" : role === "seller" ? "product" : "product";
  const steps: Array<{ id: OnboardingStepId; label: string }> = [
    { id: "role", label: t("onboarding.stepRole") },
    { id: "company", label: t("onboarding.stepCompany") },
    { id: "personal", label: t("onboarding.stepPersonal") },
    {
      id: finalStep,
      label:
        role === "buyer"
          ? t("onboarding.stepBuyerSourcing")
          : role === "seller"
            ? t("onboarding.stepSellerProduct")
            : t("onboarding.stepFinal"),
    },
  ];
  const currentIndex = steps.findIndex((step) => step.id === current);

  return (
    <nav
      aria-label={t("onboarding.stepperLabel")}
      className="grid gap-2 rounded-[20px] border border-white/10 bg-white/[0.035] p-2 sm:grid-cols-4"
    >
      {steps.map((step, index) => {
        const active = step.id === current;
        const complete = index < currentIndex;
        const clickable = complete && onSelect;

        return (
          <button
            key={step.id}
            type="button"
            disabled={!clickable}
            onClick={() => onSelect?.(step.id)}
            className={cx(
              "group min-w-0 rounded-2xl border px-3 py-3 text-left text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300",
              active
                ? "border-emerald-300/50 bg-emerald-300/10 text-emerald-100 shadow-sm"
                : complete
                  ? "border-blue-300/30 bg-blue-300/10 text-blue-100"
                  : "border-white/10 bg-zinc-950/70 text-zinc-500",
              clickable ? "hover:-translate-y-0.5 hover:border-emerald-300/40" : "cursor-default",
            )}
            aria-current={active ? "step" : undefined}
          >
            <span className="block text-xs font-semibold uppercase tracking-wide">
              {t("onboarding.stepLabel", "Step")} {index + 1}
            </span>
            <span className="mt-1 block truncate font-semibold">{step.label}</span>
            <span className="mt-3 block h-1 overflow-hidden rounded-full bg-white/10">
              <span
                className={cx(
                  "block h-full rounded-full transition-all",
                  active || complete ? "w-full bg-emerald-300" : "w-1/4 bg-white/15",
                )}
              />
            </span>
          </button>
        );
      })}
    </nav>
  );
}
