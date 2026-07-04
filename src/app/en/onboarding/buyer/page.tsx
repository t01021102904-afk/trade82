import { OnboardingChangeRoleLink } from "@/components/onboarding-change-role-link";
import { OnboardingForm } from "@/components/onboarding-form";
import { OnboardingPageShell } from "@/components/onboarding-page-shell";
import { getDictionary } from "@/lib/i18n";
import { requireOnboardingRole } from "@/lib/require-auth";

export default async function EnBuyerOnboardingPage() {
  const { canChangeRole } = await requireOnboardingRole(
    "/en/onboarding/buyer",
    "buyer",
  );
  const messages = getDictionary("en");

  return (
    <OnboardingPageShell
      backFallbackHref="/onboarding/role"
      label={messages.onboarding.buyerLabel}
      title={messages.onboarding.buyerTitle}
      description={messages.onboarding.buyerDescription}
    >
      {canChangeRole ? <OnboardingChangeRoleLink locale="en" /> : null}
      <OnboardingForm kind="buyer" />
    </OnboardingPageShell>
  );
}
