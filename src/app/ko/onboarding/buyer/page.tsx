import { OnboardingForm } from "@/components/onboarding-form";
import { OnboardingPageShell } from "@/components/onboarding-page-shell";
import { getDictionary } from "@/lib/i18n";
import { requireOnboardingRole } from "@/lib/require-auth";

export default async function KoBuyerOnboardingPage() {
  await requireOnboardingRole("/ko/onboarding/buyer", "buyer");
  const messages = getDictionary("ko");
  return (
    <OnboardingPageShell
      backFallbackHref="/onboarding/role"
      label={messages.onboarding.buyerLabel}
      title={messages.onboarding.buyerTitle}
      description={messages.onboarding.buyerDescription}
    >
      <OnboardingForm kind="buyer" />
    </OnboardingPageShell>
  );
}
