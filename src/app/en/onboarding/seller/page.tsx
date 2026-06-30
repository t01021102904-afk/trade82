import { OnboardingForm } from "@/components/onboarding-form";
import { OnboardingPageShell } from "@/components/onboarding-page-shell";
import { getDictionary } from "@/lib/i18n";
import { requireOnboardingRole } from "@/lib/require-auth";

export default async function EnSellerOnboardingPage() {
  await requireOnboardingRole("/en/onboarding/seller", "seller");
  const messages = getDictionary("en");

  return (
    <OnboardingPageShell
      label={messages.onboarding.sellerLabel}
      title={messages.onboarding.sellerTitle}
      description={messages.onboarding.sellerDescription}
    >
      <OnboardingForm kind="seller" />
    </OnboardingPageShell>
  );
}
