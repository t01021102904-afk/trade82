import { OnboardingChangeRoleLink } from "@/components/onboarding-change-role-link";
import { OnboardingForm } from "@/components/onboarding-form";
import { OnboardingPageShell } from "@/components/onboarding-page-shell";
import { getDictionary } from "@/lib/i18n";
import { requireOnboardingRole } from "@/lib/require-auth";

export default async function EnSellerOnboardingPage() {
  const { canChangeRole } = await requireOnboardingRole(
    "/en/onboarding/seller",
    "seller",
  );
  const messages = getDictionary("en");

  return (
    <OnboardingPageShell
      backFallbackHref="/onboarding/role"
      label={messages.onboarding.sellerLabel}
      title={messages.onboarding.sellerTitle}
      description={messages.onboarding.sellerDescription}
    >
      {canChangeRole ? <OnboardingChangeRoleLink locale="en" /> : null}
      <OnboardingForm kind="seller" />
    </OnboardingPageShell>
  );
}
