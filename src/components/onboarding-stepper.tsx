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
    <nav aria-label={t("onboarding.stepperLabel")} className="grid gap-2 sm:grid-cols-4">
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
              "min-w-0 rounded-lg border px-3 py-3 text-left text-sm transition",
              active
                ? "border-blue-300 bg-blue-50 text-blue-900 shadow-sm"
                : complete
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border-zinc-200 bg-white text-zinc-500",
              clickable ? "hover:-translate-y-0.5 hover:border-blue-200" : "cursor-default",
            )}
            aria-current={active ? "step" : undefined}
          >
            <span className="block text-xs font-semibold uppercase tracking-wide">
              {t("onboarding.stepLabel", "Step")} {index + 1}
            </span>
            <span className="mt-1 block truncate font-semibold">{step.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
