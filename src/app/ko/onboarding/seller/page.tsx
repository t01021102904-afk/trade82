import { OnboardingChangeRoleLink } from "@/components/onboarding-change-role-link";
import { OnboardingForm } from "@/components/onboarding-form";
import { OnboardingPageShell } from "@/components/onboarding-page-shell";
import { getDictionary } from "@/lib/i18n";
import { requireOnboardingRole } from "@/lib/require-auth";

export default async function KoSellerOnboardingPage() {
  const { canChangeRole } = await requireOnboardingRole(
    "/ko/onboarding/seller",
    "seller",
  );
  const messages = getDictionary("ko");
  return (
    <OnboardingPageShell
      backFallbackHref="/onboarding/role"
      label={messages.onboarding.sellerLabel}
      title={messages.onboarding.sellerTitle}
      description={messages.onboarding.sellerDescription}
    >
      {canChangeRole ? <OnboardingChangeRoleLink locale="ko" /> : null}
      <OnboardingForm kind="seller" />
    </OnboardingPageShell>
  );
}
